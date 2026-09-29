import axios from 'axios'
import { db } from '../db.js'
import { generateWebhookSignature } from '../services/webhookService.js'

let workerInterval: NodeJS.Timeout | null = null
let isProcessing = false

const BACKOFF_DELAYS_MS = [
  60 * 1000,        // 1 min
  5 * 60 * 1000,    // 5 min
  15 * 60 * 1000,   // 15 min
  60 * 60 * 1000,   // 1 hour
  6 * 60 * 60 * 1000 // 6 hours
]

/**
 * Retries a single failed webhook delivery record
 */
async function retrySingleWebhook(log: {
  id: string
  clientId: string
  url: string
  payload: string
  attempt: number
  client: { webhookSecret: string | null }
}) {
  const nextAttemptNumber = log.attempt + 1
  const timestamp = Math.floor(Date.now() / 1000)
  const eventId = `retry_${log.id.slice(-8)}_${nextAttemptNumber}`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'InstaPay-Gateway-Webhook-Retry/2.0',
    'X-Instapay-Event-Id': eventId,
    'X-Instapay-Timestamp': timestamp.toString(),
    'X-Instapay-Signature-Version': 'v1',
    'X-Instapay-Retry-Count': nextAttemptNumber.toString(),
  }

  if (log.client.webhookSecret) {
    const signature = generateWebhookSignature(log.payload, log.client.webhookSecret, timestamp)
    headers['X-Instapay-Signature'] = `v1=${signature}`
  }

  let statusCode: number | null = null
  let responseBody: string | null = null
  let isSuccess = false

  try {
    const res = await axios.post(log.url, log.payload, {
      headers,
      timeout: 10000,
      validateStatus: () => true,
    })

    statusCode = res.status
    responseBody = typeof res.data === 'string' ? res.data.slice(0, 2048) : JSON.stringify(res.data).slice(0, 2048)
    isSuccess = statusCode >= 200 && statusCode < 300
  } catch (err: unknown) {
    const error = err as Error
    responseBody = error.message.slice(0, 1024)
    isSuccess = false
  }

  const nextAttemptAt =
    !isSuccess && nextAttemptNumber <= BACKOFF_DELAYS_MS.length
      ? new Date(Date.now() + BACKOFF_DELAYS_MS[nextAttemptNumber - 1])
      : null

  await db.webhookLog.update({
    where: { id: log.id },
    data: {
      attempt: nextAttemptNumber,
      statusCode,
      response: responseBody,
      isSuccess,
      nextAttemptAt,
    },
  })

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
    const now = new Date()
    const dueLogs = await db.webhookLog.findMany({
      where: {
        isSuccess: false,
        nextAttemptAt: { lte: now },
        attempt: { lt: 6 }, // Max 5 retries
      },
      include: {
        client: {
          select: { webhookSecret: true },
        },
      },
      take: 20, // Batch limit per cycle
    })

    if (dueLogs.length > 0) {
      console.log(`[Webhook Worker] Found ${dueLogs.length} pending webhooks to retry`)
      for (const log of dueLogs) {
        await retrySingleWebhook(log).catch((err) => {
          console.error(`[Webhook Worker] Error retrying log ${log.id}:`, err)
        })
      }
    }
  } catch (err) {
    console.error('[Webhook Worker] Cycle error:', err)
  } finally {
    isProcessing = false
  }
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
