import { db } from '../db.js'
import { expirePendingTransactions } from './transactionExpiryService.js'

export const MOBILE_PAYMENT_STATUSES: Record<string, string[]> = {
  ALL: [], PENDING: ['PENDING'], CONFIRMED: ['CONFIRMED'],
  OVERPAID: ['OVERPAID'], UNDERPAID: ['UNDERPAID'],
  LATE_EXPIRED: ['EXPIRED', 'EXPIRED_PAID', 'LATE_PAYMENT'],
  UNMATCHED: ['UNMATCHED'], RISK_REVIEW: ['HIGH_VALUE_REVIEW', 'REVIEW'],
  DUPLICATE_SUSPECT: ['DUPLICATE_SUSPECT'], SENDER_MISMATCH: ['HANDLE_MISMATCH'],
  FAILED: ['FAILED', 'REJECTED'],
}

type FeedCursor = { at: string; id: string; source: 'checkout' | 'unmatched' }
export function decodePaymentCursor(value: string): FeedCursor {
  if (value.length > 600) throw new Error('Invalid cursor')
  const cursor = JSON.parse(Buffer.from(value, 'base64url').toString()) as FeedCursor
  if (!cursor || !['checkout', 'unmatched'].includes(cursor.source) || typeof cursor.id !== 'string' || !/^[\w-]{1,128}$/.test(cursor.id) || typeof cursor.at !== 'string' || !Number.isFinite(Date.parse(cursor.at))) throw new Error('Invalid cursor')
  return cursor
}

export async function listMobilePayments(clientId: string, status: string, search: string, limit: number, cursor?: FeedCursor) {
  const statusCodes = Object.hasOwn(MOBILE_PAYMENT_STATUSES, status) ? MOBILE_PAYMENT_STATUSES[status] : undefined
  if (!statusCodes) throw new Error('Invalid status')
  await expirePendingTransactions(clientId)
  const cursorWhere = (source: FeedCursor['source']) => cursor ? { OR: [
    { createdAt: { lt: new Date(cursor.at) } },
    { createdAt: new Date(cursor.at), id: source < cursor.source ? { lte: cursor.id } : { lt: cursor.id } },
  ] } : {}
  const text = (fields: string[]) => search ? { OR: fields.map(field => ({ [field]: { contains: search, mode: 'insensitive' } })) } : {}
  const [transactions, unmatched] = await Promise.all([
    status === 'UNMATCHED' ? [] : db.transaction.findMany({
      where: { clientId, ...(status !== 'ALL' ? { status: { in: statusCodes } } : {}), AND: [cursorWhere('checkout'), text(['senderHandle', 'sessionId', 'detectedRef'])] },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit + 1,
      select: { id: true, sessionId: true, senderHandle: true, amountEgp: true, detectedAmountEgp: true, status: true, createdAt: true, expiresAt: true, detectedRef: true, note: true, productCategory: true },
    }),
    status !== 'ALL' && status !== 'UNMATCHED' ? [] : db.mismatchedPayment.findMany({
      where: { clientId, status: 'UNMATCHED', AND: [cursorWhere('unmatched'), text(['senderHandle', 'reference', 'id'])] },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit + 1,
      select: { id: true, senderHandle: true, amountEgp: true, reference: true, createdAt: true },
    }),
  ])
  const rows = [
    ...transactions.map(row => ({ ...row, source: 'checkout' as const, expectedAmountEgp: row.amountEgp, receivedAmountEgp: row.detectedAmountEgp })),
    ...unmatched.map(row => ({ id: row.id, source: 'unmatched' as const, sessionId: '', senderHandle: row.senderHandle, amountEgp: row.amountEgp, expectedAmountEgp: null, receivedAmountEgp: row.amountEgp, status: 'UNMATCHED', createdAt: row.createdAt, expiresAt: null, detectedRef: row.reference, note: null })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : a.id > b.id ? -1 : a.source < b.source ? 1 : a.source > b.source ? -1 : 0))
  const payments = rows.slice(0, limit)
  const last = payments.at(-1)
  return { payments, nextCursor: rows.length > limit && last ? Buffer.from(JSON.stringify({ at: last.createdAt.toISOString(), id: last.id, source: last.source })).toString('base64url') : null }
}
