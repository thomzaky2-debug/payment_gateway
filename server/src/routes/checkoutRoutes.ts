import { Router, Request, Response } from 'express'
import { db } from '../db.js'
import { getCheckoutSession } from '../services/checkoutService.js'

export const checkoutRouter = Router()

/**
 * Public endpoint consumed by customer hosted checkout page
 */
checkoutRouter.get('/:sessionId', async (req: Request, res: Response) => {
  try {
    const sessionId = String(req.params.sessionId)
    const isFresh = req.query.fresh === '1' || req.query.reset === '1'
    const tx = await getCheckoutSession(sessionId)

    if (!tx) {
      return res.status(404).json({ ok: false, error: 'Checkout session not found' })
    }

    const merchantTtlMin = (tx.client as any)?.checkoutTtlMin || 10
    const merchantTtlSec = merchantTtlMin * 60
    const now = Date.now()
    let expiresAtMs = new Date(tx.expiresAt).getTime()
    let secondsRemaining = Math.max(0, Math.floor((expiresAtMs - now) / 1000))
    let currentStatus = tx.status

    // Ensure session remaining time adheres to merchant's checkoutTtlMin setting:
    if (tx.sessionId === 'cmt_test_local_session') {
      if (isFresh || secondsRemaining <= 0 || secondsRemaining > merchantTtlSec) {
        expiresAtMs = now + merchantTtlSec * 1000
        secondsRemaining = merchantTtlSec
        currentStatus = 'PENDING'
        await db.transaction
          .update({
            where: { id: tx.id },
            data: { expiresAt: new Date(expiresAtMs), status: 'PENDING' },
          })
          .catch(() => {})
      }
    } else if (secondsRemaining > merchantTtlSec) {
      secondsRemaining = merchantTtlSec
    }

    if (secondsRemaining === 0 && currentStatus === 'PENDING') {
      currentStatus = 'EXPIRED'
      void db.transaction
        .update({
          where: { id: tx.id },
          data: { status: 'EXPIRED' },
        })
        .catch(() => {})
    }

    let basePeriodDays = 30
    let bonusDays = 0
    let periodDays = 30
    if (tx.subscriptionPlanName) {
      const plan = await (db.plan as any).findUnique({ where: { name: tx.subscriptionPlanName } })
      if (plan?.periodDays) {
        basePeriodDays = plan.periodDays
        periodDays = plan.periodDays
      }
      const clientObj = tx.client as any
      if (clientObj && (clientObj.isFreeTrial || clientObj.subscriptionPlan === 'FREE_TRIAL') && clientObj.subscriptionEndsAt) {
        const remainingTrialMs = Math.max(0, new Date(clientObj.subscriptionEndsAt).getTime() - (tx.createdAt ? new Date(tx.createdAt).getTime() : Date.now()))
        bonusDays = Math.ceil(remainingTrialMs / (24 * 60 * 60 * 1000))
        const trialPlan = await (db.plan as any).findUnique({ where: { name: 'FREE_TRIAL' } })
        if (trialPlan?.periodDays && bonusDays > trialPlan.periodDays) {
          bonusDays = trialPlan.periodDays
        }
        periodDays = basePeriodDays + bonusDays
      }
    }
    const startDate = tx.createdAt ? tx.createdAt.toISOString() : new Date().toISOString()
    const endDate = new Date(new Date(startDate).getTime() + periodDays * 24 * 60 * 60 * 1000).toISOString()

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000'
    const checkoutSubdomainBase =
      process.env.CHECKOUT_SUBDOMAIN_URL ||
      clientUrl.replace('://', '://checkout.')
    const checkoutUrl = `${checkoutSubdomainBase}/pay/${tx.sessionId}`

    return res.json({
      ok: true,
      checkout: {
        sessionId: tx.sessionId,
        businessName: tx.client.businessName,
        recipientHandle: tx.recipientHandle,
        senderHandle: tx.senderHandle,
        amountEgp: tx.amountEgp,
        currency: tx.currency,
        status: currentStatus,
        deepLinkUrl: tx.deepLinkUrl,
        expiresAt: new Date(expiresAtMs).toISOString(),
        secondsRemaining,
        checkoutTtlMin: merchantTtlMin,
        detectedRef: tx.detectedRef,
        detectedAt: tx.detectedAt?.toISOString() ?? null,
        note: tx.note,
        purpose: tx.purpose,
        subscriptionPlanName: tx.subscriptionPlanName,
        basePeriodDays,
        bonusDays,
        periodDays,
        startDate,
        endDate,
        checkoutUrl,
      },
    })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})

/**
 * Allows the customer to set or update the InstaPay account handle they will pay from
 */
checkoutRouter.patch('/:sessionId/sender', async (req: Request, res: Response) => {
  try {
    const sessionId = String(req.params.sessionId)
    const { senderHandle } = req.body

    if (!senderHandle || typeof senderHandle !== 'string') {
      return res.status(400).json({ ok: false, error: 'InstaPay account username is required' })
    }

    const tx = await db.transaction.findUnique({
      where: { sessionId },
    })

    if (!tx) {
      return res.status(404).json({ ok: false, error: 'Checkout session not found' })
    }

    if (tx.status !== 'PENDING') {
      return res.status(400).json({ ok: false, error: `Cannot update handle for session in ${tx.status} status` })
    }

    const clean = senderHandle.trim().toLowerCase().replace(/^@/, '')
    const local = clean.split('@')[0]
    if (!local) {
      return res.status(400).json({ ok: false, error: 'Invalid InstaPay handle format' })
    }
    const normalized = `${local}@instapay`

    const updated = await db.transaction.update({
      where: { sessionId },
      data: { senderHandle: normalized },
    })

    return res.json({
      ok: true,
      senderHandle: updated.senderHandle,
      message: 'InstaPay account username updated successfully',
    })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})
