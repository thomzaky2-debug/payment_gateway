import { Router, Request, Response } from 'express'
import { db } from '../db.js'
import { requireMerchant } from '../middleware/requireMerchant.js'

export const notificationRouter = Router()

// ─── List Merchant Notifications ────────────────────────────────────

notificationRouter.get('/', requireMerchant, async (req: Request, res: Response) => {
  try {
    const client = (req as unknown as { client: any }).client
    const notifications = await db.merchantNotification.findMany({
      where: { clientId: client.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const unreadCount = await db.merchantNotification.count({
      where: { clientId: client.id, readAt: null },
    })

    return res.json({ ok: true, notifications, unreadCount })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
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
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
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
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})
