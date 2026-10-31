import assert from 'node:assert/strict'
import { once } from 'node:events'
import test from 'node:test'
import express from 'express'
import { db } from '../db.js'
import {
  canMerchantAccessPortal,
  hashToken,
  hashPassword,
} from '../services/authService.js'
import { encryptCredential } from '../lib/credentialCrypto.js'
import { settingsRouter, safeMerchantSettings } from './settingsRoutes.js'
import { mobileRouter } from './mobileRoutes.js'
import { authRouter } from './authRoutes.js'

process.env.TOKEN_PEPPER = 'test-session-presentation-pepper-at-least-32-chars'
process.env.CREDENTIAL_ENCRYPTION_KEY = 'test-key-01234567890123456789012345678901'
process.env.AUTH_ALLOW_DEV_BYPASS = 'true'

test('canMerchantAccessPortal helper grants access to pending and active approved merchants, but blocks rejected and suspended', () => {
  assert.equal(canMerchantAccessPortal({ approvalStatus: 'PENDING', isActive: false }), true)
  assert.equal(canMerchantAccessPortal({ approvalStatus: 'PENDING', isActive: true }), true)
  assert.equal(canMerchantAccessPortal({ approvalStatus: 'APPROVED', isActive: true }), true)
  assert.equal(canMerchantAccessPortal({ approvalStatus: 'APPROVED', isActive: false }), false) // suspended
  assert.equal(canMerchantAccessPortal({ approvalStatus: 'REJECTED', isActive: false }), false)
  assert.equal(canMerchantAccessPortal({ approvalStatus: 'DELETED', isActive: false }), false)
})

test('safeMerchantSettings returns null tokens when approvalStatus is PENDING, and decrypted tokens when APPROVED', () => {
  const apiKeyPlain = 'egp_live_test123456'
  const detectPlain = 'det_test123456'
  const webhookPlain = 'whsec_test123456'

  const pendingClient = {
    id: 'cl_pending',
    businessName: 'Pending Merchant',
    approvalStatus: 'PENDING',
    isActive: false,
    apiKey: encryptCredential(apiKeyPlain),
    detectToken: encryptCredential(detectPlain),
    webhookSecret: encryptCredential(webhookPlain),
    txLimit: 50,
    txCount: 0,
  }

  const pendingSettings = safeMerchantSettings(pendingClient)
  assert.equal(pendingSettings?.approvalStatus, 'PENDING')
  assert.equal(pendingSettings?.apiKey, null)
  assert.equal(pendingSettings?.detectToken, null)
  assert.equal(pendingSettings?.webhookSecret, null)

  const approvedClient = {
    ...pendingClient,
    id: 'cl_approved',
    approvalStatus: 'APPROVED',
    isActive: true,
  }

  const approvedSettings = safeMerchantSettings(approvedClient)
  assert.equal(approvedSettings?.approvalStatus, 'APPROVED')
  assert.equal(approvedSettings?.apiKey, apiKeyPlain)
  assert.equal(approvedSettings?.detectToken, detectPlain)
  assert.equal(approvedSettings?.webhookSecret, webhookPlain)
})

test('merchant browsing without admin approval: login succeeds, portal APIs accessible, tokens hidden, rotation blocked', async () => {
  const token = 'ims_test-pending-merchant-token'
  const sessionRecord = {
    id: 'session_1',
    tokenHash: hashToken(token),
    kind: 'MERCHANT',
    clientId: 'merchant_pending_1',
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    lastSeenAt: new Date(),
    createdAt: new Date(),
    deviceId: null,
    userAgent: 'test-agent',
    ipAddress: '127.0.0.1',
  }

  const pendingMerchant = {
    id: 'merchant_pending_1',
    slug: 'pending-store',
    businessName: 'Pending Store',
    email: 'pending@example.com',
    passwordHash: hashPassword('CorrectPassword123'),
    instapayHandle: 'pending@instapay',
    instapayPaymentUrl: 'https://ipn.eg/S/pending/instapay/TOKEN',
    approvalStatus: 'PENDING',
    isActive: false,
    apiKey: null,
    apiKeyHash: null,
    detectToken: null,
    detectTokenHash: null,
    webhookSecret: null,
    webhookSecretHash: null,
    subscriptionPlan: 'FREE_TRIAL',
    isFreeTrial: true,
    txLimit: 50,
    txCount: 0,
    createdAt: new Date(),
  }

  const sessionDelegate = db.authSession as any
  sessionDelegate.findUnique = async () => sessionRecord
  sessionDelegate.updateMany = async () => ({ count: 1 })
  sessionDelegate.findMany = async () => [sessionRecord]
  sessionDelegate.create = async () => sessionRecord

  const clientDelegate = db.client as any
  clientDelegate.findUnique = async ({ where }: any) => {
    if (where.id === 'merchant_pending_1' || where.email === 'pending@example.com') {
      return pendingMerchant
    }
    return null
  }
  clientDelegate.findFirst = async () => null
  clientDelegate.update = async ({ data }: any) => {
    Object.assign(pendingMerchant, data)
    return pendingMerchant
  }

  ;(db as any).plan = {
    findUnique: async () => ({ maxTransactions: 50 }),
  }

  ;(db.detectorDevice as any).findMany = async () => []

  const app = express()
  app.use(express.json())
  app.use('/auth', authRouter)
  app.use('/settings', settingsRouter)
  app.use('/mobile', mobileRouter)

  const server = app.listen(0, '127.0.0.1')
  try {
    await once(server, 'listening')
    const address = server.address() as { port: number }
    const baseUrl = `http://127.0.0.1:${address.port}`

    // 1. Pending merchant can login successfully
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'pending@example.com',
        password: 'CorrectPassword123',
        skipOtp: true,
      }),
    })
    assert.equal(loginRes.status, 200)
    const loginBody = await loginRes.json() as any
    assert.equal(loginBody.ok, true)
    assert.equal(loginBody.client.approvalStatus, 'PENDING')

    // 2. Pending merchant can check session
    const sessionRes = await fetch(`${baseUrl}/auth/session`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    assert.equal(sessionRes.status, 200)
    const sessionBody = await sessionRes.json() as any
    assert.equal(sessionBody.authenticated, true)
    assert.equal(sessionBody.client.approvalStatus, 'PENDING')

    // 3. Pending merchant can browse settings / portal, but tokens are null
    const settingsRes = await fetch(`${baseUrl}/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    assert.equal(settingsRes.status, 200)
    const settingsBody = await settingsRes.json() as any
    assert.equal(settingsBody.ok, true)
    assert.equal(settingsBody.settings.approvalStatus, 'PENDING')
    assert.equal(settingsBody.settings.apiKey, null)
    assert.equal(settingsBody.settings.detectToken, null)
    assert.equal(settingsBody.settings.webhookSecret, null)

    // 4. Pending merchant cannot rotate/generate keys before admin approval
    const rotateRes = await fetch(`${baseUrl}/settings/rotate-keys`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    assert.equal(rotateRes.status, 403)
    const rotateBody = await rotateRes.json() as any
    assert.equal(rotateBody.ok, false)
    assert.match(rotateBody.error, /approved by an admin/i)

    // 5. Pending merchant cannot enroll mobile detector before admin approval
    const enrollRes = await fetch(`${baseUrl}/mobile/devices/enroll`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        deviceId: 'device-test-12345',
        name: 'Merchant Test Phone',
      }),
    })
    assert.equal(enrollRes.status, 403)
    const enrollBody = await enrollRes.json() as any
    assert.equal(enrollBody.ok, false)
    assert.match(enrollBody.error, /approved merchant account/i)
  } finally {
    server.close()
  }
})
