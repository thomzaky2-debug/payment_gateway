import { Router, Request, Response } from 'express'
import { db } from '../db.js'
import { generateMerchantKeys, hashToken, MERCHANT_SESSION_COOKIE_NAME } from '../services/authService.js'
import { validateWebhookUrl, validateWebhookUrlDns } from '../lib/urlValidator.js'
import { requireMerchant } from '../middleware/requireMerchant.js'
import { encryptCredential, decryptCredential } from '../lib/credentialCrypto.js'
import { sendInternalError } from '../lib/safeError.js'
import { forwardToClientWebhook } from '../services/webhookService.js'
import { createRateLimiterWithKey } from '../lib/rateLimiter.js'
import { getRequestAuthToken, getRequestIp } from '../middleware/authToken.js'
import { presentSession } from '../lib/sessionPresentation.js'

export const settingsRouter = Router()

const merchantWebhookResendLimiter = createRateLimiterWithKey(
  15 * 60 * 1000,
  10,
  'Too many webhook resend attempts. Please wait before trying again.',
  (req) => `merchant-webhook-resend:${(req as any).client?.id || getRequestIp(req) || 'unknown'}`
)

export function safeMerchantSettings(client: any) {
  if (!client) return null
  const isApproved = client.approvalStatus === 'APPROVED'
  return {
    id: client.id,
    businessName: client.businessName,
    profileImageData: client.profileImageData,
    email: client.email,
    instapayHandle: client.instapayHandle,
    instapayPaymentUrl: client.instapayPaymentUrl,
    webhookUrl: client.webhookUrl,
    webhookSecret: isApproved ? decryptCredential(client.webhookSecret) : null,
    checkoutTtlMin: client.checkoutTtlMin,
    autoAcceptOverpaid: client.autoAcceptOverpaid ?? true,
    overpaidMaxExcessEgp: client.overpaidMaxExcessEgp ?? 100.0,
    underpaidToleranceEnabled: client.underpaidToleranceEnabled ?? false,
    underpaidToleranceEgp: client.underpaidToleranceEgp ?? 5.0,
    apiKey: isApproved ? decryptCredential(client.apiKey) : null,
    detectToken: isApproved ? decryptCredential(client.detectToken) : null,
    subscriptionPlan: client.subscriptionPlan,
    isFreeTrial: client.isFreeTrial,
    txLimit: client.txLimit,
    txCount: client.txCount,
    approvalStatus: client.approvalStatus,
  }
}

const MAX_PROFILE_IMAGE_BYTES = 750 * 1024

function validateProfileImageData(value: unknown): { value?: string; error?: string } {
  if (value === null || value === '') return { value: undefined }
  if (typeof value !== 'string' || value.length > 1_100_000) return { error: 'Profile image must be smaller than 750 KB.' }
  const match = value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/)
  if (!match) return { error: 'Profile image must be a PNG, JPEG, or WebP image.' }
  const image = Buffer.from(match[2], 'base64')
  if (!image.length || image.length > MAX_PROFILE_IMAGE_BYTES) return { error: 'Profile image must be smaller than 750 KB.' }
  const mime = match[1]
  const isPng = image.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  const isJpeg = image.length >= 3 && image[0] === 0xff && image[1] === 0xd8 && image[2] === 0xff
  const isWebp = image.length >= 12 && image.subarray(0, 4).toString('ascii') === 'RIFF' && image.subarray(8, 12).toString('ascii') === 'WEBP'
  if ((mime === 'image/png' && !isPng) || (mime === 'image/jpeg' && !isJpeg) || (mime === 'image/webp' && !isWebp)) {
    return { error: 'Profile image content does not match its declared type.' }
  }
  return { value }
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

// ─── Signed-in Browser & Mobile Sessions ────────────────────────────
// Session metadata is recorded at sign-in. Never infer a city from an IP
// without a vetted geolocation provider; an unavailable location is safer
// and more honest than a guessed one.
settingsRouter.get('/sessions', requireMerchant, async (req: Request, res: Response) => {
  try {
    const client = (req as unknown as { client: any }).client
    const credential = getRequestAuthToken(req, MERCHANT_SESSION_COOKIE_NAME)
    const currentTokenHash = credential ? hashToken(credential.token) : null
    const now = new Date()
    if (currentTokenHash) {
      await db.authSession.updateMany({
        where: { tokenHash: currentTokenHash, clientId: client.id, kind: 'MERCHANT', revokedAt: null },
        data: { lastSeenAt: now, ...(getRequestIp(req) ? { ipAddress: getRequestIp(req) } : {}) },
      })
    }
    const sessions = await db.authSession.findMany({
      where: {
        clientId: client.id,
        kind: 'MERCHANT',
        revokedAt: null,
        rotatedAt: null,
        OR: [
          { expiresAt: { gt: now } },
          { refreshExpiresAt: { gt: now } },
        ],
      },
      orderBy: { lastSeenAt: 'desc' },
      select: {
        id: true,
        tokenHash: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        lastSeenAt: true,
        deviceId: true,
        familyId: true,
        refreshTokenHash: true,
      },
    })

    const deviceIds = sessions.flatMap(session => session.deviceId ? [session.deviceId] : [])
    const devices = deviceIds.length ? await db.detectorDevice.findMany({
      where: { clientId: client.id, deviceId: { in: deviceIds }, revokedAt: null },
      select: { deviceId: true, name: true, appVersion: true },
    }) : []
    const devicesById = new Map(devices.map(device => [device.deviceId, device]))
    res.setHeader('Cache-Control', 'no-store')
    return res.json({
      ok: true,
      sessions: sessions.map(session => presentSession(session, currentTokenHash, session.deviceId ? devicesById.get(session.deviceId) : undefined)),
    })
  } catch (err: unknown) {
    return sendInternalError(res, err, 'Failed to retrieve active sessions')
  }
})

settingsRouter.delete('/sessions/:id', requireMerchant, async (req: Request, res: Response) => {
  try {
    const client = (req as unknown as { client: any }).client
    const credential = getRequestAuthToken(req, MERCHANT_SESSION_COOKIE_NAME)
    const currentTokenHash = credential ? hashToken(credential.token) : null
    const id = String(req.params.id)

    const targetSession = await db.authSession.findFirst({
      where: {
        id,
        clientId: client.id,
        kind: 'MERCHANT',
        revokedAt: null,
        ...(currentTokenHash ? { tokenHash: { not: currentTokenHash } } : {}),
      },
    })

    if (!targetSession) {
      return res.status(404).json({ ok: false, error: 'Session was not found or cannot be revoked.' })
    }

    const revokedAt = new Date()
    if (targetSession.familyId) {
      await db.authSession.updateMany({
        where: { familyId: targetSession.familyId, clientId: client.id },
        data: { revokedAt },
      })
    } else {
      await db.authSession.update({
        where: { id: targetSession.id },
        data: { revokedAt },
      })
    }

    return res.json({ ok: true })
  } catch (err: unknown) {
    return sendInternalError(res, err, 'Failed to revoke session')
  }
})

settingsRouter.post('/sessions/revoke-others', requireMerchant, async (req: Request, res: Response) => {
  try {
    const client = (req as unknown as { client: any }).client
    const credential = getRequestAuthToken(req, MERCHANT_SESSION_COOKIE_NAME)
    const currentTokenHash = credential ? hashToken(credential.token) : null
    const result = await db.authSession.updateMany({
      where: { clientId: client.id, kind: 'MERCHANT', revokedAt: null, ...(currentTokenHash ? { tokenHash: { not: currentTokenHash } } : {}) },
      data: { revokedAt: new Date() },
    })
    return res.json({ ok: true, revokedSessions: result.count })
  } catch (err: unknown) {
    return sendInternalError(res, err, 'Failed to revoke other sessions')
  }
})

// ─── Profile Photo ─────────────────────────────────────────────────
settingsRouter.put('/profile-image', requireMerchant, async (req: Request, res: Response) => {
  try {
    const validated = validateProfileImageData(req.body?.profileImageData)
    if (validated.error) return res.status(400).json({ ok: false, error: validated.error })
    const client = (req as unknown as { client: any }).client
    const updated = await db.client.update({
      where: { id: client.id },
      data: { profileImageData: validated.value ?? null },
      select: { profileImageData: true },
    })
    return res.json({ ok: true, profileImageData: updated.profileImageData })
  } catch (err: unknown) {
    return sendInternalError(res, err, 'Failed to update profile image')
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

    if (cleanHandle || cleanPaymentUrl) {
      const conflict = await db.client.findFirst({
        where: {
          id: { not: client.id },
          OR: [
            ...(cleanHandle ? [{ instapayHandle: { equals: cleanHandle, mode: 'insensitive' as const } }] : []),
            ...(cleanPaymentUrl ? [{ instapayPaymentUrl: { equals: cleanPaymentUrl, mode: 'insensitive' as const } }] : []),
          ],
        },
      })
      if (conflict) {
        return res.status(409).json({
          ok: false,
          error: 'This InstaPay handle or payment link is already in use by another merchant.',
        })
      }
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
    if (client.approvalStatus !== 'APPROVED') {
      return res.status(403).json({
        ok: false,
        error: 'Integration keys can only be generated or rotated once your merchant account is approved by an admin.',
      })
    }
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
