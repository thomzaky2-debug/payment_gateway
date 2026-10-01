import { db } from '../db.js'

/**
 * Periodically purges expired and consumed OTP verification records
 * to prevent unbounded EmailVerification table growth.
 *
 * Records older than 24 hours and either consumed or expired are deleted.
 */

let cleanupInterval: ReturnType<typeof setInterval> | null = null

export function startOtpCleanupWorker(intervalMs = 60 * 60 * 1000) {
  // Run immediately on startup
  cleanupExpiredOtps().catch((err) => console.error('[otp-cleanup] Initial run error:', err))

  cleanupInterval = setInterval(async () => {
    try {
      await cleanupExpiredOtps()
    } catch (err) {
      console.error('[otp-cleanup] Worker error:', err)
    }
  }, intervalMs)

  cleanupInterval.unref()
  console.log('[otp-cleanup] Worker started — runs every', Math.round(intervalMs / 60000), 'minutes')
}

export function stopOtpCleanupWorker() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval)
    cleanupInterval = null
  }
}

async function cleanupExpiredOtps(): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago

  const result = await db.emailVerification.deleteMany({
    where: {
      OR: [
        // Consumed records older than 24h
        { consumedAt: { not: null }, createdAt: { lt: cutoff } },
        // Expired and never consumed, older than 24h
        { expiresAt: { lt: cutoff }, consumedAt: null },
      ],
    },
  })

  if (result.count > 0) {
    console.log(`[otp-cleanup] Purged ${result.count} expired OTP records`)
  }
}
