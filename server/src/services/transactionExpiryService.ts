import { db } from '../db.js'

/** Conditional updates never overwrite confirmations or manual-review outcomes. */
export async function expirePendingTransactions(clientId?: string, now = new Date(), transactionId?: string) {
  return db.transaction.updateMany({
    where: { status: 'PENDING', expiresAt: { lte: now }, ...(clientId ? { clientId } : {}), ...(transactionId ? { id: transactionId } : {}) },
    data: { status: 'EXPIRED' },
  })
}
