import { Router, Request, Response } from 'express'
import { db } from '../db.js'
import { emitCheckoutUpdate } from '../services/notificationService.js'
import { forwardToClientWebhook } from '../services/webhookService.js'
import { requireMerchant } from '../middleware/requireMerchant.js'

export const transactionRouter = Router()

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

// ─── Review Queue (All Anomaly Cases & Mismatched Payments) ───────────

transactionRouter.get('/review-queue', requireMerchant, async (req: Request, res: Response) => {
  try {
    const client = (req as unknown as { client: any }).client
    const mismatched = await db.mismatchedPayment.findMany({
      where: { clientId: client.id, status: 'UNMATCHED' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const reviewStatuses = [
      'UNDERPAID',
      'OVERPAID',
      'EXPIRED_PAID',
      'LATE_PAYMENT',
      'HANDLE_MISMATCH',
      'DUPLICATE_SUSPECT',
      'HIGH_VALUE_REVIEW',
      'REVIEW',
    ]

    const reviewTransactions = await db.transaction.findMany({
      where: {
        clientId: client.id,
        OR: [
          { status: { in: reviewStatuses } },
          { status: 'EXPIRED', detectedAmountEgp: { not: null } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    const underpaid = reviewTransactions.filter((t) => t.status === 'UNDERPAID')
    const overpaid = reviewTransactions.filter((t) => t.status === 'OVERPAID')
    const latePayments = reviewTransactions.filter(
      (t) =>
        t.status === 'LATE_PAYMENT' ||
        t.status === 'EXPIRED_PAID' ||
        (t.status === 'EXPIRED' && t.detectedAmountEgp != null)
    )
    const handleMismatch = reviewTransactions.filter((t) => t.status === 'HANDLE_MISMATCH')
    const duplicateSuspect = reviewTransactions.filter((t) => t.status === 'DUPLICATE_SUSPECT')
    const highValueRisk = reviewTransactions.filter((t) => t.status === 'HIGH_VALUE_REVIEW')

    return res.json({
      ok: true,
      reviewQueue: {
        mismatched,
        underpaid,
        overpaid,
        latePayments,
        handleMismatch,
        duplicateSuspect,
        highValueRisk,
        allTransactions: reviewTransactions,
      },
    })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})

// ─── Export CSV ─────────────────────────────────────────────────────

// Helper to neutralize CSV Formula Injection (=, +, -, @, \t, \r)
function sanitizeCsvCell(value: string | number | null | undefined): string {
  if (value == null) return '""'
  const str = String(value).replace(/"/g, '""')
  if (/^[=+\-@\t\r]/.test(str)) {
    return `"'${str}"`
  }
  return `"${str}"`
}

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
          `${sanitizeCsvCell(t.sessionId)},${sanitizeCsvCell(t.status)},${t.amountEgp},${sanitizeCsvCell(
            t.senderHandle
          )},${sanitizeCsvCell(t.recipientHandle)},${sanitizeCsvCell(t.detectedRef || '')},${sanitizeCsvCell(
            t.createdAt.toISOString()
          )}`
      )
      .join('\n')

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="transactions_${client.slug}.csv"`)
    return res.send(headers + rows)
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})

// ─── Merchant Confirm / Resolve Transaction ─────────────────────────

transactionRouter.post('/:sessionId/confirm', requireMerchant, async (req: Request, res: Response) => {
  try {
    const client = (req as unknown as { client: any }).client
    const sessionId = String(req.params.sessionId)
    const tx = await db.transaction.findFirst({
      where: { sessionId, clientId: client.id },
    })

    if (!tx) {
      return res.status(404).json({ ok: false, error: 'Transaction not found or not owned by you' })
    }

    const wasAlreadyConfirmed = tx.status === 'CONFIRMED'

    const updated = await db.transaction.update({
      where: { sessionId },
      data: {
        status: 'CONFIRMED',
        detectedAt: new Date(),
        detectedRef: tx.detectedRef || 'MERCHANT_MANUAL_CONFIRM',
        detectedAmountEgp: tx.detectedAmountEgp ?? tx.amountEgp,
      },
    })

    // Auto-resolve any corresponding mismatched payment record in review queue
    if (tx.detectedRef || tx.senderHandle) {
      await db.mismatchedPayment
        .updateMany({
          where: {
            clientId: client.id,
            status: 'UNMATCHED',
            OR: [
              ...(tx.detectedRef ? [{ reference: tx.detectedRef }] : []),
              ...(tx.senderHandle ? [{ senderHandle: tx.senderHandle }] : []),
            ],
          },
          data: { status: 'RESOLVED' },
        })
        .catch(() => {})
    }

    // Update merchant quota or activate subscription if first time confirming
    if (!wasAlreadyConfirmed) {
      if (tx.purpose === 'SUBSCRIPTION' || tx.subscriptionPlanName) {
        const planName = tx.subscriptionPlanName || tx.note?.replace('SUB_', '')
        const plan = await (db.plan as any).findUnique({ where: { name: planName } })
        if (plan) {
          const nowMs = Date.now()
          let bonusDays = 0
          if (client.isFreeTrial && client.subscriptionEndsAt) {
            const remainingTrialMs = Math.max(0, new Date(client.subscriptionEndsAt).getTime() - nowMs)
            bonusDays = Math.ceil(remainingTrialMs / (24 * 60 * 60 * 1000))
            const trialPlan = await (db.plan as any).findUnique({ where: { name: 'FREE_TRIAL' } })
            if (trialPlan?.periodDays && bonusDays > trialPlan.periodDays) {
              bonusDays = trialPlan.periodDays
            }
          }
          const basePeriodDays = plan.periodDays || 30
          const totalPeriodDays = basePeriodDays + bonusDays
          const newEndsAt = new Date(nowMs + totalPeriodDays * 24 * 60 * 60 * 1000)

          await db.client
            .update({
              where: { id: client.id },
              data: {
                subscriptionPlan: plan.name,
                subscriptionEndsAt: newEndsAt,
                isFreeTrial: false,
                txLimit: plan.maxTransactions,
                txCount: 0,
              },
            })
            .catch(() => {})
        }
      } else {
        // Increment normal checkout transaction quota
        await db.client
          .update({
            where: { id: client.id },
            data: { txCount: { increment: 1 } },
          })
          .catch((err) => {
            console.error('[transactionRoutes] Failed to increment merchant txCount:', err)
          })
      }
    }

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

    // Deliver signed webhook to Merchant server if configured
    if (client.webhookUrl) {
      void forwardToClientWebhook(client.id, client.webhookUrl, client.webhookSecret, {
        event: 'payment.confirmed',
        clientId: client.id,
        businessName: client.businessName,
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
        action: 'MERCHANT_CONFIRM',
        details: `Merchant ${client.businessName} manually confirmed transaction ${sessionId} for ${tx.amountEgp} EGP`,
      },
    })

    return res.json({ ok: true, transaction: updated })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})

// ─── Dismiss Mismatched Review Item ─────────────────────────────────

transactionRouter.post('/review-queue/:id/dismiss', requireMerchant, async (req: Request, res: Response) => {
  try {
    const client = (req as unknown as { client: any }).client
    const id = String(req.params.id)
    await db.mismatchedPayment.updateMany({
      where: { id, clientId: client.id },
      data: { status: 'RESOLVED' },
    })
    return res.json({ ok: true })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})

// ─── Reject / Cancel Review Transaction ─────────────────────────────

transactionRouter.post('/:sessionId/reject', requireMerchant, async (req: Request, res: Response) => {
  try {
    const client = (req as unknown as { client: any }).client
    const sessionId = String(req.params.sessionId)
    const tx = await db.transaction.findFirst({
      where: { sessionId, clientId: client.id },
    })

    if (!tx) {
      return res.status(404).json({ ok: false, error: 'Transaction not found or not owned by you' })
    }

    const updated = await db.transaction.update({
      where: { sessionId },
      data: {
        status: 'REJECTED',
      },
    })

    await db.auditLog.create({
      data: {
        action: 'MERCHANT_REJECT',
        details: `Merchant ${client.businessName} rejected transaction ${sessionId}`,
      },
    })

    return res.json({ ok: true, transaction: updated })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})

