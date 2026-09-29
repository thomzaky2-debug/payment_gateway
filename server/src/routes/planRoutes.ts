import { Router, Request, Response } from 'express'
import { db } from '../db.js'
import { verifySessionToken } from '../services/authService.js'
import { toEgpCents } from '../lib/money.js'

export const planRouter = Router()

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

// ─── List Public Plans ──────────────────────────────────────────────

planRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const plans = await db.plan.findMany({
      orderBy: { priceEgp: 'asc' },
    })
    return res.json({ ok: true, plans })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})

// ─── Create Subscription Checkout ───────────────────────────────────

planRouter.post('/checkout', requireMerchant, async (req: Request, res: Response) => {
  try {
    const client = (req as unknown as { client: any }).client
    const { planName } = req.body

    const normalizedName = String(planName || '').trim().toUpperCase()
    if (!normalizedName || normalizedName === 'FREE_TRIAL') {
      return res.status(400).json({ ok: false, error: 'Please choose a valid paid plan (BASIC, PRO, ENTERPRISE).' })
    }

    const plan = await db.plan.findUnique({ where: { name: normalizedName } })
    if (!plan || plan.priceEgp <= 0) {
      return res.status(404).json({ ok: false, error: 'Plan not found or not payable.' })
    }

    const platformHandle = process.env.PLATFORM_INSTAPAY_HANDLE || 'platform@instapay'
    const platformPaymentUrl =
      process.env.PLATFORM_INSTAPAY_PAYMENT_URL ||
      `https://ipn.eg/S/platform/instapay/SUBSCRIPTION`

    const amountCents = toEgpCents(plan.priceEgp)
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000) // 30 minutes TTL

    const transaction = await db.transaction.create({
      data: {
        clientId: client.id,
        senderHandle: client.instapayHandle,
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

    return res.json({
      ok: true,
      sessionId: transaction.sessionId,
      checkout: {
        sessionId: transaction.sessionId,
        planName: plan.name,
        priceEgp: plan.priceEgp,
        recipientHandle: platformHandle,
        paymentUrl: platformPaymentUrl,
        senderHandle: client.instapayHandle,
        status: transaction.status,
        expiresAt: transaction.expiresAt.toISOString(),
      },
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
