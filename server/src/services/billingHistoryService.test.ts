import assert from 'node:assert/strict'
import test from 'node:test'
import { db } from '../db.js'
import { getBillingHistory, hasUsedTrial } from './billingHistoryService.js'
import { activateFreeTrial } from '../routes/planRoutes.js'
function mockMethod(t: any, delegate: any, name: string, implementation: any) {
  const original = delegate[name]
  delegate[name] = implementation
  t.after(() => { delegate[name] = original })
}


const eligible = { id: 'merchant', trialRedeemedAt: null, subscriptionEndsAt: null, subscriptionPlan: 'FREE_TRIAL', isFreeTrial: true }

test('billing history is tenant-scoped, paginated, uses checkout price snapshots and never treats overdue orders as paid', async t => {
  mockMethod(t, db.transaction, 'findMany', async (query: any) => {
    assert.deepEqual(query.where, { clientId: 'merchant', purpose: 'SUBSCRIPTION' })
    assert.equal(query.skip, 25)
    assert.equal(query.take, 25)
    assert.equal(query.select.deepLinkToken, undefined)
    return [
      { id: 'plan', subscriptionPlanName: 'BASIC', amountEgp: 99, status: 'CONFIRMED', expiresAt: new Date(0) },
      { id: 'bundle', subscriptionPlanName: 'BUNDLE:STARTER', amountEgp: 49, status: 'PENDING', expiresAt: new Date(0) },
    ]
  })
  mockMethod(t, db.transaction, 'count', async (query: any) => {
    assert.deepEqual(query.where, { clientId: 'merchant', purpose: 'SUBSCRIPTION' })
    return 51
  })
  const result = await getBillingHistory(eligible, 2)
  assert.equal(result.purchases[0].kind, 'PLAN')
  assert.equal(result.purchases[0].amountEgp, 99)
  assert.equal(result.purchases[0].status, 'CONFIRMED')
  assert.equal(result.purchases[1].kind, 'BUNDLE')
  assert.equal(result.purchases[1].status, 'EXPIRED')
  assert.equal(result.hasMore, true)
  assert.equal(result.trial.used, false)
})

test('trial eligibility remains consumed after expiry, upgrade, or resetting only the expiry', () => {
  assert.equal(hasUsedTrial(eligible), false)
  assert.equal(hasUsedTrial({ ...eligible, trialRedeemedAt: new Date(0) }), true)
  assert.equal(hasUsedTrial({ ...eligible, subscriptionEndsAt: new Date(0) }), true)
  assert.equal(hasUsedTrial({ ...eligible, subscriptionPlan: 'BASIC', isFreeTrial: false }), true)
})

test('concurrent trial activation grants quota once and stale repeat requests cannot reset quota', async t => {
  let claimed = false
  let grants = 0
  mockMethod(t, db.plan, 'findUnique', async () => ({ name: 'FREE_TRIAL', isActive: true, periodDays: 14, maxTransactions: 20 }))
  mockMethod(t, db.client, 'updateMany', async ({ where, data }: any) => {
    assert.deepEqual(where, { id: 'merchant', trialRedeemedAt: null, subscriptionEndsAt: null, subscriptionPlan: 'FREE_TRIAL', isFreeTrial: true })
    assert.ok(data.trialRedeemedAt instanceof Date)
    assert.equal(data.txCount, 0)
    if (claimed) return { count: 0 }
    claimed = true
    grants++
    return { count: 1 }
  })
  mockMethod(t, db.client, 'findUniqueOrThrow', async () => ({ ...eligible, trialRedeemedAt: new Date(), txCount: 0 }))
  const results = await Promise.allSettled([activateFreeTrial(eligible), activateFreeTrial(eligible)])
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  assert.equal(results.filter(r => r.status === 'rejected').length, 1)
  await assert.rejects(activateFreeTrial(eligible), /already utilized/)
  assert.equal(grants, 1)
})
