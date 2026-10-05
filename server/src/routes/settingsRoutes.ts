import { Router, Request, Response } from 'express'
import { db } from '../db.js'
import { generateMerchantKeys } from '../services/authService.js'
import { validateWebhookUrl } from '../lib/urlValidator.js'
import { requireMerchant } from '../middleware/requireMerchant.js'

export const settingsRouter = Router()

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
        autoAcceptOverpaid: client.autoAcceptOverpaid ?? true,
        overpaidMaxExcessEgp: client.overpaidMaxExcessEgp ?? 100.0,
        underpaidToleranceEnabled: client.underpaidToleranceEnabled ?? false,
        underpaidToleranceEgp: client.underpaidToleranceEgp ?? 5.0,
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


// ─── Update Settings ────────────────────────────────────────────────

settingsRouter.put('/', requireMerchant, async (req: Request, res: Response) => {
  try {
    const client = (req as unknown as { client: any }).client
    const {
      instapayPaymentUrl,
      instapayHandle,
      webhookUrl,
      checkoutTtlMin,
      businessName,
      autoAcceptOverpaid,
      overpaidMaxExcessEgp,
      underpaidToleranceEnabled,
      underpaidToleranceEgp,
    } = req.body

    const cleanWebhookUrl = webhookUrl !== undefined ? webhookUrl?.trim() || null : undefined
    if (cleanWebhookUrl) {
      const check = validateWebhookUrl(cleanWebhookUrl)
      if (!check.valid) {
        return res.status(400).json({ ok: false, error: check.error })
      }
    }

    const cleanPaymentUrl = instapayPaymentUrl !== undefined ? instapayPaymentUrl?.trim() || null : undefined
    let derivedHandle: string | undefined = undefined
    if (cleanPaymentUrl) {
      if (!cleanPaymentUrl.startsWith('https://') && !cleanPaymentUrl.startsWith('http://')) {
        return res.status(400).json({ ok: false, error: 'InstaPay payment URL must start with https://' })
      }
      const match = cleanPaymentUrl.match(/ipn\.eg\/S\/([^\/\s?#]+)/i) || cleanPaymentUrl.match(/\/S\/([^\/\?#]+)/i)
      if (match && match[1]) {
        derivedHandle = `${match[1].toLowerCase()}@instapay`
      }
    }

    let cleanHandle: string | undefined = undefined
    if (instapayHandle !== undefined && instapayHandle !== null && String(instapayHandle).trim()) {
      const rawHandle = String(instapayHandle).trim()
      if (rawHandle.startsWith('http://') || rawHandle.startsWith('https://') || rawHandle.includes('ipn.eg')) {
        const match = rawHandle.match(/ipn\.eg\/S\/([^\/\s?#]+)/i) || rawHandle.match(/\/S\/([^\/\?#]+)/i)
        if (match && match[1]) {
          cleanHandle = `${match[1].toLowerCase()}@instapay`
        } else {
          const fallback = rawHandle.replace(/^https?:\/\//i, '').replace(/[^a-z0-9_.-]/gi, '')
          cleanHandle = `${fallback}@instapay`
        }
      } else {
        const clean = rawHandle.replace(/^@/, '').split('@')[0].trim().toLowerCase()
        cleanHandle = `${clean}@instapay`
      }
    } else if (derivedHandle) {
      cleanHandle = derivedHandle
    }

    const updated = await db.client.update({
      where: { id: client.id },
      data: {
        instapayPaymentUrl: cleanPaymentUrl,
        instapayHandle: cleanHandle !== undefined ? cleanHandle : undefined,
        webhookUrl: cleanWebhookUrl,
        checkoutTtlMin: checkoutTtlMin ? Math.max(1, Math.min(60, Number(checkoutTtlMin))) : undefined,
        businessName: businessName?.trim() || undefined,
        autoAcceptOverpaid: autoAcceptOverpaid !== undefined ? Boolean(autoAcceptOverpaid) : undefined,
        overpaidMaxExcessEgp:
          overpaidMaxExcessEgp !== undefined
            ? overpaidMaxExcessEgp === null
              ? null
              : Math.max(0, Number(overpaidMaxExcessEgp))
            : undefined,
        underpaidToleranceEnabled:
          underpaidToleranceEnabled !== undefined ? Boolean(underpaidToleranceEnabled) : undefined,
        underpaidToleranceEgp:
          underpaidToleranceEgp !== undefined ? Math.max(0, Number(underpaidToleranceEgp)) : undefined,
      },
    })

    if (checkoutTtlMin) {
      const ttlMin = Math.max(1, Math.min(60, Number(checkoutTtlMin)))
      const newExpiresAt = new Date(Date.now() + ttlMin * 60 * 1000)
      await db.transaction
        .updateMany({
          where: {
            clientId: client.id,
            status: 'PENDING',
          },
          data: {
            expiresAt: newExpiresAt,
          },
        })
        .catch(() => {})

      // Also sync test demo session
      await db.transaction
        .updateMany({
          where: {
            sessionId: 'cmt_test_local_session',
            clientId: client.id,
          },
          data: {
            expiresAt: newExpiresAt,
            status: 'PENDING',
          },
        })
        .catch(() => {})
    }

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

// ─── Merchant Audit & Webhook Logs ──────────────────────────────────

settingsRouter.get('/audit-logs', requireMerchant, async (req: Request, res: Response) => {
  try {
    const client = (req as unknown as { client: any }).client

    // Webhook logs for this merchant
    const webhookLogs = await db.webhookLog.findMany({
      where: { clientId: client.id },
      orderBy: { createdAt: 'desc' },
      take: 60,
    })

    // Transactions for this merchant
    const transactions = await db.transaction.findMany({
      where: { clientId: client.id },
      orderBy: { createdAt: 'desc' },
      take: 60,
      select: {
        id: true,
        sessionId: true,
        amountEgp: true,
        status: true,
        senderHandle: true,
        recipientHandle: true,
        detectedRef: true,
        note: true,
        createdAt: true,
        detectedAt: true,
      },
    })

    // Device health / companion events
    const devices = await db.detectorDevice.findMany({
      where: { clientId: client.id },
      orderBy: { lastSeenAt: 'desc' },
    })

    return res.json({
      ok: true,
      webhookLogs,
      transactions,
      devices,
    })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})
