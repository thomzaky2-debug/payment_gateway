import { expirePendingTransactions } from '../services/transactionExpiryService.js'

let interval: ReturnType<typeof setInterval> | null = null
let running = false

async function runExpiryCycle() {
  if (running) return
  running = true
  try {
    const result = await expirePendingTransactions()
    if (result.count) console.info(`[transaction-expiry] Expired ${result.count} overdue pending checkouts`)
  } catch (error) {
    console.error('[transaction-expiry] Failed to expire overdue checkouts:', error)
  } finally { running = false }
}

export function startTransactionExpiryWorker(intervalMs = 60_000) {
  if (interval) return
  void runExpiryCycle()
  interval = setInterval(() => { void runExpiryCycle() }, intervalMs)
  interval.unref()
}

export function stopTransactionExpiryWorker() {
  if (interval) clearInterval(interval)
  interval = null
}
