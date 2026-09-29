import { Router, Request, Response } from 'express'
import { db } from '../db.js'
import { verifySessionToken, generateMerchantKeys } from '../services/authService.js'

export const settingsRouter = Router()

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

// ─── Get Settings & Detector Status ─────────────────────────────────

settingsRouter.get('/', requireMerchant, async (req: Request, res: Response) => {
  try {
    const client = (req as unknown as { client: any }).client
    const devices = await db.detectorDevice.findMany({
      where: { clientId: client.id },
      orderBy: { lastSeenAt: 'desc' },
    })

    return res.json({
      ok: true,
      settings: {
        id: client.id,
        businessName: client.businessName,
        email: client.email,
        instapayHandle: client.instapayHandle,
        instapayPaymentUrl: client.instapayPaymentUrl,
        webhookUrl: client.webhookUrl,
        webhookSecret: client.webhookSecret,
        checkoutTtlMin: client.checkoutTtlMin,
        apiKey: client.apiKey,
        detectToken: client.detectToken,
        subscriptionPlan: client.subscriptionPlan,
        isFreeTrial: client.isFreeTrial,
        txLimit: client.txLimit,
        txCount: client.txCount,
      },
      devices,
    })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})

import { validateWebhookUrl } from '../lib/urlValidator.js'

// ─── Update Settings ────────────────────────────────────────────────

settingsRouter.put('/', requireMerchant, async (req: Request, res: Response) => {
  try {
    const client = (req as unknown as { client: any }).client
    const { instapayPaymentUrl, webhookUrl, checkoutTtlMin, businessName } = req.body

    const cleanWebhookUrl = webhookUrl !== undefined ? webhookUrl?.trim() || null : undefined
    if (cleanWebhookUrl) {
      const check = validateWebhookUrl(cleanWebhookUrl)
      if (!check.valid) {
        return res.status(400).json({ ok: false, error: check.error })
      }
    }

    const cleanPaymentUrl = instapayPaymentUrl !== undefined ? instapayPaymentUrl?.trim() || null : undefined
    if (cleanPaymentUrl && !cleanPaymentUrl.startsWith('https://') && !cleanPaymentUrl.startsWith('http://')) {
      return res.status(400).json({ ok: false, error: 'InstaPay payment URL must start with https://' })
    }

    const updated = await db.client.update({
      where: { id: client.id },
      data: {
        instapayPaymentUrl: cleanPaymentUrl,
        webhookUrl: cleanWebhookUrl,
        checkoutTtlMin: checkoutTtlMin ? Math.max(1, Math.min(60, Number(checkoutTtlMin))) : undefined,
        businessName: businessName?.trim() || undefined,
      },
    })

    return res.json({ ok: true, settings: updated })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})

// ─── Rotate Integration Keys ────────────────────────────────────────

settingsRouter.post('/rotate-keys', requireMerchant, async (req: Request, res: Response) => {
  try {
    const client = (req as unknown as { client: any }).client
    const keys = generateMerchantKeys()

    const updated = await db.client.update({
      where: { id: client.id },
      data: {
        apiKey: keys.apiKey,
        detectToken: keys.detectToken,
        webhookSecret: keys.webhookSecret,
        apiKeyHash: keys.apiKeyHash,
        detectTokenHash: keys.detectTokenHash,
        webhookSecretHash: keys.webhookSecretHash,
      },
    })

    return res.json({
      ok: true,
      apiKey: updated.apiKey,
      detectToken: updated.detectToken,
      webhookSecret: updated.webhookSecret,
    })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})
