import assert from 'node:assert/strict'
import { once } from 'node:events'
import test from 'node:test'
import express from 'express'
import { db } from '../db.js'
import { hashPassword } from '../services/authService.js'
import { authRouter } from './authRoutes.js'
import { settingsRouter } from './settingsRoutes.js'

process.env.TOKEN_PEPPER = 'test-registration-credentials-pepper-32-chars'
process.env.CREDENTIAL_ENCRYPTION_KEY = 'test-key-01234567890123456789012345678901'
process.env.AUTH_ALLOW_DEV_BYPASS = 'true'
process.env.AUTH_EXPOSE_DEV_OTP = 'true'

test('merchant registration rejects previously registered email, phone, or InstaPay handle', async () => {
  const existingMerchant = {
    id: 'cl_existing_1',
    slug: 'existing-store',
    businessName: 'Existing Store',
    email: 'existing@store.com',
    passwordHash: hashPassword('Password123!'),
    whatsappNumber: '+201012345678',
    instapayHandle: 'existingstore@instapay',
    instapayPaymentUrl: 'https://ipn.eg/S/existingstore/instapay/TOKEN123',
    approvalStatus: 'APPROVED',
    isActive: true,
  }

  const clients: any[] = [{ ...existingMerchant }]
  const verifications: any[] = []

  const origEmailVerif = (db as any).emailVerification
  ;(db as any).emailVerification = {
    create: async ({ data }: any) => {
      const v = { id: `ver_${Date.now()}_${Math.random().toString(36).slice(2)}`, attempts: 0, consumedAt: null, ...data }
      verifications.push(v)
      return v
    },
    findUnique: async ({ where }: any) => {
      return verifications.find((v) => v.id === where.id) || null
    },
    updateMany: async ({ where, data }: any) => {
      let count = 0
      for (const v of verifications) {
        if (where.id && v.id !== where.id) continue
        if (where.email && v.email !== where.email) continue
        if (where.consumedAt === null && v.consumedAt !== null) continue
        Object.assign(v, data)
        count++
      }
      return { count }
    },
    update: async ({ where, data }: any) => {
      const v = verifications.find((v) => v.id === where.id)
      if (v) Object.assign(v, data)
      return v
    },
  }

  const clientDelegate = db.client as any
  const origFindFirst = clientDelegate.findFirst
  const origFindUnique = clientDelegate.findUnique
  const origCreate = clientDelegate.create

  clientDelegate.findFirst = async ({ where }: any) => {
    if (!where) return null
    return clients.find((c) => {
      if (where.email) {
        const target = typeof where.email === 'string' ? where.email : where.email.equals
        if (target && c.email.toLowerCase() === target.toLowerCase()) return true
      }
      if (where.whatsappNumber) {
        const target = where.whatsappNumber.in || [where.whatsappNumber]
        if (target.includes(c.whatsappNumber)) return true
      }
      if (where.OR) {
        for (const cond of where.OR) {
          if (cond.instapayHandle) {
            const h = typeof cond.instapayHandle === 'string' ? cond.instapayHandle : cond.instapayHandle.equals
            if (h && c.instapayHandle.toLowerCase() === h.toLowerCase()) return true
          }
          if (cond.instapayPaymentUrl) {
            const u = typeof cond.instapayPaymentUrl === 'string' ? cond.instapayPaymentUrl : cond.instapayPaymentUrl.equals
            if (u && c.instapayPaymentUrl.toLowerCase() === u.toLowerCase()) return true
          }
        }
      }
      return false
    }) || null
  }

  clientDelegate.findUnique = async ({ where }: any) => {
    if (where.email) {
      return clients.find((c) => c.email.toLowerCase() === where.email.toLowerCase()) || null
    }
    if (where.id) {
      return clients.find((c) => c.id === where.id) || null
    }
    return null
  }

  clientDelegate.create = async ({ data }: any) => {
    const created = { id: `cl_${Date.now()}`, ...data }
    clients.push(created)
    return created
  }

  ;(db as any).plan = {
    findUnique: async () => ({ maxTransactions: 50 }),
  }

  const app = express()
  app.use(express.json())
  app.use('/auth', authRouter)
  app.use('/settings', settingsRouter)

  const server = app.listen(0, '127.0.0.1')
  try {
    await once(server, 'listening')
    const address = server.address() as { port: number }
    const baseUrl = `http://127.0.0.1:${address.port}`

    // 1. Request signup OTP for fresh credentials
    const otpRes = await fetch(`${baseUrl}/auth/email-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new@store.com', purpose: 'MERCHANT_SIGNUP' }),
    })
    const otpBody = (await otpRes.json()) as any
    assert.equal(otpRes.status, 200)
    assert.equal(otpBody.ok, true)
    const verificationId = otpBody.verificationId
    const devOtp = otpBody.devOtp

    // 2. Attempt registration with the same EMAIL as existing merchant -> rejected 409
    const dupEmailRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessName: 'Brand New Store',
        email: 'EXISTING@store.com',
        password: 'Password123!',
        whatsappNumber: '01099999999',
        instapayPaymentUrl: 'https://ipn.eg/S/newstore/instapay/TOKENABC',
        verificationId,
        otp: devOtp,
      }),
    })
    assert.equal(dupEmailRes.status, 409)
    const dupEmailBody = (await dupEmailRes.json()) as any
    assert.match(dupEmailBody.error, /already exists/i)

    // 3. Attempt registration with the same PHONE as existing merchant -> rejected 409
    const dupPhoneRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessName: 'Brand New Store',
        email: 'brandnew@store.com',
        password: 'Password123!',
        whatsappNumber: '01012345678', // Same phone normalized as 01012345678 (matches +201012345678)
        instapayPaymentUrl: 'https://ipn.eg/S/newstore/instapay/TOKENABC',
        verificationId,
        otp: devOtp,
      }),
    })
    assert.equal(dupPhoneRes.status, 409)
    const dupPhoneBody = (await dupPhoneRes.json()) as any
    assert.match(dupPhoneBody.error, /mobile number.*registered/i)

    // 4. Attempt registration with the same INSTAPAY LINK as existing merchant -> rejected 409
    const dupHandleRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessName: 'Brand New Store',
        email: 'brandnew@store.com',
        password: 'Password123!',
        whatsappNumber: '01099999999',
        instapayPaymentUrl: 'https://ipn.eg/S/existingstore/instapay/TOKEN_DIFFERENT', // Same handle: existingstore@instapay
        verificationId,
        otp: devOtp,
      }),
    })
    assert.equal(dupHandleRes.status, 409)
    const dupHandleBody = (await dupHandleRes.json()) as any
    assert.match(dupHandleBody.error, /instapay.*registered/i)

    // 5. Attempt email-otp with a duplicate phone number -> rejected 400
    const otpDupPhoneRes = await fetch(`${baseUrl}/auth/email-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'another@store.com',
        purpose: 'MERCHANT_SIGNUP',
        whatsappNumber: '01012345678',
      }),
    })
    assert.equal(otpDupPhoneRes.status, 400)
    const otpDupPhoneBody = (await otpDupPhoneRes.json()) as any
    assert.match(otpDupPhoneBody.error, /phone number is already registered/i)

    // 6. Registration with completely fresh credentials -> succeeds 201
    const successRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessName: 'Unique Store',
        email: 'new@store.com',
        password: 'Password123!',
        whatsappNumber: '01088888888',
        instapayPaymentUrl: 'https://ipn.eg/S/uniquestore/instapay/TOKEN999',
        verificationId,
        otp: devOtp,
      }),
    })
    assert.equal(successRes.status, 201)
    const successBody = (await successRes.json()) as any
    assert.equal(successBody.ok, true)
    assert.equal(successBody.client.businessName, 'Unique Store')
  } finally {
    server.close()
    ;(db as any).emailVerification = origEmailVerif
    clientDelegate.findFirst = origFindFirst
    clientDelegate.findUnique = origFindUnique
    clientDelegate.create = origCreate
  }
})
