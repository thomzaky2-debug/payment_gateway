import assert from 'node:assert/strict'
import test from 'node:test'
import { db } from '../db.js'
import { expirePendingTransactions } from './transactionExpiryService.js'
import { getCheckoutSession } from './checkoutService.js'

test('expiry is merchant-scoped and only changes overdue PENDING rows', async (t) => {
  const original = db.transaction.updateMany
  t.after(() => { ;(db.transaction as any).updateMany = original })
  const now = new Date('2026-10-27T20:00:00Z')
  ;(db.transaction as any).updateMany = async (query: any) => {
    assert.deepEqual(query, {
      where: { clientId: 'merchant', status: 'PENDING', expiresAt: { lte: now } },
      data: { status: 'EXPIRED' },
    })
    return { count: 6 }
  }
  assert.equal((await expirePendingTransactions('merchant', now)).count, 6)
})

test('an expired checkout read persists expiry and returns the saved status', async (t) => {
  const find = db.transaction.findUnique
  const update = db.transaction.updateMany
  t.after(() => { ;(db.transaction as any).findUnique = find; (db.transaction as any).updateMany = update })
  let status = 'PENDING'
  ;(db.transaction as any).findUnique = async () => ({ id: 'checkout', sessionId: 'session', clientId: 'merchant', status, expiresAt: new Date(0), client: { businessName: 'Merchant' } })
  ;(db.transaction as any).updateMany = async ({ where, data }: any) => {
    assert.equal(where.id, 'checkout')
    assert.equal(where.status, 'PENDING')
    assert.equal(where.clientId, 'merchant')
    status = data.status
    return { count: 1 }
  }
  assert.equal((await getCheckoutSession('session'))?.status, 'EXPIRED')
  assert.equal(status, 'EXPIRED')
})

test('a confirmation winning the race is returned instead of a synthetic EXPIRED status', async (t) => {
  const find = db.transaction.findUnique
  const update = db.transaction.updateMany
  t.after(() => { ;(db.transaction as any).findUnique = find; (db.transaction as any).updateMany = update })
  let reads = 0
  ;(db.transaction as any).findUnique = async () => ({ id: 'checkout', sessionId: 'session', clientId: 'merchant', status: ++reads === 1 ? 'PENDING' : 'CONFIRMED', expiresAt: new Date(0), client: { businessName: 'Merchant' } })
  ;(db.transaction as any).updateMany = async () => ({ count: 0 })
  assert.equal((await getCheckoutSession('session'))?.status, 'CONFIRMED')
})
