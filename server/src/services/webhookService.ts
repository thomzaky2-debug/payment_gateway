import http from 'http'
import https from 'https'
import net from 'net'
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

  const urlCheck = await validateWebhookUrlDns(webhookUrl)
  if (!urlCheck.valid) {
    console.warn(`[webhook] Blocked SSRF attempt to ${webhookUrl}: ${urlCheck.error}`)
    return { success: false, error: `Invalid webhookUrl: ${urlCheck.error}` }
  }

  const eventId = `evt_${crypto.randomBytes(16).toString('hex')}`
  const timestamp = Math.floor(Date.now() / 1000)
  const bodyStr = JSON.stringify(payload)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'InstaPay-Gateway-Webhook/2.0',
    'X-Instapay-Event-Id': eventId,
    'X-Instapay-Timestamp': timestamp.toString(),
    'X-Instapay-Signature-Version': 'v1',
  }

  let resolvedSecret = webhookSecret
  if (webhookSecret && isCredentialEncrypted(webhookSecret)) {
    resolvedSecret = decryptCredential(webhookSecret)
    if (!resolvedSecret) {
      console.error(
        `[SECURITY ALERT] [webhookService] Failed to decrypt webhookSecret for merchant ${clientId}. Aborting delivery to prevent unsigned payload.`
      )
      return { success: false, error: 'Webhook secret decryption failed' }
    }
  }

  if (resolvedSecret) {
    const signature = generateWebhookSignature(bodyStr, resolvedSecret, timestamp)
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
  const backoffDelaysMs = [60 * 1000, 5 * 60 * 1000, 15 * 60 * 1000, 60 * 60 * 1000, 6 * 60 * 60 * 1000]
  const nextAttemptAt =
    !isSuccess && attemptNumber <= backoffDelaysMs.length
      ? new Date(Date.now() + backoffDelaysMs[attemptNumber - 1])
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
