import { Router, Request, Response } from 'express'
import { db } from '../db.js'
import {
  createOwnerSessionToken,
  verifyOwnerSessionToken,
  generateMerchantKeys,
} from '../services/authService.js'

export const adminRouter = Router()

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

adminRouter.post('/auth', async (req: Request, res: Response) => {
  const { password } = req.body
  const expectedPassword = process.env.ADMIN_PASSWORD || 'ChangeMeInProduction123!'

  if (!password || password !== expectedPassword) {
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
    })

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
