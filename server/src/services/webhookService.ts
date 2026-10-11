import http from 'http'
import https from 'https'
import crypto from 'crypto'
import axios from 'axios'
import { db } from '../db.js'
import { validateWebhookUrl, validateWebhookUrlDns, createPinnedDnsLookup } from '../lib/urlValidator.js'
import { isCredentialEncrypted, decryptCredential } from '../lib/credentialCrypto.js'

export interface WebhookPayload {
  event: string
  clientId: string
  businessName: string
  transaction: {
    sessionId: string
    senderHandle: string
    recipientHandle: string
    amountEgp: number
    detectedAmountEgp?: number | null
    currency: string
    status: string
    detectedRef: string | null
    detectedAt: string | null
    note?: string | null
    createdAt: string
  }
}

export interface WebhookSecretResolution {
  ok: boolean
  secret: string | null
  error?: string
}

/**
 * Resolves the webhook signing secret from a raw stored database value (encrypted or plaintext).
 * Fail-closed: If a secret is encrypted but fails to decrypt (MAC failure or malformed envelope),
 * returns { ok: false, ... } to ensure webhooks are never dispatched unsigned.
 */
export function resolveWebhookSigningSecret(
  rawOrEncryptedSecret: string | null | undefined
): WebhookSecretResolution {
  if (!rawOrEncryptedSecret || typeof rawOrEncryptedSecret !== 'string') {
    return { ok: true, secret: null }
  }

  const trimmed = rawOrEncryptedSecret.trim()
  if (!trimmed) {
    return { ok: true, secret: null }
  }

  if (isCredentialEncrypted(trimmed)) {
    const decrypted = decryptCredential(trimmed)
    if (!decrypted) {
      return {
        ok: false,
        secret: null,
        error: 'Webhook secret is encrypted but failed decryption (MAC/key failure or malformed envelope)',
      }
    }
    return { ok: true, secret: decrypted }
  }

  return { ok: true, secret: trimmed }
}

/**
 * Computes HMAC-SHA256 signature for merchant webhook payload.
 * Base string: `<timestamp>.<raw-json-body>`
 */
export function generateWebhookSignature(
  rawBody: string,
  secret: string,
  timestamp: number
): string {
  const baseString = `${timestamp}.${rawBody}`
  return crypto.createHmac('sha256', secret).update(baseString).digest('hex')
}

/**
 * Dispatches an event to the merchant's configured webhook URL,
 * creates an audit record in WebhookLog, and schedules retry if failed.
 */
export const STANDARD_BACKOFF_DELAYS_MS = [
  60 * 1000,        // 1 min
  5 * 60 * 1000,    // 5 min
  15 * 60 * 1000,   // 15 min
  60 * 60 * 1000,   // 1 hour
  6 * 60 * 60 * 1000 // 6 hours
]

export const DECRYPT_FAILURE_BACKOFF_DELAYS_MS = [
  60 * 1000,          // 1 min
  5 * 60 * 1000,      // 5 min
  15 * 60 * 1000,     // 15 min
  60 * 60 * 1000,     // 1 hour
  6 * 60 * 60 * 1000,  // 6 hours
  12 * 60 * 60 * 1000, // 12 hours
  24 * 60 * 60 * 1000, // 24 hours (extends total recovery window to ~43.5 hours)
]

export async function forwardToClientWebhook(
  clientId: string,
  webhookUrl: string,
  webhookSecret: string | null,
  payload: WebhookPayload,
  attemptNumber = 1
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  if (!webhookUrl) {
    return { success: false, error: 'No webhookUrl configured' }
  }

  const eventId = `evt_${crypto.randomBytes(16).toString('hex')}`
  const timestamp = Math.floor(Date.now() / 1000)
  const bodyStr = JSON.stringify(payload)

  const secretResolution = resolveWebhookSigningSecret(webhookSecret)
  if (!secretResolution.ok) {
    console.error(
      `[SECURITY ALERT] [webhookService] Webhook secret resolution failed for merchant ${clientId}: ${secretResolution.error}. Recording failed delivery and scheduling extended retry.`
    )
    const nextAttemptAt =
      attemptNumber <= DECRYPT_FAILURE_BACKOFF_DELAYS_MS.length
        ? new Date(Date.now() + DECRYPT_FAILURE_BACKOFF_DELAYS_MS[attemptNumber - 1])
        : null

    try {
      await db.webhookLog.create({
        data: {
          clientId,
          url: webhookUrl,
          event: payload.event,
          eventId,
          payload: bodyStr,
          statusCode: 500,
          response: `Webhook signing error: ${secretResolution.error}`,
          isSuccess: false,
          attempt: attemptNumber,
          nextAttemptAt,
        },
      })
    } catch (dbErr) {
      console.error('[webhook] Failed to write WebhookLog record:', dbErr)
    }

    return { success: false, statusCode: 500, error: secretResolution.error }
  }

  const urlCheck = await validateWebhookUrlDns(webhookUrl)
  if (!urlCheck.valid) {
    console.warn(`[webhook] Blocked SSRF attempt to ${webhookUrl}: ${urlCheck.error}`)
    return { success: false, error: `Invalid webhookUrl: ${urlCheck.error}` }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'InstaPay-Gateway-Webhook/2.0',
    'X-Instapay-Event-Id': eventId,
    'X-Instapay-Timestamp': timestamp.toString(),
    'X-Instapay-Signature-Version': 'v1',
  }

  if (secretResolution.secret) {
    const signature = generateWebhookSignature(bodyStr, secretResolution.secret, timestamp)
    headers['X-Instapay-Signature'] = `v1=${signature}`
  }

  let statusCode: number | null = null
  let responseBody: string | null = null
  let isSuccess = false

  try {
    const customLookup = createPinnedDnsLookup(urlCheck.pinnedIp)
    const httpAgent = new http.Agent({ lookup: customLookup })
    const httpsAgent = new https.Agent({ lookup: customLookup })

    const res = await axios.post(webhookUrl, bodyStr, {
      headers,
      timeout: 10000, // 10 second timeout
      maxRedirects: 0, // Strict SSRF defense: never follow redirects
      validateStatus: () => true, // capture all status codes
      httpAgent,
      httpsAgent,
    })

    statusCode = res.status
    responseBody = typeof res.data === 'string' ? res.data.slice(0, 2048) : JSON.stringify(res.data).slice(0, 2048)
    isSuccess = statusCode >= 200 && statusCode < 300
  } catch (err: unknown) {
    const error = err as Error
    responseBody = error.message.slice(0, 1024)
    isSuccess = false
  }

  // Calculate next retry timestamp using exponential backoff:
  // attempt 1: 1 min, attempt 2: 5 min, attempt 3: 15 min, attempt 4: 1 hr, attempt 5: 6 hrs
  const nextAttemptAt =
    !isSuccess && attemptNumber <= STANDARD_BACKOFF_DELAYS_MS.length
      ? new Date(Date.now() + STANDARD_BACKOFF_DELAYS_MS[attemptNumber - 1])
      : null

  try {
    await db.webhookLog.create({
      data: {
        clientId,
        url: webhookUrl,
        event: payload.event,
        eventId,
        payload: bodyStr,
        statusCode,
        response: responseBody,
        isSuccess,
        attempt: attemptNumber,
        nextAttemptAt,
      },
    })
  } catch (dbErr) {
    console.error('[webhook] Failed to write WebhookLog record:', dbErr)
  }

  return { success: isSuccess, statusCode: statusCode ?? undefined, error: isSuccess ? undefined : responseBody ?? 'Failed' }
}
