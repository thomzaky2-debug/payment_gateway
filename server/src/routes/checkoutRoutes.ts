import { Router, Request, Response } from 'express'
import { db } from '../db.js'
import { getCheckoutSession } from '../services/checkoutService.js'
import { sendInternalError } from '../lib/safeError.js'

export const checkoutRouter = Router()

/**
 * Public endpoint consumed by customer hosted checkout page
 */
checkoutRouter.get('/:sessionId', async (req: Request, res: Response) => {
  try {
    const sessionId = String(req.params.sessionId)
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

    if (secondsRemaining > merchantTtlSec) {
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
    let bundleInfo: { name: string; displayName: string; extraTx: number; priceEgp: number } | null = null

    if (tx.subscriptionPlanName) {
      if (tx.subscriptionPlanName.startsWith('BUNDLE:')) {
        const bundleName = tx.subscriptionPlanName.replace('BUNDLE:', '')
        const bundle = await (db as any).topUpBundle.findUnique({ where: { name: bundleName } })
        if (bundle) {
          bundleInfo = {
            name: bundle.name,
            displayName: bundle.displayName,
            extraTx: bundle.extraTx,
            priceEgp: bundle.priceEgp,
          }
        }
      } else {
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
        purpose: tx.purpose,
        productCategory: tx.productCategory,
        items: tx.items ?? null,
        itemsCount: Array.isArray(tx.items)
          ? (tx.items as any[]).reduce((sum: number, it: any) => sum + (Number(it?.quantity) || 1), 0)
          : 0,
        subtotalEgp: Array.isArray(tx.items)
          ? Math.round(
              (tx.items as any[]).reduce(
                (sum: number, it: any) =>
                  sum + (Number(it?.totalPrice) || (Number(it?.quantity) || 1) * (Number(it?.unitPrice) || 0)),
                0
              ) * 100
            ) / 100
          : tx.amountEgp,
        subscriptionPlanName: tx.subscriptionPlanName,
        bundleInfo,
        basePeriodDays,
        bonusDays,
        periodDays,
        startDate,
        endDate,
        checkoutUrl,
      },
    })
  } catch (err: unknown) {
    return sendInternalError(res, err, 'Failed to retrieve checkout session')
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
    if (!local || !/^[a-zA-Z0-9._-]{2,50}$/.test(local)) {
      return res.status(400).json({
        ok: false,
        error: 'InstaPay handle must be 2-50 characters and contain only letters, numbers, dots, and dashes',
      })
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
    return sendInternalError(res, err, 'Failed to update sender account username')
  }
})
