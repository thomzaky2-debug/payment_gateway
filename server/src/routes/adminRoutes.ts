import { Router, Request, Response } from 'express'
import { db } from '../db.js'
import {
  createOwnerSessionToken,
  verifyOwnerSessionToken,
  generateMerchantKeys,
  timingSafeCompare,
} from '../services/authService.js'
import { emitCheckoutUpdate } from '../services/notificationService.js'
import { forwardToClientWebhook } from '../services/webhookService.js'
import { createRateLimiter } from '../lib/rateLimiter.js'

export const adminRouter = Router()

const adminAuthLimiter = createRateLimiter(15 * 60 * 1000, 30, 'Too many admin login attempts.')

// Middleware to authenticate Superadmin
function requireAdmin(req: Request, res: Response, next: () => void) {
  const token =
    req.headers.authorization?.replace(/^Bearer\s+/i, '') ||
    req.cookies?.['instapay_owner_session']

  if (!verifyOwnerSessionToken(token)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized admin access' })
  }
  next()
}

// ─── Admin Login ────────────────────────────────────────────────────

adminRouter.post('/auth', adminAuthLimiter, async (req: Request, res: Response) => {
  const { password } = req.body
  const expectedPassword = process.env.ADMIN_PASSWORD
  if (!expectedPassword && process.env.NODE_ENV === 'production') {
    return res.status(500).json({ ok: false, error: 'ADMIN_PASSWORD environment variable is not configured' })
  }
  const targetPassword = expectedPassword || 'ChangeMeInProduction123!'

  if (!password || typeof password !== 'string' || !timingSafeCompare(password, targetPassword)) {
    return res.status(401).json({ ok: false, error: 'Invalid admin credentials' })
  }

  const token = createOwnerSessionToken()

  res.cookie('instapay_owner_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 12 * 60 * 60 * 1000,
  })

  return res.json({ ok: true, token })
})

// ─── Admin Logout ───────────────────────────────────────────────────

adminRouter.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('instapay_owner_session', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  })
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
      totalTransactions,
      confirmedTransactions,
      totalVolumeResult,
      totalDetectors,
    ] = await Promise.all([
      db.client.count(),
      db.client.count({ where: { approvalStatus: 'PENDING' } }),
      db.client.count({ where: { approvalStatus: 'APPROVED' } }),
      db.transaction.count(),
      db.transaction.count({ where: { status: 'CONFIRMED' } }),
      db.transaction.aggregate({
        where: { status: 'CONFIRMED' },
        _sum: { amountEgp: true },
      }),
      db.detectorDevice.count(),
    ])

    return res.json({
      ok: true,
      stats: {
        totalClients,
        pendingClients,
        approvedClients,
        totalTransactions,
        confirmedTransactions,
        totalVolumeEgp: totalVolumeResult._sum.amountEgp || 0,
        totalDetectors,
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
      include: {
        detectorDevices: true,
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

adminRouter.post('/clients/:id/approve', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)
    const keys = generateMerchantKeys()

    const client = await db.client.update({
      where: { id },
      data: {
        approvalStatus: 'APPROVED',
        isActive: true,
        apiKey: keys.apiKey,
        detectToken: keys.detectToken,
        webhookSecret: keys.webhookSecret,
        apiKeyHash: keys.apiKeyHash,
        detectTokenHash: keys.detectTokenHash,
        webhookSecretHash: keys.webhookSecretHash,
      },
    })

    await db.auditLog.create({
      data: {
        action: 'APPROVE_MERCHANT',
        details: `Approved merchant ${client.businessName} (${client.email})`,
      },
    })

    return res.json({ ok: true, client })
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

    await db.auditLog.create({
      data: {
        action: 'REJECT_MERCHANT',
        details: `Rejected merchant ${client.businessName}`,
      },
    })

    return res.json({ ok: true, client })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})

// ─── Force Confirm Transaction ──────────────────────────────────────

adminRouter.post('/transactions/:sessionId/confirm', requireAdmin, async (req: Request, res: Response) => {
  try {
    const sessionId = String(req.params.sessionId)
    const tx = await db.transaction.findUnique({ where: { sessionId } })

    if (!tx) {
      return res.status(404).json({ ok: false, error: 'Transaction not found' })
    }

    const updated = await db.transaction.update({
      where: { sessionId },
      data: {
        status: 'CONFIRMED',
        detectedAt: new Date(),
        detectedRef: 'ADMIN_FORCE_CONFIRM',
        detectedAmountEgp: tx.amountEgp,
      },
      include: { client: true },
    })

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
    if (updated.client.webhookUrl) {
      void forwardToClientWebhook(updated.client.id, updated.client.webhookUrl, updated.client.webhookSecret, {
        event: 'payment.confirmed',
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
        details: `Admin force-confirmed transaction ${sessionId} for ${tx.amountEgp} EGP`,
      },
    })

    return res.json({ ok: true, transaction: updated })
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
    return res.json({ ok: true, plans })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})

adminRouter.patch('/plans', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, priceEgp, maxTransactions } = req.body
    if (!name) {
      return res.status(400).json({ ok: false, error: 'Plan name is required.' })
    }

    const data: Record<string, any> = {}
    if (priceEgp !== undefined) data.priceEgp = Number(priceEgp)
    if (maxTransactions !== undefined) data.maxTransactions = Number(maxTransactions)

    const updated = await db.plan.update({
      where: { name: String(name).toUpperCase() },
      data,
    })

    await db.auditLog.create({
      data: {
        action: 'UPDATE_PLAN',
        details: `Updated plan ${updated.name}: ${updated.priceEgp} EGP, max ${updated.maxTransactions} txs`,
      },
    })

    return res.json({ ok: true, plan: updated })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})

// ─── Manual Merchant Plan Assignment ────────────────────────────────

adminRouter.post('/clients/:id/plan', requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id)
    const { planName, customTxLimit, extendDays = 30 } = req.body

    const plan = await db.plan.findUnique({ where: { name: String(planName).toUpperCase() } })
    if (!plan && planName) {
      return res.status(404).json({ ok: false, error: 'Specified plan does not exist.' })
    }

    const txLimit = customTxLimit !== undefined ? Number(customTxLimit) : plan?.maxTransactions ?? 1000
    const subscriptionEndsAt = new Date(Date.now() + Number(extendDays) * 24 * 60 * 60 * 1000)

    const updated = await db.client.update({
      where: { id },
      data: {
        subscriptionPlan: plan?.name || String(planName).toUpperCase(),
        txLimit,
        isFreeTrial: false,
        subscriptionEndsAt,
      },
    })

    await db.auditLog.create({
      data: {
        action: 'OVERRIDE_MERCHANT_PLAN',
        details: `Superadmin set plan for ${updated.businessName} to ${updated.subscriptionPlan} (Limit: ${txLimit} txs)`,
      },
    })

    return res.json({ ok: true, client: updated })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})

// ─── Broadcast / Targeted Merchant Notification ─────────────────────

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

