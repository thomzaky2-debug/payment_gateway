import { Router, Request, Response } from 'express'
import { db } from '../db.js'
import { toEgpCents } from '../lib/money.js'
import { requireMerchant } from '../middleware/requireMerchant.js'

export const bundleRouter = Router()

// ─── List Available Top-Up Bundles ──────────────────────────────────

bundleRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const bundles = await (db as any).topUpBundle.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    })
    return res.json({ ok: true, bundles })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})

// ─── Purchase a Top-Up Bundle (create checkout) ─────────────────────

bundleRouter.post('/purchase', requireMerchant, async (req: Request, res: Response) => {
  try {
    const client = (req as unknown as { client: any }).client
    const { bundleName, senderHandle: initialSender } = req.body

    const normalizedName = String(bundleName || '').trim().toUpperCase()
    if (!normalizedName) {
      return res.status(400).json({ ok: false, error: 'Please specify a bundle name.' })
    }

    // Merchant must have an active (non-expired) subscription to buy bundles
    if (!client.subscriptionPlan || client.subscriptionPlan === 'FREE_TRIAL') {
      // Allow for trial users too if they want extra tx
    }

    if (client.subscriptionEndsAt && new Date(client.subscriptionEndsAt).getTime() < Date.now()) {
      return res.status(400).json({
        ok: false,
        error: 'Your subscription has expired. Please renew your plan before purchasing extra bundles.',
      })
    }

    const bundle = await (db as any).topUpBundle.findUnique({
      where: { name: normalizedName },
    })
    if (!bundle || !bundle.isActive) {
      return res.status(404).json({ ok: false, error: 'Bundle not found or not available.' })
    }

    const platformHandle = process.env.PLATFORM_INSTAPAY_HANDLE || 'platform@instapay'
    const platformPaymentUrl =
      process.env.PLATFORM_INSTAPAY_PAYMENT_URL ||
      `https://ipn.eg/S/platform/instapay/BUNDLE`

    const amountCents = toEgpCents(bundle.priceEgp)
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000) // 30 minutes TTL
    const effectiveSender = String(initialSender || client.instapayHandle || 'pending@instapay').trim()

    const transaction = await db.transaction.create({
      data: {
        clientId: client.id,
        senderHandle: effectiveSender,
        recipientHandle: platformHandle,
        amountEgp: bundle.priceEgp,
        amountCents,
        currency: 'EGP',
        status: 'PENDING',
        purpose: 'SUBSCRIPTION',
        subscriptionPlanName: `BUNDLE:${bundle.name}`,
        note: `Top-up bundle purchase: ${bundle.displayName} (+${bundle.extraTx} transactions)`,
        deepLinkUrl: platformPaymentUrl,
        deepLinkToken: 'platform_bundle',
        expiresAt,
      },
    })

    // Create bundle purchase record
    await (db as any).bundlePurchase.create({
      data: {
        clientId: client.id,
        bundleId: bundle.id,
        sessionId: transaction.sessionId,
        extraTx: bundle.extraTx,
        priceEgp: bundle.priceEgp,
        status: 'PENDING',
      },
    })

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000'
    const checkoutSubdomainBase =
      process.env.CHECKOUT_SUBDOMAIN_URL ||
      clientUrl.replace('://', '://checkout.')
    const checkoutUrl = `${checkoutSubdomainBase}/pay/${transaction.sessionId}`

    return res.json({
      ok: true,
      sessionId: transaction.sessionId,
      amountEgp: bundle.priceEgp,
      senderHandle: transaction.senderHandle,
      platformHandle,
      checkoutUrl,
      bundle: {
        name: bundle.name,
        displayName: bundle.displayName,
        extraTx: bundle.extraTx,
        priceEgp: bundle.priceEgp,
      },
      checkout: {
        sessionId: transaction.sessionId,
        bundleName: bundle.name,
        displayName: bundle.displayName,
        extraTx: bundle.extraTx,
        priceEgp: bundle.priceEgp,
        recipientHandle: platformHandle,
        paymentUrl: platformPaymentUrl,
        senderHandle: transaction.senderHandle,
        status: transaction.status,
        expiresAt: transaction.expiresAt.toISOString(),
        secondsRemaining: Math.max(0, Math.floor((transaction.expiresAt.getTime() - Date.now()) / 1000)),
        checkoutUrl,
      },
    })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})

// ─── Get Bundle Purchase History ────────────────────────────────────

bundleRouter.get('/history', requireMerchant, async (req: Request, res: Response) => {
  try {
    const client = (req as unknown as { client: any }).client

    const purchases = await (db as any).bundlePurchase.findMany({
      where: { clientId: client.id },
      include: { bundle: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    return res.json({ ok: true, purchases })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})

// ─── Check Bundle Payment Status ────────────────────────────────────

bundleRouter.get('/status/:sessionId', requireMerchant, async (req: Request, res: Response) => {
  try {
    const client = (req as unknown as { client: any }).client
    const sessionId = String(req.params.sessionId)

    const purchase = await (db as any).bundlePurchase.findFirst({
      where: { sessionId, clientId: client.id },
      include: { bundle: true },
    })

    if (!purchase) {
      return res.status(404).json({ ok: false, error: 'Bundle purchase not found.' })
    }

    return res.json({
      ok: true,
      purchase: {
        id: purchase.id,
        status: purchase.status,
        bundleName: purchase.bundle.name,
        displayName: purchase.bundle.displayName,
        extraTx: purchase.extraTx,
        priceEgp: purchase.priceEgp,
        createdAt: purchase.createdAt,
      },
    })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})
