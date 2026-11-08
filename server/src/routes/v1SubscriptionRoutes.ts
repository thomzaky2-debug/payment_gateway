import { Router, Request, Response } from 'express'
import { authenticateByApiKey } from '../services/authService.js'
import { db } from '../db.js'
import { sendInternalError } from '../lib/safeError.js'
import {
  createCustomerSubscription,
  createCustomerSubscriptionPlan,
} from '../services/subscriptionService.js'

export const v1SubscriptionRouter = Router()

async function requireApiKey(req: Request, res: Response, next: () => void) {
  const authHeader = req.headers.authorization
  const bearerMatch = authHeader?.match(/^Bearer\s+([^\s]+)$/i)
  if (!bearerMatch) {
    return res.status(401).json({ ok: false, error: 'Missing Authorization header with API key' })
  }

  let client: Awaited<ReturnType<typeof authenticateByApiKey>>
  try {
    client = await authenticateByApiKey(bearerMatch[1])
  } catch (err: unknown) {
    return sendInternalError(res, err, 'Authentication is temporarily unavailable')
  }
  if (!client) {
    return res.status(401).json({ ok: false, error: 'Invalid or deactivated API key' })
  }

  ;(req as any).client = client
  next()
}

v1SubscriptionRouter.use(requireApiKey)

// ─── Create Subscription ───────────────────────────────────────────

v1SubscriptionRouter.post('/', async (req: Request, res: Response) => {
  try {
    const client = (req as any).client
    const result = await createCustomerSubscription(client.id, req.body || {})
    return res.status(201).json({ ok: true, ...result })
  } catch (err: any) {
    return res.status(400).json({ ok: false, error: err.message || 'Failed to create subscription' })
  }
})

// ─── List Subscriptions ────────────────────────────────────────────

v1SubscriptionRouter.get('/', async (req: Request, res: Response) => {
  try {
    const client = (req as any).client
    const status = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : undefined
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20))
    const page = Math.max(1, Number(req.query.page) || 1)
    const skip = (page - 1) * limit

    const where: any = { clientId: client.id }
    if (status && status !== 'ALL') where.status = status

    const [total, subscriptions] = await Promise.all([
      db.customerSubscription.count({ where }),
      db.customerSubscription.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { plan: true },
      }),
    ])

    return res.json({
      ok: true,
      subscriptions,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (err) {
    return sendInternalError(res, err, 'Failed to list subscriptions')
  }
})

// ─── Retrieve Subscription ─────────────────────────────────────────

v1SubscriptionRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const client = (req as any).client
    const id = String(req.params.id)

    const subscription = await db.customerSubscription.findFirst({
      where: { id, clientId: client.id },
      include: {
        plan: true,
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    })

    if (!subscription) {
      return res.status(404).json({ ok: false, error: 'Subscription not found' })
    }

    return res.json({ ok: true, subscription })
  } catch (err) {
    return sendInternalError(res, err, 'Failed to fetch subscription')
  }
})

// ─── Cancel Subscription ───────────────────────────────────────────

v1SubscriptionRouter.post('/:id/cancel', async (req: Request, res: Response) => {
  try {
    const client = (req as any).client
    const id = String(req.params.id)

    const existing = await db.customerSubscription.findFirst({
      where: { id, clientId: client.id },
    })
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Subscription not found' })
    }

    const updated = await db.customerSubscription.update({
      where: { id },
      data: { status: 'CANCELLED', canceledAt: new Date() },
    })

    return res.json({ ok: true, subscription: updated })
  } catch (err) {
    return sendInternalError(res, err, 'Failed to cancel subscription')
  }
})

// ─── Retrieve Invoice ──────────────────────────────────────────────

v1SubscriptionRouter.get('/invoices/:id', async (req: Request, res: Response) => {
  try {
    const client = (req as any).client
    const id = String(req.params.id)

    const invoice = await db.customerInvoice.findFirst({
      where: { id, clientId: client.id },
      include: {
        subscription: true,
        transaction: true,
      },
    })

    if (!invoice) {
      return res.status(404).json({ ok: false, error: 'Invoice not found' })
    }

    return res.json({ ok: true, invoice })
  } catch (err) {
    return sendInternalError(res, err, 'Failed to fetch invoice')
  }
})

