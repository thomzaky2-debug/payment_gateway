import assert from 'node:assert/strict'
import test from 'node:test'
import { db } from '../db.js'
import { decodePaymentCursor, listMobilePayments, MOBILE_PAYMENT_STATUSES } from './mobilePaymentService.js'

test('mobile payment feed merges real unmatched records, paginates and scopes both sources to the merchant', async (t) => {
  const originalExpiry = db.transaction.updateMany
  ;(db.transaction as any).updateMany = async ({ where }: any) => {
    assert.equal(where.clientId, 'merchant-only')
    assert.equal(where.status, 'PENDING')
    assert.ok(where.expiresAt.lte instanceof Date)
    return { count: 0 }
  }
  t.after(() => { ;(db.transaction as any).updateMany = originalExpiry })
  const txFind = db.transaction.findMany
  const unmatchedFind = db.mismatchedPayment.findMany
  const newer = { id: 'checkout-new', sessionId: 'session-new', senderHandle: 'sender', amountEgp: 100, detectedAmountEgp: 120, status: 'OVERPAID', createdAt: new Date('2026-10-27T10:00:00Z'), expiresAt: new Date(), detectedRef: 'bank-ref', note: null }
  const older = { ...newer, id: 'checkout-old', createdAt: new Date('2026-10-27T08:00:00Z'), status: 'UNDERPAID', detectedAmountEgp: 80 }
  const unmatched = { id: 'unmatched-row', senderHandle: 'unknown@instapay', amountEgp: 75, reference: 'unmatched-ref', createdAt: new Date('2026-10-27T09:00:00Z') }
  let afterCursor = false
  ;(db.transaction as any).findMany = async ({ where, take }: any) => {
    assert.equal(where.clientId, 'merchant-only')
    assert.equal(take, 3)
    if (afterCursor) {
      assert.equal(where.AND[0].OR[0].createdAt.lt.toISOString(), unmatched.createdAt.toISOString())
      return [older]
    }
    return [newer, older]
  }
  ;(db.mismatchedPayment as any).findMany = async ({ where }: any) => {
    assert.equal(where.clientId, 'merchant-only')
    assert.equal(where.status, 'UNMATCHED')
    return afterCursor ? [] : [unmatched]
  }
  try {
    const first = await listMobilePayments('merchant-only', 'ALL', '', 2)
    assert.deepEqual(first.payments.map(row => row.id), ['checkout-new', 'unmatched-row'])
    assert.equal(first.payments[0].expectedAmountEgp, 100)
    assert.equal(first.payments[0].receivedAmountEgp, 120)
    assert.equal(first.payments[1].status, 'UNMATCHED')
    assert.equal(first.payments[1].expectedAmountEgp, null)
    assert.equal(first.payments[1].receivedAmountEgp, 75)
    assert.ok(first.nextCursor)
    afterCursor = true
    const next = await listMobilePayments('merchant-only', 'ALL', '', 2, decodePaymentCursor(first.nextCursor!))
    assert.deepEqual(next.payments.map(row => row.id), ['checkout-old'])
    assert.equal(next.nextCursor, null)
  } finally {
    ;(db.transaction as any).findMany = txFind
    ;(db.mismatchedPayment as any).findMany = unmatchedFind
  }
})

test('risk, late and sender filters retain all server states and apply search in the database', async (t) => {
  const originalExpiry = db.transaction.updateMany
  ;(db.transaction as any).updateMany = async () => ({ count: 0 })
  t.after(() => { ;(db.transaction as any).updateMany = originalExpiry })
  assert.deepEqual(MOBILE_PAYMENT_STATUSES.RISK_REVIEW, ['HIGH_VALUE_REVIEW', 'REVIEW'])
  assert.deepEqual(MOBILE_PAYMENT_STATUSES.LATE_EXPIRED, ['EXPIRED', 'EXPIRED_PAID', 'LATE_PAYMENT'])
  assert.deepEqual(MOBILE_PAYMENT_STATUSES.SENDER_MISMATCH, ['HANDLE_MISMATCH'])
  const original = db.transaction.findMany
  ;(db.transaction as any).findMany = async ({ where }: any) => {
    assert.equal(where.clientId, 'merchant-only')
    assert.deepEqual(where.status.in, ['HIGH_VALUE_REVIEW', 'REVIEW'])
    assert.equal(where.AND[1].OR[2].detectedRef.contains, 'bank-reference')
    return []
  }
  try {
    assert.deepEqual((await listMobilePayments('merchant-only', 'RISK_REVIEW', 'bank-reference', 30)).payments, [])
    await assert.rejects(listMobilePayments('merchant-only', 'constructor', '', 30))
  } finally { ;(db.transaction as any).findMany = original }
})

test('malformed mobile cursors are rejected', () => {
  for (const input of ['invalid', Buffer.from(JSON.stringify({ at: 'bad-date', id: 'row', source: 'checkout' })).toString('base64url'), 'x'.repeat(601)]) {
    assert.throws(() => decodePaymentCursor(input))
  }
})
