import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import { db } from '../db.js'
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  verifySessionToken,
  ensureMerchantIntegrationTokens,
  isApprovedActiveMerchant,
  MERCHANT_SESSION_COOKIE_NAME,
  revokeAllMerchantSessions,
  revokeSessionToken,
  validatePasswordPolicy,
} from '../services/authService.js'
import {
  sendOtpEmail,
  hashOtp,
  generateOtp,
  normalizeEmail,
  verifyOtpCode,
} from '../lib/emailDelivery.js'
import { createRateLimiterWithKey } from '../lib/rateLimiter.js'
import { validateMerchantSignupEmail } from '../lib/emailValidation.js'
import { clearMerchantSessionCookie, setMerchantSessionCookie } from '../lib/authCookies.js'
import { getRequestAuthToken, getRequestIp } from '../middleware/authToken.js'

export const authRouter = Router()

authRouter.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Pragma', 'no-cache')
  next()
})

const OTP_TTL_MS = 10 * 60 * 1000 // 10 minutes
const AUTH_PURPOSES = new Set(['MERCHANT_SIGNUP', 'MERCHANT_LOGIN', 'PASSWORD_RESET'])

function isExplicitDevAuthEnabled(flag: 'AUTH_ALLOW_DEV_BYPASS' | 'AUTH_EXPOSE_DEV_OTP'): boolean {
  return process.env.NODE_ENV === 'development' && process.env[flag] === 'true'
}

async function issueOtpVerification(email: string, purpose: string) {
  const now = new Date()
  await db.emailVerification.updateMany({
    where: { email, purpose, consumedAt: null },
    data: { consumedAt: now },
  })

  const otp = generateOtp()
  const verification = await db.emailVerification.create({
    data: {
      email,
      otpHash: hashOtp(email, otp),
      purpose,
      expiresAt: new Date(now.getTime() + OTP_TTL_MS),
    },
  })

  try {
    await sendOtpEmail({ to: email, otp, purpose })
  } catch (err) {
    await db.emailVerification.delete({ where: { id: verification.id } }).catch(() => {})
    throw err
  }

  return { otp, verification }
}

// Dedicated rate limiter for OTP dispatch — 5 per email per 15 minutes
const accountKey = (req: Request) => {
  const email = typeof req.body?.email === 'string' ? normalizeEmail(req.body.email).slice(0, 320) : 'missing'
  return email
}
const otpDispatchLimiter = createRateLimiterWithKey(
  15 * 60 * 1000,
  5,
  'Too many verification code requests. Try again in 15 minutes.',
  accountKey
)
const credentialAttemptLimiter = createRateLimiterWithKey(
  15 * 60 * 1000,
  10,
  'Too many authentication attempts for this account. Try again in 15 minutes.',
  accountKey
)

// ─── Email OTP Dispatch ──────────────────────────────────────────────

authRouter.post('/email-otp', otpDispatchLimiter, async (req: Request, res: Response) => {
  try {
    const { email, purpose = 'MERCHANT_SIGNUP' } = req.body
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ ok: false, error: 'Valid email is required' })
    }

    const cleanEmail = normalizeEmail(email)
    if (!AUTH_PURPOSES.has(purpose)) {
      return res.status(400).json({ ok: false, error: 'Invalid verification purpose' })
    }

    // Check if email already registered for signup
    if (purpose === 'MERCHANT_SIGNUP') {
      const emailError = validateMerchantSignupEmail(cleanEmail)
      if (emailError) {
        return res.status(400).json({ ok: false, error: emailError })
      }
      const existing = await db.client.findUnique({ where: { email: cleanEmail } })
      if (existing) {
        return res.status(400).json({ ok: false, error: 'This email is already registered.' })
      }
    } else if (purpose === 'MERCHANT_LOGIN' || purpose === 'PASSWORD_RESET') {
      const existing = await db.client.findUnique({ where: { email: cleanEmail } })
      if (!existing) {
        // Do not disclose whether a merchant account exists.
        return res.json({
          ok: true,
          verificationId: `pending_${crypto.randomBytes(16).toString('hex')}`,
          message: 'If an eligible account exists, a verification code has been sent.',
          expiresInSeconds: OTP_TTL_MS / 1000,
        })
      }
    }

    const { otp, verification } = await issueOtpVerification(cleanEmail, purpose)

    return res.json({
      ok: true,
      verificationId: verification.id,
      message: `Verification code sent to ${cleanEmail}.`,
      expiresInSeconds: OTP_TTL_MS / 1000,
      ...(isExplicitDevAuthEnabled('AUTH_EXPOSE_DEV_OTP') ? { devOtp: otp } : {}),
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

    const passwordError = validatePasswordPolicy(password)
    if (passwordError) {
      return res.status(400).json({ ok: false, error: passwordError })
    }

    if (!verificationId || !otp) {
      return res.status(400).json({ ok: false, error: 'Email verification is required' })
    }

    const cleanEmail = normalizeEmail(email)

    const emailError = validateMerchantSignupEmail(cleanEmail)
    if (emailError) {
      return res.status(400).json({ ok: false, error: emailError })
    }

    // Check existing email
    const existing = await db.client.findUnique({ where: { email: cleanEmail } })
    if (existing) {
      return res.status(409).json({ ok: false, error: 'An account with this email already exists' })
    }

    // A signup code is mandatory and consumed exactly once.
    const otpResult = await verifyOtpCode(db, cleanEmail, verificationId, otp, 'MERCHANT_SIGNUP')
    if (!otpResult.valid) {
      return res.status(400).json({ ok: false, error: otpResult.error })
    }

    const slug = `${businessName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 32)}-${crypto.randomBytes(3).toString('hex')}`

    const passwordHash = hashPassword(password)

    // Normalize InstaPay Payment Link & Handle
    let finalPaymentUrl = instapayPaymentUrl?.trim() || null
    let finalHandle = (instapayHandle || '').trim()

    if (finalPaymentUrl) {
      const match = finalPaymentUrl.match(/ipn\.eg\/S\/([^\/\s?#]+)/i) || finalPaymentUrl.match(/\/S\/([^\/\?#]+)/i)
      if (match && match[1]) {
        finalHandle = `${match[1].toLowerCase().replace(/^@/, '')}@instapay`
      }
    }

    if (finalHandle.startsWith('http://') || finalHandle.startsWith('https://') || finalHandle.includes('ipn.eg')) {
      if (!finalPaymentUrl) {
        finalPaymentUrl = finalHandle
      }
      const match = finalHandle.match(/ipn\.eg\/S\/([^\/\s?#]+)/i) || finalHandle.match(/\/S\/([^\/\?#]+)/i)
      if (match && match[1]) {
        finalHandle = `${match[1].toLowerCase().replace(/^@/, '')}@instapay`
      } else {
        const fallback = finalHandle.replace(/^https?:\/\//i, '').replace(/[^a-z0-9_.-]/gi, '')
        finalHandle = `${fallback}@instapay`
      }
    } else if (finalHandle) {
      const clean = finalHandle.replace(/^@/, '').split('@')[0].toLowerCase()
      finalHandle = `${clean}@instapay`
      if (!finalPaymentUrl) {
        finalPaymentUrl = `https://ipn.eg/S/${clean}/instapay/link`
      }
    } else {
      finalHandle = 'merchant@instapay'
    }

    // Account starts as PENDING until approved by admin
    const trialPlan = await (db.plan as any).findUnique({ where: { name: 'FREE_TRIAL' } })
    const trialTxLimit = trialPlan?.maxTransactions ?? 50

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
        isFreeTrial: true,
        txLimit: trialTxLimit,
        txCount: 0,
        subscriptionEndsAt: null,
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

authRouter.post('/login', credentialAttemptLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password, verificationId, otp, skipOtp, tokenTransport } = req.body
    if (!email || !password || typeof password !== 'string' || Buffer.byteLength(password, 'utf8') > 128) {
      return res.status(400).json({ ok: false, error: 'Email and password are required' })
    }

    const cleanEmail = normalizeEmail(email)
    const client = await db.client.findUnique({ where: { email: cleanEmail } })

    if (!client) {
      verifyPassword(password, '')
      return res.status(401).json({ ok: false, error: 'Invalid email or password' })
    }

    if (!verifyPassword(password, client.passwordHash)) {
      return res.status(401).json({ ok: false, error: 'Invalid email or password' })
    }

    if (!isApprovedActiveMerchant(client)) {
      if (client.approvalStatus === 'PENDING') {
        return res.status(403).json({
          ok: false,
          error: 'Your merchant account is pending admin approval. You will receive access once approved.',
        })
      }
      return res.status(403).json({
        ok: false,
        error: 'Your merchant account is inactive or rejected. Contact admin for assistance.',
      })
    }

    // Explicit local-development escape hatch for automated local checks only.
    const isTestBypass =
      isExplicitDevAuthEnabled('AUTH_ALLOW_DEV_BYPASS') &&
      (skipOtp === true || otp === 'BYPASS_DEV')

    // STEP 1: If OTP not provided yet, issue OTP to merchant's email
    if (!isTestBypass && (!verificationId || !otp)) {
      const { otp: loginOtp, verification } = await issueOtpVerification(cleanEmail, 'MERCHANT_LOGIN')

      return res.json({
        ok: true,
        otpRequired: true,
        verificationId: verification.id,
        message: 'Login verification code sent to your email.',
        expiresInSeconds: OTP_TTL_MS / 1000,
        ...(isExplicitDevAuthEnabled('AUTH_EXPOSE_DEV_OTP') ? { devOtp: loginOtp } : {}),
      })
    }

    // STEP 2: Verify the submitted OTP code using centralized helper
    if (!isTestBypass) {
      const otpResult = await verifyOtpCode(db, cleanEmail, verificationId, otp, 'MERCHANT_LOGIN')
      if (!otpResult.valid) {
        return res.status(400).json({ ok: false, error: otpResult.error })
      }
    }

    // Ensure all integration tokens exist for approved merchant
    if (client.approvalStatus === 'APPROVED') {
      await ensureMerchantIntegrationTokens(client)
    }

    // Sign session token
    const token = await createSessionToken(client.id, {
      userAgent: req.get('user-agent'),
      ipAddress: getRequestIp(req),
    })
    setMerchantSessionCookie(res, token)

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
        subscriptionPlan: client.subscriptionPlan,
        txLimit: client.txLimit,
        txCount: client.txCount,
      },
      ...(tokenTransport === 'bearer' ? { token } : {}),
    })
  } catch (err) {
    console.error('[auth/login] error:', err)
    return res.status(500).json({ ok: false, error: 'Internal login error' })
  }
})

// ─── Current Session ────────────────────────────────────────────────

authRouter.get('/session', async (req: Request, res: Response) => {
  try {
    const credential = getRequestAuthToken(req, MERCHANT_SESSION_COOKIE_NAME)
    const clientId = await verifySessionToken(credential?.token)
    if (!clientId) {
      clearMerchantSessionCookie(res)
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
        webhookUrl: true,
        checkoutTtlMin: true,
        subscriptionPlan: true,
        subscriptionEndsAt: true,
        isFreeTrial: true,
        txLimit: true,
        txCount: true,
        createdAt: true,
      },
    })

    if (!client || !isApprovedActiveMerchant(client)) {
      clearMerchantSessionCookie(res)
      return res.status(401).json({ ok: false, authenticated: false })
    }

    // Auto-sync active Free Trial merchant with latest trial plan limits
    if (client.isFreeTrial || client.subscriptionPlan === 'FREE_TRIAL') {
      const trialPlan = await (db.plan as any).findUnique({ where: { name: 'FREE_TRIAL' } })
      if (trialPlan) {
        let needsUpdate = false
        const updateData: Record<string, any> = {}

        if (trialPlan.maxTransactions && client.txLimit !== trialPlan.maxTransactions) {
          client.txLimit = trialPlan.maxTransactions
          updateData.txLimit = trialPlan.maxTransactions
          needsUpdate = true
        }

        if (needsUpdate) {
          await db.client.update({
            where: { id: client.id },
            data: updateData,
          }).catch(() => {})
        }
      }
    }

    return res.json({ ok: true, authenticated: true, client })
  } catch (err) {
    return res.status(500).json({ ok: false, authenticated: false })
  }
})

// ─── Logout ─────────────────────────────────────────────────────────

authRouter.post('/logout', async (req: Request, res: Response) => {
  const credential = getRequestAuthToken(req, MERCHANT_SESSION_COOKIE_NAME)
  await revokeSessionToken(credential?.token, 'MERCHANT').catch(() => false)
  clearMerchantSessionCookie(res)
  return res.json({ ok: true, message: 'Logged out successfully' })
})

// ─── Android Detector APK Login (with OTP support) ───────────────────

authRouter.post('/apk-login', credentialAttemptLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password, verificationId, otp, skipOtp, tokenTransport } = req.body
    if (!email || !password || typeof password !== 'string' || Buffer.byteLength(password, 'utf8') > 128) {
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

    const isBypass = isExplicitDevAuthEnabled('AUTH_ALLOW_DEV_BYPASS') && skipOtp === true

    // OTP required if not bypassed
    if (!isBypass && (!verificationId || !otp)) {
      const { verification } = await issueOtpVerification(cleanEmail, 'MERCHANT_LOGIN')
      return res.json({
        ok: true,
        otpRequired: true,
        verificationId: verification.id,
        expiresInSeconds: OTP_TTL_MS / 1000,
      })
    }

    if (!isBypass) {
      const otpResult = await verifyOtpCode(db, cleanEmail, verificationId, otp, 'MERCHANT_LOGIN')
      if (!otpResult.valid) {
        return res.status(400).json({ ok: false, error: otpResult.error })
      }
    }

    const provisionedClient = await ensureMerchantIntegrationTokens(client)
    const token = tokenTransport === 'bearer'
      ? await createSessionToken(provisionedClient.id, {
          userAgent: req.get('user-agent'),
          ipAddress: getRequestIp(req),
        })
      : null

    return res.json({
      ok: true,
      ...(token ? { token } : {}),
      detectToken: provisionedClient.detectToken,
      client: {
        id: provisionedClient.id,
        businessName: provisionedClient.businessName,
        email: provisionedClient.email,
        instapayHandle: provisionedClient.instapayHandle,
        instapayPaymentUrl: provisionedClient.instapayPaymentUrl,
        webhookUrl: provisionedClient.webhookUrl,
        subscriptionPlan: provisionedClient.subscriptionPlan,
        subscriptionEndsAt: provisionedClient.subscriptionEndsAt,
        txCount: provisionedClient.txCount,
        txLimit: provisionedClient.txLimit,
      },
    })
  } catch (err) {
    console.error('[auth/apk-login] error:', err)
    return res.status(500).json({ ok: false, error: 'APK Login error' })
  }
})

// ─── Password Reset via OTP ─────────────────────────────────────────

authRouter.post('/password-reset/request', otpDispatchLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ ok: false, error: 'Email is required' })

    const cleanEmail = normalizeEmail(email)
    const client = await db.client.findUnique({ where: { email: cleanEmail } })
    if (!client) {
      // Security: Don't leak whether email exists
      return res.json({ ok: true, message: 'If an account exists, a reset code has been sent.' })
    }

    const { otp, verification } = await issueOtpVerification(cleanEmail, 'PASSWORD_RESET')

    return res.json({
      ok: true,
      verificationId: verification.id,
      message: 'Reset verification code sent.',
      expiresInSeconds: OTP_TTL_MS / 1000,
      ...(isExplicitDevAuthEnabled('AUTH_EXPOSE_DEV_OTP') ? { devOtp: otp } : {}),
    })
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Failed to request password reset' })
  }
})

authRouter.post('/password-reset/confirm', credentialAttemptLimiter, async (req: Request, res: Response) => {
  try {
    const { email, verificationId, otp, password } = req.body
    if (!email || !verificationId || !otp || !password) {
      return res.status(400).json({ ok: false, error: 'All fields are required' })
    }

    const passwordError = validatePasswordPolicy(password)
    if (passwordError) {
      return res.status(400).json({ ok: false, error: passwordError })
    }

    const cleanEmail = normalizeEmail(email)
    const otpResult = await verifyOtpCode(db, cleanEmail, verificationId, otp, 'PASSWORD_RESET')
    if (!otpResult.valid) {
      return res.status(400).json({ ok: false, error: otpResult.error })
    }

    const passwordHash = hashPassword(password)
    const client = await db.client.update({
      where: { email: cleanEmail },
      data: { passwordHash },
    })
    await revokeAllMerchantSessions(client.id)

    return res.json({ ok: true, message: 'Password updated successfully. You can now log in.' })
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Failed to reset password' })
  }
})
