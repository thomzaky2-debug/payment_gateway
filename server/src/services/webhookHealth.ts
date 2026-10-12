import { db } from '../db.js'

export interface WebhookDeliveryHealth {
  healthy: boolean
  oldestDueAgeSeconds: number
  unknownOutcomeCount: number
}

/** Returns delivery health without exposing merchant or webhook data. */
export async function getWebhookDeliveryHealth(now = new Date()): Promise<WebhookDeliveryHealth> {
  const [oldestDueWebhook, unknownOutcomeCount] = await Promise.all([
    db.webhookLog.findFirst({
      where: { isSuccess: false, outcomeKnown: true, nextAttemptAt: { lte: now } },
      orderBy: { nextAttemptAt: 'asc' },
      select: { nextAttemptAt: true },
    }),
    db.webhookLog.count({ where: { isSuccess: false, outcomeKnown: false } }),
  ])
  const oldestDueAgeMs = oldestDueWebhook?.nextAttemptAt ? now.getTime() - oldestDueWebhook.nextAttemptAt.getTime() : 0
  const oldestDueAgeSeconds = Math.max(0, Math.floor(oldestDueAgeMs / 1000))
  return {
    healthy: oldestDueAgeSeconds <= 5 * 60 && unknownOutcomeCount === 0,
    oldestDueAgeSeconds,
    unknownOutcomeCount,
  }
}
