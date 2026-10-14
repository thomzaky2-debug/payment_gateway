import { Router, Request, Response } from 'express'
import { requireMerchant } from '../middleware/requireMerchant.js'
import {
  deleteMerchantAccount,
  requestPublicAccountDeletion,
} from '../services/accountService.js'
import { clearMerchantSessionCookie } from '../lib/authCookies.js'
import { getRequestIp } from '../middleware/authToken.js'
import { createRateLimiterWithKey } from '../lib/rateLimiter.js'
import { sendInternalError } from '../lib/safeError.js'
import { renderAccountDeletionHtml } from '../views/accountDeletionHtml.js'

export const accountRouter = Router()

import { normalizeEmail } from '../lib/emailDelivery.js'

// Rate limiter for account deletion: 5 attempts per 15 min per merchant and IP (fails closed)
const accountDeletionLimiter = createRateLimiterWithKey(
  15 * 60 * 1000,
  5,
  'Too many account deletion attempts. Please try again later.',
  (req) => {
    const client = (req as any).client
    return `account-delete:${getRequestIp(req)}:${client?.id || 'unknown'}`
  }
)

// Public rate limiter for deletion requests: 5 per 15 min per IP
const deletionRequestIpLimiter = createRateLimiterWithKey(
  15 * 60 * 1000,
  5,
  'Too many deletion requests from this network. Please try again later.',
  (req) => `account-delete-request:ip:${getRequestIp(req)}`
)

// Public rate limiter for deletion requests: 3 per 15 min per email
const deletionRequestEmailLimiter = createRateLimiterWithKey(
  15 * 60 * 1000,
  3,
  'Too many deletion requests for this email address. Please try again later.',
  (req) => {
    const rawEmail = typeof req.body?.email === 'string' ? req.body.email : 'missing'
    return `account-delete-request:email:${normalizeEmail(rawEmail).slice(0, 320)}`
  }
)

/**
 * DELETE /api/account
 * Authenticated endpoint to delete a merchant account.
 * Requires password and fresh OTP. Immediately scrubs personal data, revokes sessions/devices,
 * cancels pending webhooks, and preserves compliance transaction records.
 */
accountRouter.delete('/', requireMerchant, accountDeletionLimiter, async (req: Request, res: Response) => {
  try {
    const client = (req as any).client
    const { password, verificationId, otp, skipOtp } = req.body

    const result = await deleteMerchantAccount({
      clientId: client.id,
      password,
      verificationId,
      otp,
      skipOtp,
    })

    if (!result.ok) {
      const failed = result as { ok: false; error: string; status: number }
      return res.status(failed.status).json({ ok: false, error: failed.error })
    }

    if ('otpRequired' in result) {
      return res.json(result)
    }

    clearMerchantSessionCookie(res)
    return res.json({ ok: true, message: result.message })
  } catch (err: unknown) {
    return sendInternalError(res, err, 'Account deletion failed')
  }
})

/**
 * POST /api/account/deletion-request
 * Public endpoint for users who no longer have the app to request deletion.
 */
accountRouter.post(
  '/deletion-request',
  deletionRequestIpLimiter,
  deletionRequestEmailLimiter,
  async (req: Request, res: Response) => {
  try {
    const { email } = req.body
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ ok: false, error: 'Email is required' })
    }

    await requestPublicAccountDeletion(email).catch(() => false)

    return res.json({
      ok: true,
      message: 'If an active account exists for this email, deletion instructions have been sent.',
    })
  } catch (err: unknown) {
    return sendInternalError(res, err, 'Deletion request failed')
  }
})

/**
 * GET /account-deletion
 * Public static web page describing account and data deletion for Google Play Store compliance.
 */
accountRouter.get('/deletion-info', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  return res.send(renderAccountDeletionHtml())
})
