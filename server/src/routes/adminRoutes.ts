import { Router, Request, Response } from 'express'
import { db } from '../db.js'
import {
  createOwnerSessionToken,
  generateMerchantKeys,
  OWNER_SESSION_COOKIE_NAME,
  revokeAllMerchantSessions,
  revokeSessionToken,
  timingSafeCompare,
} from '../services/authService.js'
import { emitCheckoutUpdate } from '../services/notificationService.js'
import { forwardToClientWebhook } from '../services/webhookService.js'
import { createRateLimiter, createRateLimiterWithKey } from '../lib/rateLimiter.js'
import { requireAdmin } from '../middleware/requireAdmin.js'
import { sendMerchantApprovalEmail } from '../lib/emailDelivery.js'
import { clearOwnerSessionCookie, setOwnerSessionCookie } from '../lib/authCookies.js'
import { getRequestAuthToken, getRequestIp } from '../middleware/authToken.js'
import { confirmTransactionAsOwner } from '../services/settlementService.js'
import { verifyTotp } from '../lib/totp.js'
import { normalizeEmail } from '../lib/emailDelivery.js'

export const adminRouter = Router()

adminRouter.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Pragma', 'no-cache')
  next()
})

const adminAuthLimiter = createRateLimiter(15 * 60 * 1000, 30, 'Too many admin login attempts.')
const adminAccountLimiter = createRateLimiterWithKey(
  15 * 60 * 1000,
  10,
  'Too many admin login attempts.',
  () => 'platform-owner'
)

function safeAdminClient(client: any) {
  const {
    passwordHash: _passwordHash,
    apiKeyHash: _apiKeyHash,
    detectTokenHash: _detectTokenHash,
    webhookSecretHash: _webhookSecretHash,
    ...safe
  } = client
  return safe
}

// ─── Admin Login ────────────────────────────────────────────────────

adminRouter.post('/auth', adminAuthLimiter, adminAccountLimiter, async (req: Request, res: Response) => {
  const { password, email, totp, tokenTransport } = req.body
  const expectedPassword = process.env.ADMIN_PASSWORD
  if (!expectedPassword || expectedPassword.length < 12) {
    return res.status(500).json({ ok: false, error: 'ADMIN_PASSWORD environment variable is not configured' })
  }

  const isLocalRuntime = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
  const expectedEmail = process.env.ADMIN_EMAIL
  const totpSecret = process.env.ADMIN_TOTP_SECRET
  const emailIsValid = isLocalRuntime && !email
    ? true
    : typeof email === 'string' && Boolean(expectedEmail) && normalizeEmail(email) === normalizeEmail(expectedEmail!)
  const totpIsValid = isLocalRuntime && !totpSecret
    ? true
    : Boolean(totpSecret) && verifyTotp(totp, totpSecret!)

  if (
    !password ||
    typeof password !== 'string' ||
    Buffer.byteLength(password, 'utf8') > 128 ||
    !timingSafeCompare(password, expectedPassword) ||
    !emailIsValid ||
    !totpIsValid
  ) {
    return res.status(401).json({ ok: false, error: 'Invalid admin credentials' })
  }

  const token = await createOwnerSessionToken({
    userAgent: req.get('user-agent'),
    ipAddress: getRequestIp(req),
  })

  setOwnerSessionCookie(res, token)

  // Browser callers receive only the HttpOnly cookie. Native clients must opt
  // in explicitly so merely supplying MFA fields never exposes a bearer token
  // to browser JavaScript.
  const nativeBearerRequested = tokenTransport === 'bearer'
  return res.json({ ok: true, ...(nativeBearerRequested ? { token } : {}) })
})

// ─── Admin Logout ───────────────────────────────────────────────────

adminRouter.post('/logout', async (req: Request, res: Response) => {
  const credential = getRequestAuthToken(req, OWNER_SESSION_COOKIE_NAME)
  await revokeSessionToken(credential?.token, 'OWNER').catch(() => false)
  clearOwnerSessionCookie(res)
  return res.json({ ok: true, message: 'Admin logged out' })
})

// ─── Verify Admin Session ───────────────────────────────────────────

adminRouter.get('/session', requireAdmin, (_req: Request, res: Response) => {
  return res.json({ ok: true, authenticated: true })
})

// ─── Platform Overview Stats ────────────────────────────────────────

adminRouter.get('/stats', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const [
      totalClients,
      pendingClients,
      approvedClients,
      activeClients,
      suspendedClients,
      totalTransactions,
      confirmedTransactions,
      totalVolumeResult,
      totalDetectors,
      onlineDetectors,
      failedWebhooks,
      unmatchedPayments,
    ] = await Promise.all([
      db.client.count(),
      db.client.count({ where: { approvalStatus: 'PENDING' } }),
      db.client.count({ where: { approvalStatus: 'APPROVED' } }),
      db.client.count({ where: { approvalStatus: 'APPROVED', isActive: true } }),
      db.client.count({ where: { approvalStatus: 'APPROVED', isActive: false } }),
      db.transaction.count(),
      db.transaction.count({ where: { status: 'CONFIRMED' } }),
      db.transaction.aggregate({
        where: { status: 'CONFIRMED' },
        _sum: { amountEgp: true },
      }),
      db.detectorDevice.count(),
      db.detectorDevice.count({ where: { lastSeenAt: { gte: new Date(Date.now() - 5 * 60 * 1000) } } }),
      db.webhookLog.count({ where: { isSuccess: false } }),
      db.mismatchedPayment.count({ where: { status: 'UNMATCHED' } }),
    ])

    return res.json({
      ok: true,
      stats: {
        totalClients,
        pendingClients,
        approvedClients,
        activeClients,
        suspendedClients,
        totalTransactions,
        confirmedTransactions,
        totalVolumeEgp: totalVolumeResult._sum.amountEgp || 0,
        totalDetectors,
        onlineDetectors,
        failedWebhooks,
        unmatchedPayments,
      },
    })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})

// ─── Platform Transactions ──────────────────────────────────────────

adminRouter.get('/transactions', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status, limit = '50' } = req.query
    const where: any = {}
    if (status && status !== 'all') {
      where.status = String(status).toUpperCase()
    }
    const transactions = await db.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(100, Math.max(1, Number(limit))),
      include: {
        client: {
          select: { id: true, businessName: true, email: true },
        },
      },
    })
    return res.json({ ok: true, transactions })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})

// ─── List Merchants ─────────────────────────────────────────────────

adminRouter.get('/clients', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const clients = await db.client.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        slug: true,
        businessName: true,
        businessType: true,
        firstName: true,
        lastName: true,
        whatsappNumber: true,
        email: true,
        instapayHandle: true,
        instapayPaymentUrl: true,
        approvalStatus: true,
        isActive: true,
        apiKey: true,
        detectToken: true,
        webhookUrl: true,
        webhookSecret: true,
        subscriptionPlan: true,
        subscriptionEndsAt: true,
        isFreeTrial: true,
        txLimit: true,
        txCount: true,
        createdAt: true,
        updatedAt: true,
        detectorDevices: { orderBy: { lastSeenAt: 'desc' }, take: 1 },
        _count: {
          select: { transactions: true },
        },
      },
    })
    return res.json({ ok: true, clients })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})

// ─── Approve Merchant ───────────────────────────────────────────────

// Monitoring and operational controls for an individual merchant.
adminRouter.get('/clients/:id/overview', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)
    const client = await db.client.findUnique({
      where: { id },
      select: {
        id: true,
        businessName: true,
        approvalStatus: true,
        isActive: true,
        apiKeyLastUsedAt: true,
        detectTokenLastUsedAt: true,
        subscriptionEndsAt: true,
        checkoutTtlMin: true,
        detectorDevices: { orderBy: { lastSeenAt: 'desc' } },
      },
    })
    if (!client) return res.status(404).json({ ok: false, error: 'Merchant not found.' })

    const [transactionGroups, confirmedVolume, unmatchedPayments, webhookTotal, webhookSuccess, latestWebhook, activeSessions, latestTransaction] = await Promise.all([
      db.transaction.groupBy({ by: ['status'], where: { clientId: id }, _count: { _all: true } }),
      db.transaction.aggregate({ where: { clientId: id, status: 'CONFIRMED' }, _sum: { amountEgp: true } }),
      db.mismatchedPayment.count({ where: { clientId: id, status: 'UNMATCHED' } }),
      db.webhookLog.count({ where: { clientId: id } }),
      db.webhookLog.count({ where: { clientId: id, isSuccess: true } }),
      db.webhookLog.findFirst({
        where: { clientId: id },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, isSuccess: true, statusCode: true, event: true },
      }),
      db.authSession.count({ where: { clientId: id, kind: 'MERCHANT', revokedAt: null, expiresAt: { gt: new Date() } } }),
      db.transaction.findFirst({
        where: { clientId: id },
        orderBy: { createdAt: 'desc' },
        select: { sessionId: true, status: true, amountEgp: true, createdAt: true },
      }),
    ])

    const transactionsByStatus = Object.fromEntries(transactionGroups.map((group) => [group.status, group._count._all]))
    const totalTransactions = transactionGroups.reduce((total, group) => total + group._count._all, 0)
    const detectorOnlineCount = client.detectorDevices.filter(
      (device) => Date.now() - device.lastSeenAt.getTime() <= 5 * 60 * 1000
    ).length

    return res.json({
      ok: true,
      overview: {
        ...client,
        activeSessions,
        detectorOnlineCount,
        totalTransactions,
        transactionsByStatus,
        confirmedVolumeEgp: confirmedVolume._sum.amountEgp || 0,
        unmatchedPayments,
        webhookTotal,
        webhookSuccess,
        webhookSuccessRate: webhookTotal > 0 ? Math.round((webhookSuccess / webhookTotal) * 100) : null,
        latestWebhook,
        latestTransaction,
      },
    })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})

adminRouter.patch('/clients/:id/access', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)
    if (typeof req.body?.isActive !== 'boolean') {
      return res.status(400).json({ ok: false, error: 'isActive must be a boolean.' })
    }
    const existing = await db.client.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ ok: false, error: 'Merchant not found.' })
    if (req.body.isActive && existing.approvalStatus !== 'APPROVED') {
      return res.status(409).json({ ok: false, error: 'Only approved merchants can be activated.' })
    }

    const client = await db.client.update({ where: { id }, data: { isActive: req.body.isActive } })
    const revokedSessions = req.body.isActive ? 0 : await revokeAllMerchantSessions(id)
    await db.auditLog.create({
      data: {
        action: req.body.isActive ? 'ACTIVATE_MERCHANT' : 'SUSPEND_MERCHANT',
        details: `${req.body.isActive ? 'Activated' : 'Suspended'} merchant ${client.businessName}${revokedSessions ? ` and revoked ${revokedSessions} session(s)` : ''}`,
      },
    })
    return res.json({ ok: true, client: safeAdminClient(client), revokedSessions })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})

adminRouter.post('/clients/:id/revoke-sessions', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)
    const client = await db.client.findUnique({ where: { id }, select: { businessName: true } })
    if (!client) return res.status(404).json({ ok: false, error: 'Merchant not found.' })
    const revokedSessions = await revokeAllMerchantSessions(id)
    await db.auditLog.create({
      data: { action: 'REVOKE_MERCHANT_SESSIONS', details: `Revoked ${revokedSessions} active session(s) for ${client.businessName}` },
    })
    return res.json({ ok: true, revokedSessions })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})

adminRouter.post('/clients/:id/rotate-keys', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)
    const existing = await db.client.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ ok: false, error: 'Merchant not found.' })
    if (existing.approvalStatus !== 'APPROVED') {
      return res.status(409).json({ ok: false, error: 'Integration keys can only be rotated for approved merchants.' })
    }
    const keys = generateMerchantKeys()
    const client = await db.client.update({
      where: { id },
      data: {
        apiKey: keys.apiKey,
        detectToken: keys.detectToken,
        webhookSecret: keys.webhookSecret,
        apiKeyHash: keys.apiKeyHash,
        detectTokenHash: keys.detectTokenHash,
        webhookSecretHash: keys.webhookSecretHash,
        apiKeyLastUsedAt: null,
        detectTokenLastUsedAt: null,
      },
    })
    await db.auditLog.create({
      data: { action: 'ROTATE_MERCHANT_KEYS', details: `Rotated API, detector, and webhook credentials for ${client.businessName}` },
    })
    return res.json({ ok: true, client: safeAdminClient(client) })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})

// Approve a new or previously rejected merchant.
adminRouter.post('/clients/:id/approve', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)
    const existing = await db.client.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Merchant not found' })
    }

    const keys = generateMerchantKeys()
    const apiKey = existing.apiKey || keys.apiKey
    const detectToken = existing.detectToken || keys.detectToken
    const webhookSecret = existing.webhookSecret || keys.webhookSecret
    const apiKeyHash = existing.apiKeyHash || keys.apiKeyHash
    const detectTokenHash = existing.detectTokenHash || keys.detectTokenHash
    const webhookSecretHash = existing.webhookSecretHash || keys.webhookSecretHash

    const client = await db.client.update({
      where: { id },
      data: {
        approvalStatus: 'APPROVED',
        isActive: true,
        apiKey,
        detectToken,
        webhookSecret,
        apiKeyHash,
        detectTokenHash,
        webhookSecretHash,
      },
    })
    await revokeAllMerchantSessions(client.id)

    // Create an in-app welcome notification in the merchant's inbox
    await db.merchantNotification.create({
      data: {
        clientId: client.id,
        title: '🎉 Account Approved & Integration Ready!',
        message: `Welcome to InstaPay Payment Gateway! Your account for "${client.businessName}" has been approved. Your live API Key, Companion Detector Token, and Webhook Secret are activated. Head to the Developer Portal to retrieve your keys and start accepting payments.`,
        severity: 'INFO',
      },
    }).catch((err) => console.warn('[admin/approve] notification error:', err))

    // Send email notification to merchant
    sendMerchantApprovalEmail({
      to: client.email,
      businessName: client.businessName,
      apiKeyPrefix: apiKey.slice(0, 14) + '...',
    }).catch((err) => console.warn('[admin/approve] email error:', err))

    await db.auditLog.create({
      data: {
        action: 'APPROVE_MERCHANT',
        details: `Approved merchant ${client.businessName} (${client.email}) and generated integration tokens (API key: ${apiKey.slice(0, 12)}..., detect token, webhook secret)`,
      },
    })

    return res.json({ ok: true, client: safeAdminClient(client) })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})

// ─── Reject Merchant ────────────────────────────────────────────────

adminRouter.post('/clients/:id/reject', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)
    const client = await db.client.update({
      where: { id },
      data: {
        approvalStatus: 'REJECTED',
        isActive: false,
      },
    })
    await revokeAllMerchantSessions(client.id)

    await db.auditLog.create({
      data: {
        action: 'REJECT_MERCHANT',
        details: `Rejected merchant ${client.businessName}`,
      },
    })

    return res.json({ ok: true, client: safeAdminClient(client) })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})

// ─── Force Confirm Transaction ──────────────────────────────────────

adminRouter.post('/transactions/:sessionId/confirm', requireAdmin, async (req: Request, res: Response) => {
  try {
    const sessionId = String(req.params.sessionId)
    const settlement = await confirmTransactionAsOwner(sessionId)
    if (!settlement) {
      return res.status(404).json({ ok: false, error: 'Transaction not found' })
    }
    const updated = settlement.transaction

    // Emit live update to Customer Checkout Waiting Screen
    emitCheckoutUpdate({
      sessionId: updated.sessionId,
      status: 'CONFIRMED',
      amountEgp: updated.amountEgp,
      detectedAmountEgp: updated.detectedAmountEgp,
      senderHandle: updated.senderHandle,
      detectedRef: updated.detectedRef,
      detectedAt: updated.detectedAt?.toISOString() ?? null,
    })

    // Deliver signed webhook to Merchant server
    if (settlement.newlyConfirmed && updated.client.webhookUrl) {
      void forwardToClientWebhook(updated.client.id, updated.client.webhookUrl, updated.client.webhookSecret, {
        event: updated.purpose === 'SUBSCRIPTION' ? 'subscription.payment_confirmed' : 'payment.confirmed',
        clientId: updated.client.id,
        businessName: updated.client.businessName,
        transaction: {
          sessionId: updated.sessionId,
          senderHandle: updated.senderHandle,
          recipientHandle: updated.recipientHandle,
          amountEgp: updated.amountEgp,
          detectedAmountEgp: updated.detectedAmountEgp,
          currency: updated.currency,
          status: updated.status,
          detectedRef: updated.detectedRef,
          detectedAt: updated.detectedAt?.toISOString() ?? null,
          note: updated.note,
          createdAt: updated.createdAt.toISOString(),
        },
      })
    }

    await db.auditLog.create({
      data: {
        action: 'FORCE_CONFIRM',
        details: settlement.newlyConfirmed
          ? `Admin force-confirmed transaction ${sessionId} for ${updated.amountEgp} EGP`
          : `Admin confirmation was idempotent for already-confirmed transaction ${sessionId}`,
      },
    })

    const { client: _client, ...safeTransaction } = updated
    return res.json({ ok: true, transaction: safeTransaction })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})

// ─── Audit Log ──────────────────────────────────────────────────────

adminRouter.get('/audit', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const logs = await db.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return res.json({ ok: true, logs })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})

// ─── Webhook Logs & Retries ─────────────────────────────────────────

adminRouter.get('/webhooks', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const logs = await db.webhookLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        client: {
          select: { businessName: true, email: true },
        },
      },
    })
    return res.json({ ok: true, logs })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})

// ─── Subscription Plans Management ──────────────────────────────────

adminRouter.get('/plans', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const plans = await db.plan.findMany({
      orderBy: { priceEgp: 'asc' },
    })
    const now = Date.now()
    return res.json({
      ok: true,
      plans: plans.map((plan) => ({
        ...plan,
        hasActiveOffer: plan.offerPriceEgp !== null && plan.offerPriceEgp < plan.priceEgp && Boolean(plan.offerEndsAt && plan.offerEndsAt.getTime() > now),
      })),
    })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})

adminRouter.patch('/plans', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, priceEgp, maxTransactions, periodDays, description, isActive, offerPriceEgp, offerLabel, offerValidDays, clearOffer } = req.body
    if (!name) {
      return res.status(400).json({ ok: false, error: 'Plan name is required.' })
    }

    const currentPlan = await db.plan.findUnique({ where: { name: String(name).toUpperCase() } })
    if (!currentPlan) return res.status(404).json({ ok: false, error: 'Plan not found.' })

    const data: Record<string, any> = {}
    if (priceEgp !== undefined) {
      const parsedPrice = Number(priceEgp)
      if (!Number.isFinite(parsedPrice) || parsedPrice < 0 || parsedPrice > 10_000_000) return res.status(400).json({ ok: false, error: 'Plan price must be between 0 and 10,000,000 EGP.' })
      data.priceEgp = parsedPrice
    }
    if (maxTransactions !== undefined) {
      const parsedLimit = Number(maxTransactions)
      if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100_000_000) return res.status(400).json({ ok: false, error: 'Transaction limit must be between 1 and 100,000,000.' })
      data.maxTransactions = parsedLimit
    }
    if (periodDays !== undefined) {
      const parsedPeriod = Number(periodDays)
      if (!Number.isInteger(parsedPeriod) || parsedPeriod < 1 || parsedPeriod > 3650) return res.status(400).json({ ok: false, error: 'Plan duration must be between 1 and 3,650 days.' })
      data.periodDays = parsedPeriod
    }
    if (description !== undefined) data.description = String(description)
    if (isActive !== undefined) data.isActive = Boolean(isActive)

    if (clearOffer === true || offerPriceEgp === null || offerPriceEgp === '') {
      data.offerPriceEgp = null
      data.offerLabel = null
      data.offerEndsAt = null
    } else if (offerPriceEgp !== undefined) {
      const parsedOfferPrice = Number(offerPriceEgp)
      const basePrice = data.priceEgp ?? currentPlan.priceEgp
      const parsedValidDays = Number(offerValidDays)
      if (basePrice <= 0) return res.status(400).json({ ok: false, error: 'Offers can only be added to paid plans.' })
      if (!Number.isFinite(parsedOfferPrice) || parsedOfferPrice <= 0 || parsedOfferPrice >= basePrice) return res.status(400).json({ ok: false, error: 'Offer price must be greater than 0 EGP and lower than the regular plan price.' })
      if (!Number.isInteger(parsedValidDays) || parsedValidDays < 1 || parsedValidDays > 365) return res.status(400).json({ ok: false, error: 'Offer validity must be between 1 and 365 days.' })
      const cleanLabel = String(offerLabel || 'Limited-time offer').trim()
      if (!cleanLabel || cleanLabel.length > 80) return res.status(400).json({ ok: false, error: 'Offer label must be between 1 and 80 characters.' })
      data.offerPriceEgp = parsedOfferPrice
      data.offerLabel = cleanLabel
      data.offerEndsAt = new Date(Date.now() + parsedValidDays * 24 * 60 * 60 * 1000)
    } else if (data.priceEgp !== undefined && currentPlan.offerPriceEgp !== null && currentPlan.offerPriceEgp >= data.priceEgp) {
      data.offerPriceEgp = null
      data.offerLabel = null
      data.offerEndsAt = null
    }

    const updated = await db.plan.update({
      where: { name: String(name).toUpperCase() },
      data,
    })

    if (updated.name === 'FREE_TRIAL') {
      if (data.maxTransactions !== undefined) {
        await db.client.updateMany({
          where: {
            OR: [{ subscriptionPlan: 'FREE_TRIAL' }, { isFreeTrial: true }],
          },
          data: { txLimit: data.maxTransactions },
        })
      }
      if (data.periodDays !== undefined) {
        const trialClients = await db.client.findMany({
          where: {
            OR: [{ subscriptionPlan: 'FREE_TRIAL' }, { isFreeTrial: true }],
          },
        })
        for (const tc of trialClients) {
          const baseDate = tc.createdAt ? new Date(tc.createdAt).getTime() : Date.now()
          const newEndsAt = new Date(Math.max(Date.now() + 24 * 60 * 60 * 1000, baseDate + data.periodDays * 24 * 60 * 60 * 1000))
          await db.client.update({
            where: { id: tc.id },
            data: { subscriptionEndsAt: newEndsAt },
          })
        }
      }
    }

    const updatedPlan = updated as any
    await db.auditLog.create({
      data: {
        action: 'UPDATE_PLAN',
        details: `Updated plan ${updatedPlan.name}: ${updatedPlan.priceEgp} EGP, max ${updatedPlan.maxTransactions} txs, period ${updatedPlan.periodDays ?? 30} days, active: ${updatedPlan.isActive ?? true}${updatedPlan.offerPriceEgp !== null && updatedPlan.offerEndsAt ? `, offer ${updatedPlan.offerPriceEgp} EGP until ${updatedPlan.offerEndsAt.toISOString()}` : ', no active offer'}`,
      },
    })

    return res.json({ ok: true, plan: updated })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})

// ─── Trial Plan Administration (Period & Transaction Times) ──────────

adminRouter.get('/trial', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const trialPlan = await db.plan.findUnique({
      where: { name: 'FREE_TRIAL' },
    })
    return res.json({ ok: true, trialPlan })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})

adminRouter.patch('/trial', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { periodDays, maxTransactions, isActive, description } = req.body
    const data: Record<string, any> = {}
    if (periodDays !== undefined) data.periodDays = Math.max(1, Number(periodDays))
    if (maxTransactions !== undefined) data.maxTransactions = Math.max(1, Number(maxTransactions))
    if (isActive !== undefined) data.isActive = Boolean(isActive)
    if (description !== undefined) data.description = String(description)

    // Read current trial plan to calculate the delta
    const currentTrial = await (db.plan as any).findUnique({ where: { name: 'FREE_TRIAL' } })
    const previousPeriodDays = currentTrial?.periodDays || 14

    const updated = await (db.plan as any).upsert({
      where: { name: 'FREE_TRIAL' },
      update: data,
      create: {
        name: 'FREE_TRIAL',
        priceEgp: 0,
        maxTransactions: data.maxTransactions ?? 50,
        periodDays: data.periodDays ?? 14,
        description: data.description ?? '14-Day introductory free trial with live InstaPay detection and 50 transactions',
        isActive: data.isActive ?? true,
      },
    })

    // ─── Live Synchronize All Merchants on FREE_TRIAL ─────────────────
    if (data.maxTransactions !== undefined) {
      await db.client.updateMany({
        where: {
          OR: [{ subscriptionPlan: 'FREE_TRIAL' }, { isFreeTrial: true }],
        },
        data: { txLimit: data.maxTransactions },
      })
    }

    if (data.periodDays !== undefined) {
      const newPeriodDays = data.periodDays
      const diffDays = newPeriodDays - previousPeriodDays
      const nowMs = Date.now()

      const trialClients = await db.client.findMany({
        where: {
          OR: [{ subscriptionPlan: 'FREE_TRIAL' }, { isFreeTrial: true }],
        },
      })

      for (const tc of trialClients) {
        let newEndsAt: Date

        if (tc.subscriptionEndsAt) {
          const currentEndsMs = new Date(tc.subscriptionEndsAt).getTime()
          const currentRemainingDays = Math.ceil((currentEndsMs - nowMs) / (24 * 60 * 60 * 1000))

          if (currentRemainingDays > 0) {
            // Active trial: accurately shift remaining days by the change in trial duration
            const targetDays = Math.max(1, Math.min(newPeriodDays, currentRemainingDays + diffDays))
            newEndsAt = new Date(nowMs + targetDays * 24 * 60 * 60 * 1000)
          } else {
            // Expired trial: if admin extended trial duration, give them the extra days
            if (diffDays > 0) {
              newEndsAt = new Date(nowMs + diffDays * 24 * 60 * 60 * 1000)
            } else {
              newEndsAt = new Date(currentEndsMs)
            }
          }
        } else {
          // No end date recorded: grant full configured trial period
          newEndsAt = new Date(nowMs + newPeriodDays * 24 * 60 * 60 * 1000)
        }

        await db.client.update({
          where: { id: tc.id },
          data: { subscriptionEndsAt: newEndsAt },
        })
      }
    }

    const updatedTrial = updated as any
    await db.auditLog.create({
      data: {
        action: 'UPDATE_TRIAL_PLAN',
        details: `Configured Trial Plan: period ${updatedTrial.periodDays ?? 14} days, max ${updatedTrial.maxTransactions ?? 50} txs, active: ${updatedTrial.isActive ?? true}`,
      },
    })

    return res.json({
      ok: true,
      message: `Trial plan configured: ${updatedTrial.periodDays ?? 14} days period, ${updatedTrial.maxTransactions ?? 50} transactions limit`,
      trialPlan: updated,
    })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})

// ─── Manual Merchant Plan Assignment ────────────────────────────────

adminRouter.post('/clients/:id/plan', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)
    const { planName, customTxLimit, extendDays } = req.body

    if (!planName || typeof planName !== 'string') {
      return res.status(400).json({ ok: false, error: 'Plan name is required.' })
    }
    const parsedTxLimit = customTxLimit !== undefined ? Number(customTxLimit) : undefined
    const parsedExtendDays = extendDays !== undefined ? Number(extendDays) : undefined
    if (parsedTxLimit !== undefined && (!Number.isInteger(parsedTxLimit) || parsedTxLimit < 1 || parsedTxLimit > 10_000_000)) {
      return res.status(400).json({ ok: false, error: 'Transaction limit must be an integer between 1 and 10,000,000.' })
    }
    if (parsedExtendDays !== undefined && (!Number.isInteger(parsedExtendDays) || parsedExtendDays < 1 || parsedExtendDays > 3650)) {
      return res.status(400).json({ ok: false, error: 'Extension must be an integer between 1 and 3,650 days.' })
    }

    const plan = await db.plan.findUnique({ where: { name: String(planName).toUpperCase() } })
    if (!plan && planName) {
      return res.status(404).json({ ok: false, error: 'Specified plan does not exist.' })
    }

    const effectiveExtendDays = parsedExtendDays ?? (plan?.periodDays ?? 30)
    const txLimit = parsedTxLimit ?? plan?.maxTransactions ?? 1000
    const subscriptionEndsAt = new Date(Date.now() + effectiveExtendDays * 24 * 60 * 60 * 1000)

    const updated = await db.client.update({
      where: { id },
      data: {
        subscriptionPlan: plan?.name || String(planName).toUpperCase(),
        txLimit,
        isFreeTrial: (plan?.name || String(planName).toUpperCase()) === 'FREE_TRIAL',
        subscriptionEndsAt,
      },
    })

    await db.auditLog.create({
      data: {
        action: 'OVERRIDE_MERCHANT_PLAN',
        details: `Superadmin set plan for ${updated.businessName} to ${updated.subscriptionPlan} (Limit: ${txLimit} txs)`,
      },
    })

    return res.json({ ok: true, client: safeAdminClient(updated) })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})

// ─── Broadcast / Targeted Merchant Notification ─────────────────────

adminRouter.get('/special-offers', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const offers = await db.specialOffer.findMany({
      include: { client: { select: { id: true, businessName: true, email: true, subscriptionPlan: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return res.json({ ok: true, offers })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})

adminRouter.post('/special-offers', requireAdmin, async (req: Request, res: Response) => {
  try {
    const clientId = String(req.body?.clientId || '')
    const title = String(req.body?.title || '').trim()
    const description = String(req.body?.description || '').trim()
    const priceEgp = Number(req.body?.priceEgp)
    const maxTransactions = Number(req.body?.maxTransactions)
    const periodDays = Number(req.body?.periodDays)
    const validDays = Number(req.body?.validDays)
    if (!clientId || !title || title.length > 120) return res.status(400).json({ ok: false, error: 'Merchant and an offer title of up to 120 characters are required.' })
    if (!Number.isFinite(priceEgp) || priceEgp <= 0 || priceEgp > 10_000_000) return res.status(400).json({ ok: false, error: 'Offer price must be between 0 and 10,000,000 EGP.' })
    if (!Number.isInteger(maxTransactions) || maxTransactions < 1 || maxTransactions > 100_000_000) return res.status(400).json({ ok: false, error: 'Transaction allowance must be between 1 and 100,000,000.' })
    if (!Number.isInteger(periodDays) || periodDays < 1 || periodDays > 3650) return res.status(400).json({ ok: false, error: 'Subscription duration must be between 1 and 3,650 days.' })
    if (!Number.isInteger(validDays) || validDays < 1 || validDays > 365) return res.status(400).json({ ok: false, error: 'Offer validity must be between 1 and 365 days.' })
    const client = await db.client.findUnique({ where: { id: clientId }, select: { businessName: true, approvalStatus: true } })
    if (!client) return res.status(404).json({ ok: false, error: 'Merchant not found.' })
    if (client.approvalStatus !== 'APPROVED') return res.status(409).json({ ok: false, error: 'Special offers can only be assigned to approved merchants.' })

    const offer = await db.specialOffer.create({
      data: { clientId, title, description: description || null, priceEgp, maxTransactions, periodDays, validUntil: new Date(Date.now() + validDays * 24 * 60 * 60 * 1000) },
      include: { client: { select: { id: true, businessName: true, email: true, subscriptionPlan: true } } },
    })
    await db.merchantNotification.create({
      data: { clientId, title: `Exclusive offer: ${title}`, message: `A custom ${periodDays}-day package with ${maxTransactions.toLocaleString()} transactions is available for ${priceEgp.toFixed(2)} EGP. Open Plans & Billing to review it.`, severity: 'INFO' },
    })
    await db.auditLog.create({ data: { action: 'CREATE_SPECIAL_OFFER', details: `Created "${title}" for ${client.businessName}: ${priceEgp} EGP, ${maxTransactions} txs, ${periodDays} days` } })
    return res.status(201).json({ ok: true, offer })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})

adminRouter.patch('/special-offers/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)
    const existing = await db.specialOffer.findUnique({ where: { id }, include: { client: { select: { businessName: true } } } })
    if (!existing) return res.status(404).json({ ok: false, error: 'Special offer not found.' })
    if (existing.status === 'ACCEPTED') return res.status(409).json({ ok: false, error: 'Accepted offers are immutable.' })
    const data: Record<string, string | number | Date | null> = {}
    if (req.body.status !== undefined) {
      const status = String(req.body.status).toUpperCase()
      if (!['ACTIVE', 'REVOKED'].includes(status)) return res.status(400).json({ ok: false, error: 'Offer status must be ACTIVE or REVOKED.' })
      data.status = status
    }
    if (req.body.title !== undefined) {
      const title = String(req.body.title).trim()
      if (!title || title.length > 120) return res.status(400).json({ ok: false, error: 'Offer title must be 1-120 characters.' })
      data.title = title
    }
    if (req.body.description !== undefined) data.description = String(req.body.description).trim().slice(0, 1000) || null
    for (const field of ['priceEgp', 'maxTransactions', 'periodDays'] as const) {
      if (req.body[field] !== undefined) data[field] = Number(req.body[field])
    }
    if (data.priceEgp !== undefined && (!Number.isFinite(data.priceEgp) || Number(data.priceEgp) <= 0 || Number(data.priceEgp) > 10_000_000)) return res.status(400).json({ ok: false, error: 'Invalid offer price.' })
    if (data.maxTransactions !== undefined && (!Number.isInteger(data.maxTransactions) || Number(data.maxTransactions) < 1 || Number(data.maxTransactions) > 100_000_000)) return res.status(400).json({ ok: false, error: 'Invalid transaction allowance.' })
    if (data.periodDays !== undefined && (!Number.isInteger(data.periodDays) || Number(data.periodDays) < 1 || Number(data.periodDays) > 3650)) return res.status(400).json({ ok: false, error: 'Invalid subscription duration.' })
    if (req.body.validDays !== undefined) {
      const validDays = Number(req.body.validDays)
      if (!Number.isInteger(validDays) || validDays < 1 || validDays > 365) return res.status(400).json({ ok: false, error: 'Offer validity must be between 1 and 365 days.' })
      data.validUntil = new Date(Date.now() + validDays * 24 * 60 * 60 * 1000)
    }
    const offer = await db.specialOffer.update({ where: { id }, data, include: { client: { select: { id: true, businessName: true, email: true, subscriptionPlan: true } } } })
    await db.auditLog.create({ data: { action: 'UPDATE_SPECIAL_OFFER', details: `Updated special offer "${offer.title}" for ${existing.client.businessName}; status: ${offer.status}` } })
    return res.json({ ok: true, offer })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})

adminRouter.get('/bundles', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const [bundles, purchaseGroups] = await Promise.all([
      db.topUpBundle.findMany({ orderBy: [{ sortOrder: 'asc' }, { priceEgp: 'asc' }] }),
      db.bundlePurchase.groupBy({
        by: ['bundleId', 'status'],
        _count: { _all: true },
        _sum: { priceEgp: true, extraTx: true },
      }),
    ])
    const catalog = bundles.map((bundle) => {
      const groups = purchaseGroups.filter((group) => group.bundleId === bundle.id)
      const confirmed = groups.find((group) => group.status === 'CONFIRMED')
      return {
        ...bundle,
        purchaseCount: groups.reduce((total, group) => total + group._count._all, 0),
        confirmedPurchaseCount: confirmed?._count._all || 0,
        confirmedRevenueEgp: confirmed?._sum.priceEgp || 0,
        grantedTransactions: confirmed?._sum.extraTx || 0,
      }
    })
    return res.json({ ok: true, bundles: catalog })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})

adminRouter.post('/bundles', requireAdmin, async (req: Request, res: Response) => {
  try {
    const name = String(req.body?.name || '').trim().toUpperCase()
    const displayName = String(req.body?.displayName || '').trim()
    const description = String(req.body?.description || '').trim()
    const priceEgp = Number(req.body?.priceEgp)
    const extraTx = Number(req.body?.extraTx)
    const sortOrder = req.body?.sortOrder === undefined ? 0 : Number(req.body.sortOrder)
    if (!/^[A-Z0-9_]{3,50}$/.test(name)) return res.status(400).json({ ok: false, error: 'Bundle key must be 3-50 uppercase letters, numbers, or underscores.' })
    if (!displayName || displayName.length > 80) return res.status(400).json({ ok: false, error: 'Display name is required and must not exceed 80 characters.' })
    if (!Number.isFinite(priceEgp) || priceEgp <= 0 || priceEgp > 1_000_000) return res.status(400).json({ ok: false, error: 'Price must be between 0 and 1,000,000 EGP.' })
    if (!Number.isInteger(extraTx) || extraTx < 1 || extraTx > 10_000_000) return res.status(400).json({ ok: false, error: 'Extra transactions must be an integer between 1 and 10,000,000.' })
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 10_000) return res.status(400).json({ ok: false, error: 'Sort order must be an integer between 0 and 10,000.' })

    const bundle = await db.topUpBundle.create({
      data: { name, displayName, description: description || null, priceEgp, extraTx, sortOrder, isActive: req.body?.isActive !== false },
    })
    await db.auditLog.create({ data: { action: 'CREATE_TOPUP_BUNDLE', details: `Created ${bundle.displayName}: ${bundle.priceEgp} EGP for ${bundle.extraTx} extra transactions` } })
    return res.status(201).json({ ok: true, bundle })
  } catch (err: unknown) {
    const error = err as Error & { code?: string }
    if (error.code === 'P2002') return res.status(409).json({ ok: false, error: 'A bundle with this key already exists.' })
    return res.status(500).json({ ok: false, error: error.message })
  }
})

adminRouter.patch('/bundles/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)
    const existing = await db.topUpBundle.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ ok: false, error: 'Bundle not found.' })
    const data: Record<string, string | number | boolean | null> = {}
    if (req.body.displayName !== undefined) {
      const displayName = String(req.body.displayName).trim()
      if (!displayName || displayName.length > 80) return res.status(400).json({ ok: false, error: 'Display name must be 1-80 characters.' })
      data.displayName = displayName
    }
    if (req.body.description !== undefined) data.description = String(req.body.description).trim().slice(0, 500) || null
    if (req.body.priceEgp !== undefined) {
      const priceEgp = Number(req.body.priceEgp)
      if (!Number.isFinite(priceEgp) || priceEgp <= 0 || priceEgp > 1_000_000) return res.status(400).json({ ok: false, error: 'Price must be between 0 and 1,000,000 EGP.' })
      data.priceEgp = priceEgp
    }
    if (req.body.extraTx !== undefined) {
      const extraTx = Number(req.body.extraTx)
      if (!Number.isInteger(extraTx) || extraTx < 1 || extraTx > 10_000_000) return res.status(400).json({ ok: false, error: 'Extra transactions must be an integer between 1 and 10,000,000.' })
      data.extraTx = extraTx
    }
    if (req.body.sortOrder !== undefined) {
      const sortOrder = Number(req.body.sortOrder)
      if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 10_000) return res.status(400).json({ ok: false, error: 'Sort order must be an integer between 0 and 10,000.' })
      data.sortOrder = sortOrder
    }
    if (req.body.isActive !== undefined) {
      if (typeof req.body.isActive !== 'boolean') return res.status(400).json({ ok: false, error: 'isActive must be a boolean.' })
      data.isActive = req.body.isActive
    }
    if (Object.keys(data).length === 0) return res.status(400).json({ ok: false, error: 'No bundle changes were provided.' })

    const bundle = await db.topUpBundle.update({ where: { id }, data })
    await db.auditLog.create({ data: { action: 'UPDATE_TOPUP_BUNDLE', details: `Updated ${bundle.displayName}: ${bundle.priceEgp} EGP, ${bundle.extraTx} extra transactions, active: ${bundle.isActive}` } })
    return res.json({ ok: true, bundle })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})

adminRouter.post('/notifications', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { target = 'ALL', clientId, title, message, severity = 'INFO' } = req.body

    if (!title || !message) {
      return res.status(400).json({ ok: false, error: 'Title and message are required.' })
    }

    let targetClients: { id: string }[] = []
    if (clientId) {
      targetClients = [{ id: clientId }]
    } else if (target === 'ALL') {
      targetClients = await db.client.findMany({
        where: { isActive: true },
        select: { id: true },
      })
    } else {
      targetClients = await db.client.findMany({
        where: { approvalStatus: target },
        select: { id: true },
      })
    }

    if (targetClients.length === 0) {
      return res.status(404).json({ ok: false, error: 'No matching merchants found.' })
    }

    await db.merchantNotification.createMany({
      data: targetClients.map((c) => ({
        clientId: c.id,
        title: String(title).slice(0, 150),
        message: String(message).slice(0, 2000),
        severity: String(severity).toUpperCase(),
      })),
    })

    await db.auditLog.create({
      data: {
        action: 'BROADCAST_NOTIFICATION',
        details: `Dispatched "${title}" (${severity}) to ${targetClients.length} merchant(s)`,
      },
    })

    return res.json({ ok: true, count: targetClients.length, sentCount: targetClients.length })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})
