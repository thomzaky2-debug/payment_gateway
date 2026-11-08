import { Router, Request, Response } from 'express'
import { db } from '../db.js'
import { requireMerchant } from '../middleware/requireMerchant.js'
import { sendInternalError } from '../lib/safeError.js'
import {
  createCustomerSubscriptionPlan,
  createCustomerSubscription,
  sendInvoiceReminder,
  getSubscriptionStats,
} from '../services/subscriptionService.js'
import { runSubscriptionSchedulerCycle } from '../workers/subscriptionSchedulerWorker.js'

export const subscriptionRouter = Router()

subscriptionRouter.use(requireMerchant)

// ─── Stats ──────────────────────────────────────────────────────────

subscriptionRouter.get('/stats', async (req: Request, res: Response) => {
  try {
    const client = (req as any).client
    const stats = await getSubscriptionStats(client.id)
    return res.json({ ok: true, stats })
  } catch (err) {
    return sendInternalError(res, err, 'Failed to fetch subscription statistics')
  }
})

// ─── Plans ──────────────────────────────────────────────────────────

subscriptionRouter.get('/plans', async (req: Request, res: Response) => {
  try {
    const client = (req as any).client
    const plans = await db.customerSubscriptionPlan.findMany({
      where: { clientId: client.id },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { subscriptions: true },
        },
      },
    })
    return res.json({ ok: true, plans })
  } catch (err) {
    return sendInternalError(res, err, 'Failed to fetch subscription plans')
  }
})

subscriptionRouter.post('/plans', async (req: Request, res: Response) => {
  try {
    const client = (req as any).client
    const { name, description, amountEgp, billingInterval, intervalDays } = req.body || {}

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ ok: false, error: 'Plan name is required' })
    }

    const plan = await createCustomerSubscriptionPlan(client.id, {
      name,
      description,
      amountEgp,
      billingInterval,
      intervalDays,
    })

    return res.status(201).json({ ok: true, plan })
  } catch (err: any) {
    return res.status(400).json({ ok: false, error: err.message || 'Failed to create plan' })
  }
})

subscriptionRouter.put('/plans/:id', async (req: Request, res: Response) => {
  try {
    const client = (req as any).client
    const id = String(req.params.id)
    const { name, description, isActive } = req.body || {}

    const existing = await db.customerSubscriptionPlan.findFirst({
      where: { id, clientId: client.id },
    })
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Plan not found' })
    }

    const updated = await db.customerSubscriptionPlan.update({
      where: { id },
      data: {
        name: typeof name === 'string' && name.trim() ? name.trim() : existing.name,
        description: description !== undefined ? (description ? String(description).trim() : null) : existing.description,
        isActive: typeof isActive === 'boolean' ? isActive : existing.isActive,
      },
    })

    return res.json({ ok: true, plan: updated })
  } catch (err) {
    return sendInternalError(res, err, 'Failed to update subscription plan')
  }
})

subscriptionRouter.delete('/plans/:id', async (req: Request, res: Response) => {
  try {
    const client = (req as any).client
    const id = String(req.params.id)

    const existing = await db.customerSubscriptionPlan.findFirst({
      where: { id, clientId: client.id },
    })
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Plan not found' })
    }

    // Soft delete: set isActive to false
    await db.customerSubscriptionPlan.update({
      where: { id },
      data: { isActive: false },
    })

    return res.json({ ok: true, message: 'Plan deactivated successfully' })
  } catch (err) {
    return sendInternalError(res, err, 'Failed to deactivate plan')
  }
})

// ─── Subscriptions ──────────────────────────────────────────────────

subscriptionRouter.get('/', async (req: Request, res: Response) => {
  try {
    const client = (req as any).client
    const status = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : undefined
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined
    const page = Math.max(1, Number(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20))
    const skip = (page - 1) * limit

    const where: any = { clientId: client.id }
    if (status && status !== 'ALL') {
      where.status = status
    }
    if (search) {
      where.OR = [
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerEmail: { contains: search, mode: 'insensitive' } },
        { senderHandle: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [total, subscriptions] = await Promise.all([
      db.customerSubscription.count({ where }),
      db.customerSubscription.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          plan: true,
          _count: { select: { invoices: true } },
        },
      }),
    ])

    return res.json({
      ok: true,
      subscriptions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (err) {
    return sendInternalError(res, err, 'Failed to list subscriptions')
  }
})

subscriptionRouter.post('/', async (req: Request, res: Response) => {
  try {
    const client = (req as any).client
    const result = await createCustomerSubscription(client.id, req.body || {})
    return res.status(201).json({ ok: true, ...result })
  } catch (err: any) {
    return res.status(400).json({ ok: false, error: err.message || 'Failed to create subscription' })
  }
})

subscriptionRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const client = (req as any).client
    const id = String(req.params.id)

    const subscription = await db.customerSubscription.findFirst({
      where: { id, clientId: client.id },
      include: {
        plan: true,
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 50,
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

subscriptionRouter.patch('/:id/pause', async (req: Request, res: Response) => {
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
      data: { status: 'PAUSED' },
    })

    return res.json({ ok: true, subscription: updated })
  } catch (err) {
    return sendInternalError(res, err, 'Failed to pause subscription')
  }
})

subscriptionRouter.patch('/:id/resume', async (req: Request, res: Response) => {
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
      data: { status: 'ACTIVE' },
    })

    return res.json({ ok: true, subscription: updated })
  } catch (err) {
    return sendInternalError(res, err, 'Failed to resume subscription')
  }
})

subscriptionRouter.delete('/:id', async (req: Request, res: Response) => {
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

// ─── Invoices ───────────────────────────────────────────────────────

subscriptionRouter.get('/invoices/list', async (req: Request, res: Response) => {
  try {
    const client = (req as any).client
    const status = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : undefined
    const subscriptionId = typeof req.query.subscriptionId === 'string' ? req.query.subscriptionId : undefined
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined
    const page = Math.max(1, Number(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20))
    const skip = (page - 1) * limit

    const where: any = { clientId: client.id }
    if (status && status !== 'ALL') {
      where.status = status
    }
    if (subscriptionId) {
      where.subscriptionId = subscriptionId
    }
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerEmail: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [total, invoices] = await Promise.all([
      db.customerInvoice.count({ where }),
      db.customerInvoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          subscription: true,
          transaction: true,
        },
      }),
    ])

    return res.json({
      ok: true,
      invoices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (err) {
    return sendInternalError(res, err, 'Failed to list customer invoices')
  }
})

subscriptionRouter.get('/invoices/:id', async (req: Request, res: Response) => {
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

subscriptionRouter.post('/invoices/:id/resend', async (req: Request, res: Response) => {
  try {
    const client = (req as any).client
    const id = String(req.params.id)

    const invoice = await db.customerInvoice.findFirst({
      where: { id, clientId: client.id },
    })

    if (!invoice) {
      return res.status(404).json({ ok: false, error: 'Invoice not found' })
    }

    const sent = await sendInvoiceReminder(invoice.id)
    return res.json({ ok: true, sent })
  } catch (err) {
    return sendInternalError(res, err, 'Failed to resend invoice reminder')
  }
})

// ─── Manual Scheduler Trigger ───────────────────────────────────────

subscriptionRouter.post('/run-cycle', async (req: Request, res: Response) => {
  try {
    const result = await runSubscriptionSchedulerCycle()
    return res.json({ ok: true, result })
  } catch (err) {
    return sendInternalError(res, err, 'Failed to run subscription scheduler cycle')
  }
})

