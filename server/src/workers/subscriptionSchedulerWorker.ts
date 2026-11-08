import {
  processScheduledInvoices,
  processUpcomingInvoiceReminders,
  processOverdueInvoices,
  processPlatformSubscriptionRenewals,
} from '../services/subscriptionService.js'

let workerInterval: NodeJS.Timeout | null = null
let isCycleRunning = false

export async function runSubscriptionSchedulerCycle(now = new Date(), clientId?: string) {
  if (isCycleRunning) {
    return { skipped: true, reason: 'Previous cycle still running' }
  }

  isCycleRunning = true
  try {
    const invoicesResult = await processScheduledInvoices(now, clientId)
    const remindersCount = await processUpcomingInvoiceReminders(now, clientId)
    const overdueCount = await processOverdueInvoices(now, clientId)
    const platformRenewalsCount = await processPlatformSubscriptionRenewals(now, clientId)

    if (invoicesResult.generated > 0 || remindersCount > 0 || overdueCount > 0 || platformRenewalsCount > 0) {
      console.log(
        `[subscription-scheduler] Cycle complete: ${invoicesResult.generated} invoices generated, ${remindersCount} reminders sent, ${overdueCount} marked overdue, ${platformRenewalsCount} platform renewals processed.`
      )
    }

    return {
      skipped: false,
      invoicesGenerated: invoicesResult.generated,
      invoicesErrors: invoicesResult.errors,
      remindersSent: remindersCount,
      overdueMarked: overdueCount,
      platformRenewals: platformRenewalsCount,
    }
  } catch (err) {
    console.error('[subscription-scheduler] Error running scheduler cycle:', err)
    throw err
  } finally {
    isCycleRunning = false
  }
}

export function startSubscriptionSchedulerWorker(intervalMs = 60_000) {
  if (workerInterval) {
    return
  }

  console.log(`[subscription-scheduler] Worker starting (interval: ${intervalMs}ms)`)
  // Run first cycle shortly after boot
  setTimeout(() => {
    runSubscriptionSchedulerCycle().catch(() => {})
  }, 5000)

  workerInterval = setInterval(() => {
    runSubscriptionSchedulerCycle().catch(() => {})
  }, intervalMs)
}

export function stopSubscriptionSchedulerWorker() {
  if (workerInterval) {
    clearInterval(workerInterval)
    workerInterval = null
    console.log('[subscription-scheduler] Worker stopped')
  }
}

