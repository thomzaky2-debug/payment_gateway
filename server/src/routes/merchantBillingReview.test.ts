import assert from 'node:assert/strict'
import { once } from 'node:events'
import test from 'node:test'
import express from 'express'
import { db } from '../db.js'
import { transactionRouter } from './transactionRoutes.js'
import { planRouter } from './planRoutes.js'
import { adminRouter } from './adminRoutes.js'
import { ownerCredentialFingerprint } from '../services/authService.js'
function mockMethod(t: any, delegate: any, name: string, implementation: any) {
  const original = delegate[name]
  delegate[name] = implementation
  t.after(() => { delegate[name] = original })
}


process.env.TOKEN_PEPPER = 'test-billing-review-pepper-at-least-32-characters'

test('merchant review shows unpaid expired checkout history separately; billing validates pages and requires authentication', async t => {
  mockMethod(t, db.authSession, 'findUnique', async () => ({ id: 'session', kind: 'MERCHANT', clientId: 'merchant', expiresAt: new Date(Date.now() + 60000), lastSeenAt: new Date(), revokedAt: null }))
  mockMethod(t, db.authSession, 'updateMany', async () => ({ count: 1 }))
  mockMethod(t, db.client, 'findUnique', async () => ({ id: 'merchant', approvalStatus: 'APPROVED', isActive: true, subscriptionPlan: 'BASIC', isFreeTrial: false }))
  mockMethod(t, db.transaction, 'updateMany', async ({ where }: any) => {
    assert.equal(where.clientId, 'merchant')
    assert.equal(where.status, 'PENDING')
    return { count: 6 }
  })
  mockMethod(t, db.mismatchedPayment, 'findMany', async ({ where }: any) => {
    assert.equal(where.clientId, 'merchant')
    return []
  })
  mockMethod(t, db.transaction, 'findMany', async ({ where }: any) => {
    assert.equal(where.clientId, 'merchant')
    assert.equal(where.purpose, 'CHECKOUT')
    assert.equal(where.subscriptionPlanName, null)
    if (where.status === 'EXPIRED') {
      assert.equal(where.detectedAmountEgp, null)
      return Array.from({ length: 6 }, (_, i) => ({ id: `expired-${i}`, status: 'EXPIRED', detectedAmountEgp: null }))
    }
    return []
  })
  const app = express()
  app.use('/transactions', transactionRouter)
  app.use('/subscription', planRouter)
  const server = app.listen(0, '127.0.0.1')
  try {
    await once(server, 'listening')
    const base = `http://127.0.0.1:${(server.address() as any).port}`
    const headers = { Authorization: 'Bearer ims_test-billing' }
    const response = await fetch(`${base}/transactions/review-queue`, { headers })
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    const body = await response.json() as any
    assert.equal(body.reviewQueue.expiredCheckouts.length, 6)
    assert.equal(body.reviewQueue.latePayments.length, 0)
    assert.equal(body.reviewQueue.allTransactions.length, 0)
    assert.equal((await fetch(`${base}/subscription/history`)).status, 401)
    assert.equal((await fetch(`${base}/subscription/history?page=-1`, { headers })).status, 400)
    assert.equal((await fetch(`${base}/subscription/history?page=1.5`, { headers })).status, 400)
  } finally {
    server.closeAllConnections()
    await new Promise<void>(resolve => server.close(() => resolve()))
  }
})

test('admin duration edits never restart merchant trials and reassigning a used trial is rejected', async t => {
  const previousPassword = process.env.ADMIN_PASSWORD
  process.env.ADMIN_PASSWORD = 'test-admin-billing-password'
  t.after(() => { if (previousPassword === undefined) delete process.env.ADMIN_PASSWORD; else process.env.ADMIN_PASSWORD = previousPassword })
  mockMethod(t, db.authSession, 'findUnique', async () => ({ id: 'owner', kind: 'OWNER', expiresAt: new Date(Date.now() + 60000), lastSeenAt: new Date(), revokedAt: null, credentialFingerprint: ownerCredentialFingerprint(process.env.ADMIN_PASSWORD!) }))
  const trialPlan = { name: 'FREE_TRIAL', priceEgp: 0, periodDays: 14, maxTransactions: 20, isActive: true }
  mockMethod(t, db.plan, 'findUnique', async () => trialPlan)
  mockMethod(t, db.plan, 'update', async ({ data }: any) => ({ ...trialPlan, ...data }))
  mockMethod(t, db.plan, 'upsert', async ({ update }: any) => ({ ...trialPlan, ...update }))
  mockMethod(t, db.auditLog, 'create', async () => ({}))
  mockMethod(t, db.client, 'findMany', async () => { throw new Error('Duration edits must not restart existing trials') })
  mockMethod(t, db.client, 'update', async () => { throw new Error('Used trial must not be reassigned') })
  let claims = 0
  mockMethod(t, db.client, 'updateMany', async ({ where, data }: any) => {
    claims++
    assert.equal(where.id, 'merchant')
    assert.equal(where.trialRedeemedAt, null)
    assert.equal(where.subscriptionEndsAt, null)
    assert.ok(data.trialRedeemedAt instanceof Date)
    return { count: 0 }
  })
  const app = express()
  app.use(express.json())
  app.use('/admin', adminRouter)
  const server = app.listen(0, '127.0.0.1')
  try {
    await once(server, 'listening')
    const base = `http://127.0.0.1:${(server.address() as any).port}/admin`
    const headers = { Authorization: 'Bearer ios_test-owner-billing', 'Content-Type': 'application/json' }
    for (const path of ['/trial', '/plans']) {
      const response = await fetch(`${base}${path}`, { method: 'PATCH', headers, body: JSON.stringify({ name: 'FREE_TRIAL', periodDays: 30 }) })
      assert.equal(response.status, 200)
    }
    assert.equal(claims, 0)
    const response = await fetch(`${base}/clients/merchant/plan`, { method: 'POST', headers, body: JSON.stringify({ planName: 'FREE_TRIAL' }) })
    assert.equal(response.status, 409)
    assert.equal(claims, 1)
  } finally {
    server.closeAllConnections()
    await new Promise<void>(resolve => server.close(() => resolve()))
  }
})
