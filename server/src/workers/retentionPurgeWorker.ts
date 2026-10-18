import { runDailyRetentionPurge } from '../services/accountService.js'

let retentionInterval: ReturnType<typeof setInterval> | null = null

/**
 * Starts the daily retention purge worker.
 *
 * On each tick it:
 *  1. Completes deferred public deletions whose 72-hour grace period has elapsed.
 *  2. Deletes financial rows (Transaction, IncomingPaymentEvent, MismatchedPayment, WebhookLog)
 *     for fully-deleted merchants that are older than ACCOUNT_RECORD_RETENTION_DAYS
 *     (default 1825 days / 5 years, overridable via the environment variable).
 *
 * @param intervalMs How often to run, in milliseconds. Default: 24 hours.
 * @param nowOverride Optional date override for deterministic testing.
 */
export function startRetentionPurgeWorker(
  intervalMs = 24 * 60 * 60 * 1000,
  nowOverride?: Date
): void {
  if (retentionInterval) return

  // Run immediately on startup so deferred deletions are not delayed by one full cycle.
  void runDailyRetentionPurge(nowOverride).catch((err) =>
    console.error('[retention-purge] Initial run error:', err)
  )

  retentionInterval = setInterval(() => {
    void runDailyRetentionPurge().catch((err) =>
      console.error('[retention-purge] Worker error:', err)
    )
  }, intervalMs)

  retentionInterval.unref()
  console.log(
    `[retention-purge] Worker started — runs every ${Math.round(intervalMs / (60 * 60 * 1000))} hour(s)`
  )
}

export function stopRetentionPurgeWorker(): void {
  if (retentionInterval) {
    clearInterval(retentionInterval)
    retentionInterval = null
    console.log('[retention-purge] Worker stopped')
  }
}

/**
 * Exposed for testing: run one cycle synchronously using an optional fake clock.
 */
export async function runRetentionPurgeCycle(nowOverride?: Date): Promise<{
  deferredDeletionsCompleted: number
  retentionRowsAnonymized: number
}> {
  return runDailyRetentionPurge(nowOverride)
}
