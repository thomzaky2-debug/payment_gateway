import { Router, Request, Response } from 'express'
import { db } from '../db.js'
import { generateMerchantKeys } from '../services/authService.js'
import { validateWebhookUrl, validateWebhookUrlDns } from '../lib/urlValidator.js'
import { requireMerchant } from '../middleware/requireMerchant.js'
import { encryptCredential, decryptCredential } from '../lib/credentialCrypto.js'
import { sendInternalError } from '../lib/safeError.js'
import { forwardToClientWebhook } from '../services/webhookService.js'
import { createRateLimiterWithKey } from '../lib/rateLimiter.js'
import { getRequestIp } from '../middleware/authToken.js'

export const settingsRouter = Router()

const merchantWebhookResendLimiter = createRateLimiterWithKey(
  15 * 60 * 1000,
  10,
  'Too many webhook resend attempts. Please wait before trying again.',
  (req) => `merchant-webhook-resend:${(req as any).client?.id || getRequestIp(req) || 'unknown'}`
)

export function safeMerchantSettings(client: any) {
  if (!client) return null
  return {
    id: client.id,
    businessName: client.businessName,
    email: client.email,
    instapayHandle: client.instapayHandle,
    instapayPaymentUrl: client.instapayPaymentUrl,
    webhookUrl: client.webhookUrl,
    webhookSecret: decryptCredential(client.webhookSecret),
    checkoutTtlMin: client.checkoutTtlMin,
    autoAcceptOverpaid: client.autoAcceptOverpaid ?? true,
    overpaidMaxExcessEgp: client.overpaidMaxExcessEgp ?? 100.0,
    underpaidToleranceEnabled: client.underpaidToleranceEnabled ?? false,
    underpaidToleranceEgp: client.underpaidToleranceEgp ?? 5.0,
    apiKey: decryptCredential(client.apiKey),
    detectToken: decryptCredential(client.detectToken),
    subscriptionPlan: client.subscriptionPlan,
    isFreeTrial: client.isFreeTrial,
    txLimit: client.txLimit,
    txCount: client.txCount,
  }
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
      settings: safeMerchantSettings(client),
      devices,
    })
  } catch (err: unknown) {
    return sendInternalError(res, err, 'Failed to retrieve settings')
  }
})

// ─── Detector Heartbeat ────────────────────────────────────────────
// The Android detector is online even when no payment has arrived yet.
// Keep its availability separate from payment ingestion so the portal can
// accurately report a connected, listening device.
settingsRouter.post('/detector/heartbeat', requireMerchant, async (req: Request, res: Response) => {
  try {
    const client = (req as unknown as { client: any }).client
    const { deviceId, appVersion, androidVersion } = req.body || {}
    const cleanDeviceId = typeof deviceId === 'string' ? deviceId.trim().slice(0, 128) : ''
    if (!cleanDeviceId) {
      return res.status(400).json({ ok: false, error: 'Detector device identifier is required.' })
    }

    const device = await db.detectorDevice.upsert({
      where: { clientId_deviceId: { clientId: client.id, deviceId: cleanDeviceId } },
      create: {
        clientId: client.id,
        deviceId: cleanDeviceId,
        appVersion: typeof appVersion === 'string' ? appVersion.trim().slice(0, 64) || null : null,
        androidVersion: typeof androidVersion === 'string' ? androidVersion.trim().slice(0, 64) || null : null,
        lastIp: getRequestIp(req),
      },
      update: {
        appVersion: typeof appVersion === 'string' ? appVersion.trim().slice(0, 64) || undefined : undefined,
        androidVersion: typeof androidVersion === 'string' ? androidVersion.trim().slice(0, 64) || undefined : undefined,
        lastIp: getRequestIp(req),
        lastSeenAt: new Date(),
      },
      select: { id: true, deviceId: true, lastSeenAt: true },
    })

    return res.json({ ok: true, device })
  } catch (err: unknown) {
    return sendInternalError(res, err, 'Failed to record detector heartbeat')
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
      const check = await validateWebhookUrlDns(cleanWebhookUrl)
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

    return res.json({ ok: true, settings: safeMerchantSettings(updated) })
  } catch (err: unknown) {
    return sendInternalError(res, err, 'Failed to update settings')
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
        apiKey: encryptCredential(keys.apiKey),
        detectToken: encryptCredential(keys.detectToken),
        webhookSecret: encryptCredential(keys.webhookSecret),
        apiKeyHash: keys.apiKeyHash,
        detectTokenHash: keys.detectTokenHash,
        webhookSecretHash: keys.webhookSecretHash,
      },
    })

    return res.json({
      ok: true,
      apiKey: keys.apiKey,
      detectToken: keys.detectToken,
      webhookSecret: keys.webhookSecret,
    })
  } catch (err: unknown) {
    return sendInternalError(res, err, 'Failed to rotate credentials')
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
    return sendInternalError(res, err, 'Failed to retrieve audit logs')
  }
})

// Merchant self-service manual resend for failed webhooks.
settingsRouter.post('/webhooks/:id/resend', requireMerchant, merchantWebhookResendLimiter, async (req: Request, res: Response) => {
  try {
    const client = (req as unknown as { client: any }).client
    const id = String(req.params.id)

    const log = await db.webhookLog.findFirst({
      where: { id, clientId: client.id },
    })

    if (!log) {
      return res.status(404).json({ ok: false, error: 'Webhook log not found' })
    }

    if (log.isSuccess) {
      return res.status(409).json({ ok: false, error: 'Successful webhook deliveries cannot be resent.' })
    }

    let payload: any
    try {
      payload = JSON.parse(log.payload)
    } catch {
      return res.status(400).json({ ok: false, error: 'Invalid stored webhook payload JSON' })
    }

    const now = new Date()
    const claim = await db.webhookLog.updateMany({
      where: {
        id: log.id,
        clientId: client.id,
        isSuccess: false,
        outcomeKnown: true,
        OR: [
          { deliveryLockedUntil: null },
          { deliveryLockedUntil: { lte: now } },
        ],
      },
      data: { deliveryLockedUntil: new Date(now.getTime() + 60_000), deliveryStartedAt: now, outcomeKnown: false },
    })
    if (claim.count !== 1) {
      return res.status(409).json({ ok: false, error: 'This webhook delivery is already being processed.' })
    }

    const currentClient = await db.client.findUnique({
      where: { id: client.id },
      select: { webhookUrl: true, webhookSecret: true },
    })

    const targetUrl = currentClient?.webhookUrl || log.url
    const result = await forwardToClientWebhook(
      client.id,
      targetUrl,
      currentClient?.webhookSecret ?? null,
      payload,
      log.attempt + 1,
      log.id,
      log.eventId || undefined
    )

    await db.auditLog.create({
      data: {
        action: 'MERCHANT_RESEND_WEBHOOK',
        details: `Merchant ${client.id} manually resent webhook log ${log.id} from ${getRequestIp(req) || 'unknown-ip'}: ${result.persistenceFailed ? 'PERSISTENCE_FAILED — automatic retries paused for manual review' : result.success ? 'SUCCESS' : 'FAILED'}`,
      },
    }).catch((auditError) => {
      console.error(`[settings/webhooks] Failed to audit merchant resend for ${log.id}:`, auditError)
    })

    return res.status(result.persistenceFailed ? 202 : 200).json({
      ok: !result.persistenceFailed,
      result,
      message: result.persistenceFailed
        ? 'Delivery was attempted, but its result could not be recorded. Automatic retries are paused for manual review.'
        : result.success ? 'Webhook redelivered successfully' : `Delivery attempted: ${result.error}`,
    })
  } catch (err: unknown) {
    return sendInternalError(res, err, 'Failed to resend webhook')
  }
})
