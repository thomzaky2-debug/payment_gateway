import axios from 'axios'
import http from 'http'
import https from 'https'
import { db } from '../db.js'
import {
  generateWebhookSignature,
  resolveWebhookSigningSecret,
  STANDARD_BACKOFF_DELAYS_MS,
  DECRYPT_FAILURE_BACKOFF_DELAYS_MS,
} from '../services/webhookService.js'
import { validateWebhookUrlDns, createPinnedDnsLookup } from '../lib/urlValidator.js'

let workerInterval: NodeJS.Timeout | null = null
let isProcessing = false

/**
 * Retries a single failed webhook delivery record
 */
async function retrySingleWebhook(log: {
  id: string
  clientId: string
  url: string
  event?: string
  payload: string
  attempt: number
  eventId?: string | null
  deliveryLockedUntil?: Date | null
  client: { webhookSecret: string | null }
}) {
  const nextAttemptNumber = log.attempt + 1
  const timestamp = Math.floor(Date.now() / 1000)
  // Retries represent the same event. Keep this stable so merchant-side
  // idempotency keyed by X-Instapay-Event-Id remains effective.
  const eventId = log.eventId || `evt_${log.id}`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'InstaPay-Gateway-Webhook-Retry/2.0',
    'X-Instapay-Event-Id': eventId,
    'X-Instapay-Timestamp': timestamp.toString(),
    'X-Instapay-Signature-Version': 'v1',
    'X-Instapay-Retry-Count': nextAttemptNumber.toString(),
  }

  const secretResolution = resolveWebhookSigningSecret(log.client.webhookSecret)
  if (!secretResolution.ok) {
    console.error(
      `[SECURITY ALERT] [webhookRetryWorker] Failed to resolve webhookSecret for retry ${log.id}: ${secretResolution.error}. Aborting retry to prevent unsigned payload.`
    )
    const nextAttemptAt =
      nextAttemptNumber <= DECRYPT_FAILURE_BACKOFF_DELAYS_MS.length
        ? new Date(Date.now() + DECRYPT_FAILURE_BACKOFF_DELAYS_MS[nextAttemptNumber - 1])
        : null

    await db.webhookLog.update({
      where: { id: log.id },
      data: {
        attempt: nextAttemptNumber,
        statusCode: 500,
        response: secretResolution.error || 'Decryption failed for webhookSecret',
        isSuccess: false,
        nextAttemptAt,
        deliveryLockedUntil: null,
        outcomeKnown: true,
      },
    })

    if (!nextAttemptAt) {
      console.error(
        `[SECURITY ALERT] [webhookRetryWorker] Webhook delivery permanently exhausted all retries on secret resolution failure for log ${log.id} (client ${log.clientId}, url ${log.url}, event ${log.event || 'unknown'}). Manual key repair and resend required.`
      )
    }
    return
  }

  if (secretResolution.secret) {
    const signature = generateWebhookSignature(log.payload, secretResolution.secret, timestamp)
    headers['X-Instapay-Signature'] = `v1=${signature}`
  }

  let statusCode: number | null = null
  let responseBody: string | null = null
  let isSuccess = false

  // SSRF defense: validate destination and prevent DNS rebinding
  const urlCheck = await validateWebhookUrlDns(log.url)
  if (!urlCheck.valid) {
    statusCode = 400
    responseBody = `SSRF protection: ${urlCheck.error || 'Destination forbidden'}`
    isSuccess = false
  } else {
    try {
      const customLookup = createPinnedDnsLookup(urlCheck.pinnedIp)
      const httpAgent = new http.Agent({ lookup: customLookup })
      const httpsAgent = new https.Agent({ lookup: customLookup })

      const res = await axios.post(log.url, log.payload, {
        headers,
        timeout: 10000,
        maxRedirects: 0,
        validateStatus: () => true,
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
  }

  const nextAttemptAt =
    !isSuccess && nextAttemptNumber <= STANDARD_BACKOFF_DELAYS_MS.length
      ? new Date(Date.now() + STANDARD_BACKOFF_DELAYS_MS[nextAttemptNumber - 1])
      : null

  await db.webhookLog.update({
    where: { id: log.id },
    data: {
      attempt: nextAttemptNumber,
      statusCode,
      response: responseBody,
      isSuccess,
      nextAttemptAt,
      deliveryLockedUntil: null,
      outcomeKnown: true,
    },
  })

  if (!isSuccess && !nextAttemptAt) {
    console.error(
      `[SECURITY ALERT] [webhookRetryWorker] Webhook delivery permanently exhausted all retries for log ${log.id} (client ${log.clientId}, url ${log.url}, event ${log.event || 'unknown'}). Manual resend required.`
    )
  }

  console.log(
    `[Webhook Worker] Retried log ${log.id} (attempt ${nextAttemptNumber}) to ${log.url} -> ${
      isSuccess ? 'SUCCESS' : `FAILED (${statusCode || responseBody})`
    }`
  )
}

/**
 * Polls for failed webhooks due for retry
 */
export async function processDueWebhookRetries() {
  if (isProcessing) return
  isProcessing = true

  try {
    while (true) {
      const now = new Date()
      const dueLogs = await db.webhookLog.findMany({
        where: {
          isSuccess: false,
          outcomeKnown: true,
          nextAttemptAt: { lte: now },
          attempt: { lt: DECRYPT_FAILURE_BACKOFF_DELAYS_MS.length + 1 }, // Supports extended recovery window
        },
        include: {
          client: {
            select: { webhookSecret: true },
          },
        },
        take: 20,
      })

      if (dueLogs.length === 0) break
      console.log(`[Webhook Worker] Found ${dueLogs.length} pending webhooks to retry`)
      let claimedCount = 0
      for (const log of dueLogs) {
        // The query above is only a candidate list. Atomically claim each row
        // so another app instance or a manual resend cannot send it too.
        const now = new Date()
        const claim = await db.webhookLog.updateMany({
          where: {
            id: log.id,
            isSuccess: false,
            outcomeKnown: true,
            nextAttemptAt: { lte: now },
            OR: [
              { deliveryLockedUntil: null },
              { deliveryLockedUntil: { lte: now } },
            ],
          },
          data: {
            deliveryLockedUntil: new Date(now.getTime() + 60_000),
            deliveryStartedAt: now,
            outcomeKnown: false,
          },
        })
        if (claim.count !== 1) continue
        claimedCount += 1

        await retrySingleWebhook(log).catch((err) => {
          console.error(`[Webhook Worker] Error retrying log ${log.id}:`, err)
        })
      }
      // A full page may consist entirely of rows another worker currently
      // holds. Stop instead of repeatedly querying the same locked rows.
      if (dueLogs.length < 20 || claimedCount === 0) break
    }
  } catch (err) {
    console.error('[Webhook Worker] Cycle error:', err)
  } finally {
    isProcessing = false
  }
}

/** Process newly committed outbox rows without waiting for the poll interval. */
export function kickWebhookWorker() {
  void processDueWebhookRetries()
}

/**
 * Starts the automated background webhook retry worker
 */
export function startWebhookRetryWorker(intervalMs = 30000) {
  if (workerInterval) return
  console.log(`[Webhook Worker] Started background retry worker (interval: ${intervalMs}ms)`)
  workerInterval = setInterval(() => {
    void processDueWebhookRetries()
  }, intervalMs)
}

/**
 * Stops the background worker
 */
export function stopWebhookRetryWorker() {
  if (workerInterval) {
    clearInterval(workerInterval)
    workerInterval = null
    console.log('[Webhook Worker] Stopped background retry worker')
  }
}
