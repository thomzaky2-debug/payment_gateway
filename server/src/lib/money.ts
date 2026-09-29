/**
 * Money and Currency Utilities for Egyptian Pound (EGP)
 *
 * Always stores amounts in integer cents (piastres) to eliminate floating-point arithmetic errors.
 */

export function toEgpCents(amount: number): number {
  if (!Number.isFinite(amount)) return 0
  return Math.round(amount * 100)
}

export function fromEgpCents(cents: number | null | undefined): number | null {
  if (cents == null || !Number.isFinite(cents)) return null
  return cents / 100
}

export function egpAmountFromRow(row: {
  amountCents?: number | null
  amountEgp: number
}): number {
  if (row.amountCents != null) {
    const val = fromEgpCents(row.amountCents)
    if (val != null) return val
  }
  return row.amountEgp
}
