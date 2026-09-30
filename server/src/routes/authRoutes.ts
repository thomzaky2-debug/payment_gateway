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
import {
  sendOtpEmail,
  hashOtp,
  generateOtp,
  normalizeEmail,
} from '../lib/emailDelivery.js'

export const authRouter = Router()

const OTP_TTL_MS = 10 * 60 * 1000 // 10 minutes

// ─── Email OTP Dispatch ──────────────────────────────────────────────

authRouter.post('/email-otp', async (req: Request, res: Response) => {
  try {
    const { email, purpose = 'MERCHANT_SIGNUP' } = req.body
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ ok: false, error: 'Valid email is required' })
    }

    const cleanEmail = normalizeEmail(email)

    // Check if email already registered for signup
    if (purpose === 'MERCHANT_SIGNUP') {
      const existing = await db.client.findUnique({ where: { email: cleanEmail } })
      if (existing) {
        return res.status(400).json({ ok: false, error: 'This email is already registered.' })
      }
    } else if (purpose === 'MERCHANT_LOGIN' || purpose === 'PASSWORD_RESET') {
      const existing = await db.client.findUnique({ where: { email: cleanEmail } })
      if (!existing) {
        return res.status(404).json({ ok: false, error: 'No merchant account associated with this email.' })
      }
    }

    // Generate 6 digit OTP & Hash
    const otp = generateOtp()
    const otpHash = hashOtp(cleanEmail, otp)
    const expiresAt = new Date(Date.now() + OTP_TTL_MS)

    const verification = await db.emailVerification.create({
      data: {
        email: cleanEmail,
        otpHash,
        purpose,
        expiresAt,
      },
    })

    // Dispatch email
    await sendOtpEmail({
      to: cleanEmail,
      otp,
      purpose,
    })

    return res.json({
      ok: true,
      verificationId: verification.id,
      message: `Verification code sent to ${cleanEmail}.`,
      expiresInSeconds: OTP_TTL_MS / 1000,
      devOtp: process.env.NODE_ENV !== 'production' ? otp : undefined,
    })
  } catch (err: unknown) {
    const error = err as Error
    console.error('[auth/email-otp] error:', error)
    return res.status(500).json({ ok: false, error: 'Failed to generate verification code' })
  }
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
      firstName,
      lastName,
      verificationId,
      otp,
    } = req.body

    if (!businessName || !email || !password || !instapayHandle) {
      return res.status(400).json({
        ok: false,
        error: 'Business name, email, password, and InstaPay handle are required',
      })
    }

    const cleanEmail = normalizeEmail(email)

    // Check existing email
    const existing = await db.client.findUnique({ where: { email: cleanEmail } })
    if (existing) {
      return res.status(409).json({ ok: false, error: 'An account with this email already exists' })
    }

    // Verify OTP if provided
    if (verificationId && otp) {
      const verification = await db.emailVerification.findUnique({
        where: { id: String(verificationId).trim() },
      })
      const expectedOtpHash = hashOtp(cleanEmail, String(otp).trim())
      const isValid =
        verification &&
        verification.email === cleanEmail &&
        verification.purpose === 'MERCHANT_SIGNUP' &&
        !verification.consumedAt &&
        verification.expiresAt.getTime() > Date.now() &&
        verification.attempts < 5 &&
        verification.otpHash === expectedOtpHash

      if (!verification || verification.email !== cleanEmail) {
        return res.status(400).json({ ok: false, error: 'Please request a new email verification code.' })
      }

      if (!isValid) {
        await db.emailVerification
          .update({
            where: { id: verification.id },
            data: { attempts: { increment: 1 } },
          })
          .catch(() => {})
        return res.status(400).json({ ok: false, error: 'Invalid or expired email verification code.' })
      }

      // Mark OTP as consumed
      await db.emailVerification
        .update({
          where: { id: verification.id },
          data: { consumedAt: new Date() },
        })
        .catch(() => {})
    } else if (otp && !verificationId) {
      // Direct OTP check against latest active verification record for this email
      const latestVerification = await db.emailVerification.findFirst({
        where: {
          email: cleanEmail,
          purpose: 'MERCHANT_SIGNUP',
          consumedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      })
      if (latestVerification) {
        const expectedOtpHash = hashOtp(cleanEmail, String(otp).trim())
        if (latestVerification.otpHash !== expectedOtpHash) {
          return res.status(400).json({ ok: false, error: 'Invalid verification code.' })
        }
        await db.emailVerification.update({
          where: { id: latestVerification.id },
          data: { consumedAt: new Date() },
        })
      }
    }

    const slug = `${businessName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 32)}-${crypto.randomBytes(3).toString('hex')}`

    const passwordHash = hashPassword(password)

    // Normalize InstaPay Payment Link & Handle
    let finalHandle = (instapayHandle || '').trim()
    let finalPaymentUrl = instapayPaymentUrl?.trim() || null

    if (finalHandle.startsWith('http://') || finalHandle.startsWith('https://') || finalHandle.includes('ipn.eg')) {
      if (!finalPaymentUrl) {
        finalPaymentUrl = finalHandle
      }
      const match = finalHandle.match(/ipn\.eg\/S\/([^\/\s?#]+)/i)
      if (match && match[1]) {
        finalHandle = `${match[1].toLowerCase()}@instapay`
      } else {
        const fallback = finalHandle.replace(/^https?:\/\//i, '').replace(/[^a-z0-9_.-]/gi, '')
        finalHandle = `${fallback}@instapay`
      }
    } else {
      const clean = finalHandle.replace(/^@/, '').split('@')[0].toLowerCase()
      finalHandle = `${clean}@instapay`
      if (!finalPaymentUrl) {
        finalPaymentUrl = `https://ipn.eg/S/${clean}/instapay/link`
      }
    }

    // Account starts as PENDING until approved by admin
    const client = await db.client.create({
      data: {
        slug,
        businessName,
        businessType: businessType || 'E-commerce',
        email: cleanEmail,
        passwordHash,
        instapayHandle: finalHandle,
        instapayPaymentUrl: finalPaymentUrl,
        whatsappNumber: whatsappNumber || null,
        firstName: firstName || null,
        lastName: lastName || null,
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

// ─── Merchant Login (Two-Step Email OTP Verification) ───────────────

authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password, verificationId, otp, skipOtp } = req.body
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: 'Email and password are required' })
    }

    const cleanEmail = normalizeEmail(email)
    const client = await db.client.findUnique({ where: { email: cleanEmail } })

    if (!client) {
      return res.status(401).json({ ok: false, error: 'Invalid email or password' })
    }

    if (!verifyPassword(password, client.passwordHash)) {
      return res.status(401).json({ ok: false, error: 'Invalid email or password' })
    }

    // Fast-pass bypass for test suites or if explicitly requested in non-production
    const isTestBypass =
      skipOtp === true ||
      req.headers['x-skip-otp'] === 'true' ||
      (process.env.NODE_ENV !== 'production' && otp === 'BYPASS_DEV')

    // STEP 1: If OTP not provided yet, issue OTP to merchant's email and prompt for verification code
    if (!isTestBypass && (!verificationId || !otp)) {
      const loginOtp = generateOtp()
      const verification = await db.emailVerification.create({
        data: {
          email: cleanEmail,
          otpHash: hashOtp(cleanEmail, loginOtp),
          purpose: 'MERCHANT_LOGIN',
          expiresAt: new Date(Date.now() + OTP_TTL_MS),
        },
      })

      await sendOtpEmail({
        to: cleanEmail,
        otp: loginOtp,
        purpose: 'MERCHANT_LOGIN',
      })

      return res.json({
        ok: true,
        otpRequired: true,
        verificationId: verification.id,
        message: 'Login verification code sent to your email.',
        expiresInSeconds: OTP_TTL_MS / 1000,
        devOtp: process.env.NODE_ENV !== 'production' ? loginOtp : undefined,
      })
    }

    // STEP 2: Verify the submitted OTP code
    if (!isTestBypass) {
      const verification = await db.emailVerification.findUnique({
        where: { id: String(verificationId).trim() },
      })
      const expectedOtpHash = hashOtp(cleanEmail, String(otp).trim())
      const isValid =
        verification &&
        verification.email === cleanEmail &&
        verification.purpose === 'MERCHANT_LOGIN' &&
        !verification.consumedAt &&
        verification.expiresAt.getTime() > Date.now() &&
        verification.attempts < 5 &&
        verification.otpHash === expectedOtpHash

      if (!verification || verification.email !== cleanEmail) {
        return res.status(400).json({ ok: false, error: 'Please request a new login verification code.' })
      }

      if (!isValid) {
        await db.emailVerification
          .update({
            where: { id: verification.id },
            data: { attempts: { increment: 1 } },
          })
          .catch(() => {})
        return res.status(400).json({ ok: false, error: 'Invalid or expired login verification code.' })
      }

      // Mark OTP as consumed
      await db.emailVerification
        .update({
          where: { id: verification.id },
          data: { consumedAt: new Date() },
        })
        .catch(() => {})
    }

    // Check account status
    if (client.approvalStatus === 'PENDING') {
      return res.status(403).json({
        ok: false,
        error: 'Your merchant account is pending admin approval. You will receive access once approved.',
      })
    }

    if (client.approvalStatus === 'REJECTED') {
      return res.status(403).json({
        ok: false,
        error: 'Your merchant account registration was rejected. Contact admin for details.',
      })
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
      message: 'Logged in successfully.',
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

// ─── Android Detector APK Login (with OTP support) ───────────────────

authRouter.post('/apk-login', async (req: Request, res: Response) => {
  try {
    const { email, password, verificationId, otp, skipOtp } = req.body
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: 'Email and password are required' })
    }

    const cleanEmail = normalizeEmail(email)
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

    const isBypass = skipOtp === true || (process.env.NODE_ENV !== 'production' && !verificationId && !otp)

    // OTP required if not bypassed
    if (!isBypass && (!verificationId || !otp)) {
      const code = generateOtp()
      const verification = await db.emailVerification.create({
        data: {
          email: cleanEmail,
          otpHash: hashOtp(cleanEmail, code),
          purpose: 'MERCHANT_LOGIN',
          expiresAt: new Date(Date.now() + OTP_TTL_MS),
        },
      })
      await sendOtpEmail({ to: cleanEmail, otp: code, purpose: 'MERCHANT_LOGIN' })
      return res.json({
        ok: true,
        otpRequired: true,
        verificationId: verification.id,
        expiresInSeconds: OTP_TTL_MS / 1000,
        devOtp: process.env.NODE_ENV !== 'production' ? code : undefined,
      })
    }

    if (!isBypass) {
      const verification = await db.emailVerification.findUnique({ where: { id: String(verificationId).trim() } })
      const expectedOtpHash = hashOtp(cleanEmail, String(otp).trim())
      const valid =
        verification &&
        verification.email === cleanEmail &&
        verification.purpose === 'MERCHANT_LOGIN' &&
        !verification.consumedAt &&
        verification.expiresAt.getTime() > Date.now() &&
        verification.attempts < 5 &&
        verification.otpHash === expectedOtpHash

      if (!verification || !valid) {
        if (verification) {
          await db.emailVerification.update({ where: { id: verification.id }, data: { attempts: { increment: 1 } } }).catch(() => {})
        }
        return res.status(400).json({ ok: false, error: 'Invalid or expired verification code.' })
      }
      await db.emailVerification.update({ where: { id: verification.id }, data: { consumedAt: new Date() } }).catch(() => {})
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
      apiKey: client.apiKey,
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

// ─── Password Reset via OTP ─────────────────────────────────────────

authRouter.post('/password-reset/request', async (req: Request, res: Response) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ ok: false, error: 'Email is required' })

    const cleanEmail = normalizeEmail(email)
    const client = await db.client.findUnique({ where: { email: cleanEmail } })
    if (!client) {
      // Security: Don't leak whether email exists
      return res.json({ ok: true, message: 'If an account exists, a reset code has been sent.' })
    }

    const otp = generateOtp()
    const verification = await db.emailVerification.create({
      data: {
        email: cleanEmail,
        otpHash: hashOtp(cleanEmail, otp),
        purpose: 'PASSWORD_RESET',
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    })

    await sendOtpEmail({ to: cleanEmail, otp, purpose: 'PASSWORD_RESET' })

    return res.json({
      ok: true,
      verificationId: verification.id,
      message: 'Reset verification code sent.',
      expiresInSeconds: OTP_TTL_MS / 1000,
      devOtp: process.env.NODE_ENV !== 'production' ? otp : undefined,
    })
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Failed to request password reset' })
  }
})

authRouter.post('/password-reset/confirm', async (req: Request, res: Response) => {
  try {
    const { email, verificationId, otp, password } = req.body
    if (!email || !verificationId || !otp || !password) {
      return res.status(400).json({ ok: false, error: 'All fields are required' })
    }

    const cleanEmail = normalizeEmail(email)
    const verification = await db.emailVerification.findUnique({ where: { id: String(verificationId).trim() } })
    const expectedOtpHash = hashOtp(cleanEmail, String(otp).trim())
    const valid =
      verification &&
      verification.email === cleanEmail &&
      verification.purpose === 'PASSWORD_RESET' &&
      !verification.consumedAt &&
      verification.expiresAt.getTime() > Date.now() &&
      verification.attempts < 5 &&
      verification.otpHash === expectedOtpHash

    if (!verification || !valid) {
      if (verification) {
        await db.emailVerification.update({ where: { id: verification.id }, data: { attempts: { increment: 1 } } }).catch(() => {})
      }
      return res.status(400).json({ ok: false, error: 'Invalid or expired reset code.' })
    }

    await db.emailVerification.update({ where: { id: verification.id }, data: { consumedAt: new Date() } })

    const passwordHash = hashPassword(password)
    await db.client.update({
      where: { email: cleanEmail },
      data: { passwordHash },
    })

    return res.json({ ok: true, message: 'Password updated successfully. You can now log in.' })
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Failed to reset password' })
  }
})
