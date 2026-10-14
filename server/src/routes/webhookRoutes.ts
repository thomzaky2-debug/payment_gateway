import { Router, Request, Response } from 'express'
import { authenticateByDetectToken } from '../services/authService.js'
import { authenticateByDeviceToken } from '../services/deviceService.js'
import { processInstaPayNotification } from '../services/matcherService.js'
import { getRequestIp } from '../middleware/authToken.js'
import { safeErrorMessage } from '../lib/safeError.js'
import type { Client } from '@prisma/client'

export const webhookRouter = Router()

function isSupportedDeviceTokenClient(req: Request): boolean {
  if (req.headers['x-client-supports-device-tokens'] === 'true') return true
  const appVersion = typeof req.body?.appVersion === 'string' ? req.body.appVersion : null
  if (appVersion) {
    const parts = appVersion.split('.').map((n: string) => parseInt(n, 10) || 0)
    // Version 2.0.0 or higher supports per-device credentials
    if ((parts[0] || 0) >= 2) return true
  }
  return false
}

/**
 * Android Detector Webhook Ingestion Endpoint
 *
 * Accepts either:
 * 1. Per-device credentials (deviceToken) via Authorization: Bearer npdt_...
 * 2. Legacy shared detectToken until LEGACY_DETECT_TOKEN_SUNSET date.
 */
webhookRouter.post('/instapay', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization
    const bearerMatch = authHeader?.match(/^Bearer\s+([^\s]+)$/i)
    const token = bearerMatch?.[1]

    if (!token) {
      return res.status(401).json({ ok: false, error: 'Unauthorized. Missing authentication token.' })
    }

    let client: Client | null = null

    // 1. Try per-device credential authentication first
    const deviceAuth = await authenticateByDeviceToken(token, getRequestIp(req))
    if (deviceAuth.success) {
      client = deviceAuth.client
    } else {
      const failed = deviceAuth as { success: false; error: string }
      if (failed.error === 'DEVICE_REVOKED') {
        return res.status(401).json({ ok: false, error: 'Unauthorized. Device is revoked.' })
      }
      if (failed.error === 'MERCHANT_INACTIVE') {
        return res.status(401).json({ ok: false, error: 'Unauthorized. Merchant account is inactive.' })
      }
    }

    // 2. If not a device token, evaluate legacy detectToken
    if (!client) {
      const legacyClient = await authenticateByDetectToken(token)
      if (legacyClient) {
        // Enforce legacy detect token sunset policy
        const sunsetStr = process.env.LEGACY_DETECT_TOKEN_SUNSET
        if (sunsetStr) {
          const sunsetDate = new Date(sunsetStr)
          if (Number.isFinite(sunsetDate.getTime()) && Date.now() > sunsetDate.getTime()) {
            if (isSupportedDeviceTokenClient(req)) {
              return res.status(401).json({
                ok: false,
                error: 'Unauthorized. Legacy detectToken has been sunset. Please use a device token.',
              })
            }
          }
        }
        client = legacyClient
      }
    }

    if (!client) {
      return res.status(401).json({ ok: false, error: 'Unauthorized. Invalid authentication token.' })
    }

    const {
      amountEgp,
      senderHandle,
      reference,
      text,
      notificationTimestamp,
      deviceId,
      appVersion,
      androidVersion,
      eventId,
    } = req.body

    const result = await processInstaPayNotification({
      client,
      amountEgp,
      senderHandle,
      reference,
      rawText: text,
      notificationTimestamp,
      deviceId,
      appVersion,
      androidVersion,
      requestIp: getRequestIp(req),
      eventId: eventId || req.get('x-instapay-event-id') || null,
    })

    return res.json(result)
  } catch (err: unknown) {
    console.error('[webhook/instapay] Processing error:', err)
    return res.status(400).json({
      ok: false,
      error: safeErrorMessage(err, 'Notification processing failed'),
    })
  }
})
