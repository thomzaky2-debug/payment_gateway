import { Router, Request, Response } from 'express'
import { db } from '../db.js'
import {
  verifyPassword,
  timingSafeCompare,
  ensureMerchantIntegrationTokens,
} from '../services/authService.js'
import {
  createMobileSession,
  rotateMobileSession,
  revokeMobileSessionFamily,
} from '../services/mobileAuthService.js'
import {
  verifyOtpCode,
  normalizeEmail,
} from '../lib/emailDelivery.js'
import { verifyTotp } from '../lib/totp.js'
import { getRequestIp, getRequestAuthToken } from '../middleware/authToken.js'
import { createRateLimiterWithKey } from '../lib/rateLimiter.js'
import { isExplicitDevAuthEnabled, issueOtpVerification, OTP_TTL_MS } from './authRoutes.js'
import { cancelPublicDeletionRequest, isWithinDeletionGracePeriod } from '../services/accountService.js'
import { sendInternalError } from '../lib/safeError.js'

export const mobileAuthRouter = Router()

mobileAuthRouter.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Pragma', 'no-cache')
  next()
})

// Rate limiter for mobile login attempts: 10 attempts per 15 min per IP/email
const mobileLoginLimiter = createRateLimiterWithKey(
  15 * 60 * 1000,
  10,
  'Too many login attempts. Please wait before trying again.',
  (req) => {
    const email = typeof req.body?.email === 'string' ? normalizeEmail(req.body.email).slice(0, 320) : 'missing'
    return `mobile-login:${getRequestIp(req)}:${email}`
  }
)

// Rate limiter for token refresh: 60 per 15 min per device & IP
const mobileRefreshLimiter = createRateLimiterWithKey(
  15 * 60 * 1000,
  60,
  'Too many token refresh attempts. Please wait before trying again.',
  (req) => {
    const deviceId = typeof req.body?.deviceId === 'string' ? req.body.deviceId.slice(0, 128) : 'nodevice'
    return `mobile-refresh:${getRequestIp(req)}:${deviceId}`
  }
)

/**
 * POST /api/auth/mobile/login
 * High-security bearer login for Merchant/Detector and Admin mobile apps.
 * Returns accessToken (short-lived) + refreshToken (rotating). Does NOT return detectToken.
 */
mobileAuthRouter.post('/login', mobileLoginLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password, verificationId, otp, totp, skipOtp, deviceId, appType } = req.body

    if (!email || !password || typeof password !== 'string' || Buffer.byteLength(password, 'utf8') > 128) {
      return res.status(400).json({ ok: false, error: 'Email and password are required' })
    }

    const cleanEmail = normalizeEmail(email)
    const expectedAdminEmail = process.env.ADMIN_EMAIL ? normalizeEmail(process.env.ADMIN_EMAIL) : null
    // An explicit app type is authoritative. The same address may legitimately identify an
    // owner and a merchant account, so an admin-email fallback must never override a merchant
    // app's requested role. Keep the email fallback only for older admin builds that omitted
    // appType.
    const hasExplicitAppType = appType === 'admin' || appType === 'merchant'
    const isAdminTarget =
      appType === 'admin' || (!hasExplicitAppType && Boolean(expectedAdminEmail && cleanEmail === expectedAdminEmail))

    // ─── ADMIN MOBILE LOGIN ──────────────────────────────────────────────
    if (isAdminTarget) {
      const adminPassword = process.env.ADMIN_PASSWORD
      if (!adminPassword) {
        return res.status(500).json({ ok: false, error: 'ADMIN_PASSWORD is not configured' })
      }

      const totpSecret = process.env.ADMIN_TOTP_SECRET
      const isLocalTest = process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development'
      const isDevBypass = isExplicitDevAuthEnabled('AUTH_ALLOW_DEV_BYPASS') && skipOtp === true

      const passwordMatches = timingSafeCompare(password, adminPassword)
      const totpCandidate = totp || otp
      const totpMatches =
        isDevBypass ||
        (isLocalTest && !totpSecret) ||
        (Boolean(totpSecret) && typeof totpCandidate === 'string' && verifyTotp(totpCandidate, totpSecret!))

      if (!passwordMatches || !totpMatches) {
        return res.status(401).json({ ok: false, error: 'Invalid admin credentials or TOTP code' })
      }

      const session = await createMobileSession({
        kind: 'OWNER',
        deviceId,
        userAgent: req.get('user-agent'),
        ipAddress: getRequestIp(req),
      })

      return res.json({
        ok: true,
        role: 'admin',
        accessToken: session.accessToken,
        accessExpiresAt: session.accessExpiresAt,
        refreshToken: session.refreshToken,
        refreshExpiresAt: session.refreshExpiresAt,
      })
    }

    // ─── MERCHANT / DETECTOR MOBILE LOGIN ────────────────────────────────
    const cleanDeviceId = typeof deviceId === 'string' ? deviceId.trim() : ''
    if (!cleanDeviceId) {
      return res.status(400).json({ ok: false, error: 'deviceId is required for merchant mobile login' })
    }

    const client = await db.client.findUnique({ where: { email: cleanEmail } })
    if (!client || !verifyPassword(password, client.passwordHash)) {
      return res.status(401).json({ ok: false, error: 'Invalid credentials' })
    }

    // Grace-period cancellation: if the account is deactivated due to a pending
    // public deletion (approvalStatus still APPROVED, deletionRequestedAt is in the future),
    // allow the merchant to log in, which cancels the deletion request.
    const isPendingDeletion = isWithinDeletionGracePeriod(client)

    if (!client.isActive && !isPendingDeletion) {
      return res.status(403).json({
        ok: false,
        error:
          client.approvalStatus === 'PENDING'
            ? 'Your account is pending admin approval. You can login once approved.'
            : 'Your merchant account is inactive or rejected. Contact admin for assistance.',
      })
    }

    const isBypass = isExplicitDevAuthEnabled('AUTH_ALLOW_DEV_BYPASS') && skipOtp === true

    // STEP 1: Issue OTP if not submitted
    if (!isBypass && (!verificationId || !otp)) {
      const { otp: generatedOtp, verification } = await issueOtpVerification(cleanEmail, 'MERCHANT_LOGIN')
      return res.json({
        ok: true,
        otpRequired: true,
        verificationId: verification.id,
        expiresInSeconds: OTP_TTL_MS / 1000,
        message: 'Login verification code sent to your email.',
        ...(isExplicitDevAuthEnabled('AUTH_EXPOSE_DEV_OTP') ? { devOtp: generatedOtp } : {}),
      })
    }

    // STEP 2: Verify submitted OTP
    if (!isBypass) {
      const otpResult = await verifyOtpCode(db, cleanEmail, verificationId, otp, 'MERCHANT_LOGIN')
      if (!otpResult.valid) {
        return res.status(400).json({ ok: false, error: otpResult.error })
      }
    }

    // Ensure merchant tokens exist for approved merchant.
    // If the merchant is logging in during the 72-h grace period, cancel the deletion.
    let provisioned = await ensureMerchantIntegrationTokens(client)
    if (isPendingDeletion) {
      await cancelPublicDeletionRequest(client.id)
      provisioned = await ensureMerchantIntegrationTokens({ ...provisioned, isActive: true })
    }

    // Create rotating mobile session
    const session = await createMobileSession({
      kind: 'MERCHANT',
      clientId: provisioned.id,
      deviceId,
      userAgent: req.get('user-agent'),
      ipAddress: getRequestIp(req),
    })

    return res.json({
      ok: true,
      role: 'merchant',
      accessToken: session.accessToken,
      accessExpiresAt: session.accessExpiresAt,
      refreshToken: session.refreshToken,
      refreshExpiresAt: session.refreshExpiresAt,
      client: {
        id: provisioned.id,
        businessName: provisioned.businessName,
        email: provisioned.email,
        instapayHandle: provisioned.instapayHandle,
        instapayPaymentUrl: provisioned.instapayPaymentUrl,
        webhookUrl: provisioned.webhookUrl,
        subscriptionPlan: provisioned.subscriptionPlan,
        subscriptionEndsAt: provisioned.subscriptionEndsAt,
        txCount: provisioned.txCount,
        txLimit: provisioned.txLimit,
      },
    })
  } catch (err: unknown) {
    return sendInternalError(res, err, 'Mobile login error')
  }
})

/**
 * POST /api/auth/mobile/refresh
 * Exchanges a rotating refresh token for a new access/refresh pair.
 * Detects reuse of old tokens and immediately revokes the session family.
 */
mobileAuthRouter.post('/refresh', mobileRefreshLimiter, async (req: Request, res: Response) => {
  try {
    const { refreshToken, deviceId } = req.body
    if (!refreshToken || typeof refreshToken !== 'string') {
      return res.status(400).json({ ok: false, error: 'refreshToken is required' })
    }

    const result = await rotateMobileSession({
      refreshToken,
      deviceId,
      userAgent: req.get('user-agent'),
      ipAddress: getRequestIp(req),
    })

    if (!result.ok) {
      const failed = result as { ok: false; error: string; status: number; familyRevoked?: boolean }
      return res.status(failed.status).json({
        ok: false,
        error: failed.error,
        ...(failed.familyRevoked ? { familyRevoked: true } : {}),
      })
    }

    return res.json({
      ok: true,
      role: result.kind === 'OWNER' ? 'admin' : 'merchant',
      ...result.tokens,
    })
  } catch (err: unknown) {
    return sendInternalError(res, err, 'Token refresh error')
  }
})

/**
 * POST /api/auth/mobile/logout
 * Revokes the session family; never blocked by origin or rate limits.
 */
mobileAuthRouter.post('/logout', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body || {}
    const bearer = getRequestAuthToken(req, 'none')

    await revokeMobileSessionFamily({
      refreshToken: typeof refreshToken === 'string' ? refreshToken : null,
      accessToken: bearer?.token || null,
    }).catch(() => false)

    return res.json({ ok: true, message: 'Logged out successfully' })
  } catch (err: unknown) {
    return sendInternalError(res, err, 'Logout error')
  }
})
