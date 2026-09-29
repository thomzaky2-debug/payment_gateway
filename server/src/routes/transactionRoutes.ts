import { Router, Request, Response } from 'express'
import { db } from '../db.js'
import { verifySessionToken } from '../services/authService.js'

export const transactionRouter = Router()

// Middleware to authenticate merchant session
async function requireMerchant(req: Request, res: Response, next: () => void) {
  const token =
    req.headers.authorization?.replace(/^Bearer\s+/i, '') ||
    req.cookies?.['instapay_merchant_session']

  const clientId = verifySessionToken(token)
  if (!clientId) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' })
  }

  const client = await db.client.findUnique({ where: { id: clientId } })
  if (!client) {
    return res.status(401).json({ ok: false, error: 'Merchant not found' })
  }

  ;(req as unknown as { client: typeof client }).client = client
  next()
}

// ─── List Transactions ──────────────────────────────────────────────

transactionRouter.get('/', requireMerchant, async (req: Request, res: Response) => {
  try {
    const client = (req as unknown as { client: any }).client
    const { status, search, limit = '50', page = '1' } = req.query

    const take = Math.min(100, Math.max(1, Number(limit)))
    const skip = (Math.max(1, Number(page)) - 1) * take

    const where: any = { clientId: client.id }
    if (status && typeof status === 'string' && status !== 'all') {
      where.status = status.toUpperCase()
    }
    if (search && typeof search === 'string') {
      where.OR = [
        { senderHandle: { contains: search, mode: 'insensitive' } },
        { sessionId: { contains: search, mode: 'insensitive' } },
        { detectedRef: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [transactions, total] = await Promise.all([
      db.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      db.transaction.count({ where }),
    ])

    return res.json({
      ok: true,
      transactions,
      pagination: {
        total,
        page: Number(page),
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})

// ─── Transactions Stats ─────────────────────────────────────────────

transactionRouter.get('/stats', requireMerchant, async (req: Request, res: Response) => {
  try {
    const client = (req as unknown as { client: any }).client
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const [todayTxs, sevenDaysTxs, pendingTxs] = await Promise.all([
      db.transaction.findMany({
        where: {
          clientId: client.id,
          status: 'CONFIRMED',
          createdAt: { gte: startOfToday },
        },
      }),
      db.transaction.findMany({
        where: {
          clientId: client.id,
          status: 'CONFIRMED',
          createdAt: { gte: sevenDaysAgo },
        },
      }),
      db.transaction.count({
        where: { clientId: client.id, status: 'PENDING' },
      }),
    ])

    const todayTotal = todayTxs.reduce((sum, tx) => sum + tx.amountEgp, 0)
    const sevenDaysTotal = sevenDaysTxs.reduce((sum, tx) => sum + tx.amountEgp, 0)

    return res.json({
      ok: true,
      stats: {
        today: { count: todayTxs.length, totalEgp: todayTotal },
        sevenDays: { count: sevenDaysTxs.length, totalEgp: sevenDaysTotal },
        pending: { count: pendingTxs },
        quota: { count: client.txCount, limit: client.txLimit, plan: client.subscriptionPlan },
      },
    })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})

// ─── Review Queue (Mismatched Payments) ─────────────────────────────

transactionRouter.get('/review-queue', requireMerchant, async (req: Request, res: Response) => {
  try {
    const client = (req as unknown as { client: any }).client
    const mismatched = await db.mismatchedPayment.findMany({
      where: { clientId: client.id, status: 'UNMATCHED' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const underpaid = await db.transaction.findMany({
      where: { clientId: client.id, status: 'UNDERPAID' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return res.json({
      ok: true,
      reviewQueue: {
        mismatched,
        underpaid,
      },
    })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})

// ─── Export CSV ─────────────────────────────────────────────────────

transactionRouter.get('/export', requireMerchant, async (req: Request, res: Response) => {
  try {
    const client = (req as unknown as { client: any }).client
    const transactions = await db.transaction.findMany({
      where: { clientId: client.id },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    })

    const headers = 'Session ID,Status,Amount EGP,Sender Handle,Recipient Handle,Reference,Created At\n'
    const rows = transactions
      .map(
        (t) =>
          `"${t.sessionId}","${t.status}",${t.amountEgp},"${t.senderHandle}","${t.recipientHandle}","${
            t.detectedRef || ''
          }","${t.createdAt.toISOString()}"`
      )
      .join('\n')

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="transactions_${client.slug}.csv"`)
    return res.send(headers + rows)
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})
