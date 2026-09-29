import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import { db } from '../db.js'
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  verifySessionToken,
  generateMerchantKeys,
} from '../services/authService.js'

export const authRouter = Router()

// Simple in-memory email OTP store (for development / fallback)
const otpStore = new Map<string, { otp: string; expiresAt: number }>()

// ─── Email OTP ──────────────────────────────────────────────────────

authRouter.post('/email-otp', async (req: Request, res: Response) => {
  const { email, purpose = 'MERCHANT_SIGNUP' } = req.body
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ ok: false, error: 'Valid email is required' })
  }

  const cleanEmail = email.toLowerCase().trim()

  // Generate 6 digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = Date.now() + 10 * 60 * 1000 // 10 minutes

  otpStore.set(cleanEmail, { otp, expiresAt })

  console.log(`[Email OTP] Generated for ${cleanEmail}: ${otp}`)

  return res.json({
    ok: true,
    message: 'Verification code sent (mock/dev enabled)',
    devOtp: process.env.NODE_ENV !== 'production' ? otp : undefined,
  })
})

// ─── Register Merchant ──────────────────────────────────────────────

authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const {
      businessName,
      businessType,
      email,
      password,
      instapayHandle,
      instapayPaymentUrl,
      whatsappNumber,
      otp,
    } = req.body

    if (!businessName || !email || !password || !instapayHandle) {
      return res.status(400).json({
        ok: false,
        error: 'Business name, email, password, and InstaPay handle are required',
      })
    }

    const cleanEmail = email.toLowerCase().trim()

    // Verify OTP if provided
    if (otp) {
      const stored = otpStore.get(cleanEmail)
      if (!stored || stored.otp !== otp || stored.expiresAt < Date.now()) {
        return res.status(400).json({ ok: false, error: 'Invalid or expired OTP code' })
      }
      otpStore.delete(cleanEmail)
    }

    // Check existing email
    const existing = await db.client.findUnique({ where: { email: cleanEmail } })
    if (existing) {
      return res.status(409).json({ ok: false, error: 'An account with this email already exists' })
    }

    const slug = `${businessName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 32)}-${crypto.randomBytes(3).toString('hex')}`

    const passwordHash = hashPassword(password)

    // Account starts as PENDING until approved by admin
    const client = await db.client.create({
      data: {
        slug,
        businessName,
        businessType: businessType || 'E-commerce',
        email: cleanEmail,
        passwordHash,
        instapayHandle: instapayHandle.toLowerCase().trim(),
        instapayPaymentUrl: instapayPaymentUrl?.trim() || null,
        whatsappNumber: whatsappNumber || null,
        approvalStatus: 'PENDING',
        isActive: false,
        subscriptionPlan: 'FREE_TRIAL',
        txLimit: 20,
        txCount: 0,
      },
    })

    return res.status(201).json({
      ok: true,
      message: 'Registration submitted successfully. Account is pending approval by admin.',
      client: {
        id: client.id,
        businessName: client.businessName,
        email: client.email,
        status: client.approvalStatus,
      },
    })
  } catch (err: unknown) {
    console.error('[auth/register] error:', err)
    return res.status(500).json({ ok: false, error: 'Failed to create account' })
  }
})

// ─── Merchant Login ─────────────────────────────────────────────────

authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: 'Email and password are required' })
    }

    const cleanEmail = email.toLowerCase().trim()
    const client = await db.client.findUnique({ where: { email: cleanEmail } })

    if (!client) {
      return res.status(401).json({ ok: false, error: 'Invalid email or password' })
    }

    if (!verifyPassword(password, client.passwordHash)) {
      return res.status(401).json({ ok: false, error: 'Invalid email or password' })
    }

    // Sign session token
    const token = createSessionToken(client.id)

    res.cookie('instapay_merchant_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })

    return res.json({
      ok: true,
      client: {
        id: client.id,
        slug: client.slug,
        businessName: client.businessName,
        email: client.email,
        instapayHandle: client.instapayHandle,
        instapayPaymentUrl: client.instapayPaymentUrl,
        approvalStatus: client.approvalStatus,
        isActive: client.isActive,
        apiKey: client.apiKey,
        detectToken: client.detectToken,
        subscriptionPlan: client.subscriptionPlan,
        txLimit: client.txLimit,
        txCount: client.txCount,
      },
      token,
    })
  } catch (err) {
    console.error('[auth/login] error:', err)
    return res.status(500).json({ ok: false, error: 'Internal login error' })
  }
})

// ─── Current Session ────────────────────────────────────────────────

authRouter.get('/session', async (req: Request, res: Response) => {
  try {
    const cookieToken = req.cookies?.['instapay_merchant_session']
    const authHeader = req.headers.authorization?.replace(/^Bearer\s+/i, '')
    const token = authHeader || cookieToken

    const clientId = verifySessionToken(token)
    if (!clientId) {
      return res.status(401).json({ ok: false, authenticated: false })
    }

    const client = await db.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        slug: true,
        businessName: true,
        businessType: true,
        email: true,
        instapayHandle: true,
        instapayPaymentUrl: true,
        approvalStatus: true,
        isActive: true,
        apiKey: true,
        detectToken: true,
        webhookUrl: true,
        webhookSecret: true,
        checkoutTtlMin: true,
        subscriptionPlan: true,
        subscriptionEndsAt: true,
        isFreeTrial: true,
        txLimit: true,
        txCount: true,
        createdAt: true,
      },
    })

    if (!client) {
      return res.status(401).json({ ok: false, authenticated: false })
    }

    return res.json({ ok: true, authenticated: true, client })
  } catch (err) {
    return res.status(500).json({ ok: false, authenticated: false })
  }
})

// ─── Logout ─────────────────────────────────────────────────────────

authRouter.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('instapay_merchant_session')
  return res.json({ ok: true, message: 'Logged out successfully' })
})

// ─── Android Detector APK Login ─────────────────────────────────────

authRouter.post('/apk-login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: 'Email and password are required' })
    }

    const cleanEmail = email.toLowerCase().trim()
    const client = await db.client.findUnique({ where: { email: cleanEmail } })

    if (!client || !verifyPassword(password, client.passwordHash)) {
      return res.status(401).json({ ok: false, error: 'Invalid credentials' })
    }

    if (!client.isActive || client.approvalStatus !== 'APPROVED') {
      return res.status(403).json({
        ok: false,
        error: 'Your account is pending admin approval. You can login once approved.',
      })
    }

    // Auto-generate keys if missing
    let detectToken = client.detectToken
    if (!detectToken) {
      const keys = generateMerchantKeys()
      await db.client.update({
        where: { id: client.id },
        data: {
          apiKey: keys.apiKey,
          detectToken: keys.detectToken,
          webhookSecret: keys.webhookSecret,
          apiKeyHash: keys.apiKeyHash,
          detectTokenHash: keys.detectTokenHash,
          webhookSecretHash: keys.webhookSecretHash,
        },
      })
      detectToken = keys.detectToken
    }

    return res.json({
      ok: true,
      detectToken,
      client: {
        id: client.id,
        businessName: client.businessName,
        instapayHandle: client.instapayHandle,
        subscriptionPlan: client.subscriptionPlan,
        txCount: client.txCount,
        txLimit: client.txLimit,
      },
    })
  } catch (err) {
    console.error('[auth/apk-login] error:', err)
    return res.status(500).json({ ok: false, error: 'APK Login error' })
  }
})
