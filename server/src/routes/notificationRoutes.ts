import { Router, Request, Response } from 'express'
import { db } from '../db.js'
import { requireMerchant } from '../middleware/requireMerchant.js'
import { sendInternalError } from '../lib/safeError.js'

export const notificationRouter = Router()

// ─── List Merchant Notifications ────────────────────────────────────

notificationRouter.get('/', requireMerchant, async (req: Request, res: Response) => {
  try {
    const client = (req as unknown as { client: any }).client
    const { status = 'all', limit = '50' } = req.query
    const take = Math.min(100, Math.max(1, Number(limit) || 50))

    const where: any = { clientId: client.id }
    if (status === 'unread') {
      where.readAt = null
    }

    const notifications = await db.merchantNotification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
    })

    const unreadCount = await db.merchantNotification.count({
      where: { clientId: client.id, readAt: null },
    })

    return res.json({ ok: true, notifications, unreadCount })
  } catch (err: unknown) {
    return sendInternalError(res, err, 'Failed to fetch notifications')
  }
})

// ─── Mark Notification as Read ──────────────────────────────────────

notificationRouter.post('/:id/read', requireMerchant, async (req: Request, res: Response) => {
  try {
    const client = (req as unknown as { client: any }).client
    const id = String(req.params.id)

    await db.merchantNotification.updateMany({
      where: { id, clientId: client.id },
      data: { readAt: new Date() },
    })

    return res.json({ ok: true })
  } catch (err: unknown) {
    return sendInternalError(res, err, 'Failed to update notification')
  }
})

// ─── Mark All Notifications as Read ─────────────────────────────────

notificationRouter.post('/read-all', requireMerchant, async (req: Request, res: Response) => {
  try {
    const client = (req as unknown as { client: any }).client

    await db.merchantNotification.updateMany({
      where: { clientId: client.id, readAt: null },
      data: { readAt: new Date() },
    })

    return res.json({ ok: true })
  } catch (err: unknown) {
    return sendInternalError(res, err, 'Failed to update notifications')
  }
})
