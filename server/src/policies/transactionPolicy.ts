export interface ReviewableTransaction {
  purpose: string
  subscriptionPlanName?: string | null
  status: string
  detectedAmountEgp?: number | null
}

export const MERCHANT_REVIEW_STATES = new Set([
  'UNDERPAID',
  'OVERPAID',
  'EXPIRED',
  'EXPIRED_PAID',
  'LATE_PAYMENT',
  'HANDLE_MISMATCH',
  'DUPLICATE_SUSPECT',
  'HIGH_VALUE_REVIEW',
  'REVIEW',
])

export function canMerchantResolveTransaction(transaction: ReviewableTransaction): boolean {
  if (transaction.purpose !== 'CHECKOUT' || transaction.subscriptionPlanName) return false
  if (!MERCHANT_REVIEW_STATES.has(transaction.status)) return false
  if (transaction.status === 'EXPIRED' && transaction.detectedAmountEgp == null) return false
  return true
}
