import { Router, Request, Response } from 'express'
import { db } from '../db.js'
import { toEgpCents } from '../lib/money.js'
import { requireMerchant } from '../middleware/requireMerchant.js'

export const planRouter = Router()
export const planCatalogRouter = Router()

class PlanRequestError extends Error {
  status = 400
}

async function activateFreeTrial(client: any) {
  if (client.trialRedeemedAt || client.subscriptionEndsAt) {
    throw new PlanRequestError('You have already utilized your introductory Free Trial. Please choose a subscription tier.')
  }

  const trialPlan = await db.plan.findUnique({ where: { name: 'FREE_TRIAL' } })
  if (!trialPlan || !trialPlan.isActive) {
    throw new PlanRequestError('Free trial is currently disabled or unavailable.')
  }

  const now = new Date()
  const periodDays = trialPlan.periodDays || 14
  const maxTransactions = trialPlan.maxTransactions || 50
  const subscriptionEndsAt = new Date(now.getTime() + periodDays * 24 * 60 * 60 * 1000)

  const claimed = await db.client.updateMany({
    where: {
      id: client.id,
      trialRedeemedAt: null,
      subscriptionEndsAt: null,
      subscriptionPlan: 'FREE_TRIAL',
      isFreeTrial: true,
    },
    data: {
      trialRedeemedAt: now,
      subscriptionEndsAt,
      txLimit: maxTransactions,
      txCount: 0,
    },
  })

  if (claimed.count !== 1) {
    throw new PlanRequestError('You have already utilized your introductory Free Trial. Please choose a subscription tier.')
  }

  const updated = await db.client.findUniqueOrThrow({ where: { id: client.id } })
  return { trialPlan, updated, periodDays, maxTransactions }
}

// ─── List Public Plans ──────────────────────────────────────────────

planCatalogRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const plans = await (db.plan as any).findMany({
      where: { isActive: true },
      orderBy: { priceEgp: 'asc' },
    })
    return res.json({ ok: true, plans })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(err instanceof PlanRequestError ? err.status : 500).json({ ok: false, error: error.message })
  }
})

// ─── Activate Free Trial ────────────────────────────────────────────

planRouter.post('/trial/activate', requireMerchant, async (req: Request, res: Response) => {
  try {
    const client = (req as unknown as { client: any }).client

    const { trialPlan, updated, periodDays, maxTransactions } = await activateFreeTrial(client)

    await db.auditLog.create({
      data: {
        action: 'ACTIVATE_TRIAL',
        details: `Merchant ${client.businessName} activated ${periodDays}-day Free Trial with ${maxTransactions} tx limit`,
      },
    }).catch(() => {})

    await db.merchantNotification.create({
      data: {
        clientId: client.id,
        title: 'Free Trial Activated',
        message: `Your ${periodDays}-day free trial with ${maxTransactions} transactions limit is now active!`,
        severity: 'INFO',
      },
    }).catch(() => {})

    return res.json({
      ok: true,
      message: `Free trial activated successfully for ${periodDays} days with ${maxTransactions} transactions limit!`,
      plan: trialPlan,
      client: updated,
    })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(err instanceof PlanRequestError ? err.status : 500).json({ ok: false, error: error.message })
  }
})

// ─── Create Subscription Checkout ───────────────────────────────────

planRouter.post('/checkout', requireMerchant, async (req: Request, res: Response) => {
  try {
    const client = (req as unknown as { client: any }).client
    const { planName, senderHandle: initialSender } = req.body

    const normalizedName = String(planName || '').trim().toUpperCase()
    if (!normalizedName) {
      return res.status(400).json({ ok: false, error: 'Please specify a plan name.' })
    }

    // If merchant selects the Free Trial plan, activate directly with 0 EGP cost
    if (normalizedName === 'FREE_TRIAL') {
      const { trialPlan, updated, periodDays, maxTransactions } = await activateFreeTrial(client)

      await db.auditLog.create({
        data: {
          action: 'ACTIVATE_TRIAL',
          details: `Merchant ${client.businessName} activated ${periodDays}-day Free Trial via checkout`,
        },
      }).catch(() => {})

      return res.json({
        ok: true,
        isTrial: true,
        message: `Free trial activated successfully for ${periodDays} days (${maxTransactions} transactions limit)!`,
        plan: trialPlan,
        client: updated,
      })
    }

    if (normalizedName === 'ENTERPRISE') {
      return res.status(400).json({
        ok: false,
        requiresContact: true,
        error: 'Enterprise plan requires custom enterprise onboarding. Please contact Customer Service.',
      })
    }

    const plan = await (db.plan as any).findUnique({ where: { name: normalizedName } })
    if (!plan || !plan.isActive || plan.priceEgp <= 0) {
      return res.status(404).json({ ok: false, error: 'Plan not found or not payable online.' })
    }

    const platformHandle = process.env.PLATFORM_INSTAPAY_HANDLE || 'platform@instapay'
    const platformPaymentUrl =
      process.env.PLATFORM_INSTAPAY_PAYMENT_URL ||
      `https://ipn.eg/S/platform/instapay/SUBSCRIPTION`

    const amountCents = toEgpCents(plan.priceEgp)
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000) // 30 minutes TTL
    const effectiveSender = String(initialSender || client.instapayHandle || 'pending@instapay').trim()

    const transaction = await db.transaction.create({
      data: {
        clientId: client.id,
        senderHandle: effectiveSender,
        recipientHandle: platformHandle,
        amountEgp: plan.priceEgp,
        amountCents,
        currency: 'EGP',
        status: 'PENDING',
        purpose: 'SUBSCRIPTION',
        subscriptionPlanName: plan.name,
        note: `Subscription payment for ${plan.name} plan`,
        deepLinkUrl: platformPaymentUrl,
        deepLinkToken: 'platform_sub',
        expiresAt,
      },
    })

    // Calculate trial rollover bonus days if merchant has active trial time remaining
    const now = Date.now()
    const isCurrentlyOnTrial = Boolean(client.isFreeTrial || client.subscriptionPlan === 'FREE_TRIAL')
    let bonusDays = 0
    if (isCurrentlyOnTrial && client.subscriptionEndsAt) {
      const remainingTrialMs = new Date(client.subscriptionEndsAt).getTime() - now
      if (remainingTrialMs > 0) {
        bonusDays = Math.ceil(remainingTrialMs / (24 * 60 * 60 * 1000))
        const trialPlan = await (db.plan as any).findUnique({ where: { name: 'FREE_TRIAL' } })
        if (trialPlan?.periodDays && bonusDays > trialPlan.periodDays) {
          bonusDays = trialPlan.periodDays
        }
      }
    }

    const basePeriodDays = (plan as any).periodDays || 30
    const totalPeriodDays = basePeriodDays + bonusDays
    const startDate = new Date()
    const endDate = new Date(startDate.getTime() + totalPeriodDays * 24 * 60 * 60 * 1000)

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000'
    const checkoutSubdomainBase =
      process.env.CHECKOUT_SUBDOMAIN_URL ||
      clientUrl.replace('://', '://checkout.')
    const checkoutUrl = `${checkoutSubdomainBase}/pay/${transaction.sessionId}`

    return res.json({
      ok: true,
      sessionId: transaction.sessionId,
      amountEgp: transaction.amountEgp,
      senderHandle: transaction.senderHandle,
      platformHandle,
      checkoutUrl,
      basePeriodDays,
      bonusDays,
      periodDays: totalPeriodDays,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      secondsRemaining: Math.max(0, Math.floor((transaction.expiresAt.getTime() - Date.now()) / 1000)),
      checkout: {
        sessionId: transaction.sessionId,
        planName: plan.name,
        priceEgp: plan.priceEgp,
        recipientHandle: platformHandle,
        paymentUrl: platformPaymentUrl,
        senderHandle: transaction.senderHandle,
        status: transaction.status,
        expiresAt: transaction.expiresAt.toISOString(),
        secondsRemaining: Math.max(0, Math.floor((transaction.expiresAt.getTime() - Date.now()) / 1000)),
        basePeriodDays,
        bonusDays,
        periodDays: totalPeriodDays,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        checkoutUrl,
      },
    })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(err instanceof PlanRequestError ? err.status : 500).json({ ok: false, error: error.message })
  }
})

// ─── Update Sender Handle for Subscription Checkout ──────────────────

planRouter.patch('/checkout/:sessionId/sender', requireMerchant, async (req: Request, res: Response) => {
  try {
    const client = (req as unknown as { client: any }).client
    const sessionId = String(req.params.sessionId)
    const { senderHandle } = req.body

    const clean = String(senderHandle || '').trim().toLowerCase().replace(/^@/, '')
    const local = clean.split('@')[0]
    if (!local) {
      return res.status(400).json({ ok: false, error: 'Please specify a valid InstaPay account username or handle' })
    }
    const normalized = `${local}@instapay`

    const tx = await db.transaction.findFirst({
      where: { sessionId, clientId: client.id, purpose: 'SUBSCRIPTION' },
    })

    if (!tx) {
      return res.status(404).json({ ok: false, error: 'Subscription checkout session not found.' })
    }

    if (tx.status !== 'PENDING') {
      return res.status(400).json({ ok: false, error: `Cannot update handle for a ${tx.status.toLowerCase()} session.` })
    }

    const updated = await db.transaction.update({
      where: { id: tx.id },
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

// ─── Check Subscription Status ──────────────────────────────────────

planRouter.get('/status/:sessionId', requireMerchant, async (req: Request, res: Response) => {
  try {
    const client = (req as unknown as { client: any }).client
    const sessionId = String(req.params.sessionId)

    const transaction = await db.transaction.findFirst({
      where: { sessionId, clientId: client.id, purpose: 'SUBSCRIPTION' },
    })

    if (!transaction) {
      return res.status(404).json({ ok: false, error: 'Subscription checkout session not found.' })
    }

    return res.json({
      ok: true,
      transaction: {
        sessionId: transaction.sessionId,
        status: transaction.status,
        planName: transaction.subscriptionPlanName,
        amountEgp: transaction.amountEgp,
        detectedAt: transaction.detectedAt?.toISOString() || null,
      },
    })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})
