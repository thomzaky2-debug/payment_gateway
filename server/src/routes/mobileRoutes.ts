import { Router, Request, Response } from 'express'
import { requireMerchant } from '../middleware/requireMerchant.js'
import {
  enrollDetectorDevice,
  listMerchantDevices,
  revokeDetectorDevice,
} from '../services/deviceService.js'
import { getRequestIp } from '../middleware/authToken.js'
import { createRateLimiterWithKey } from '../lib/rateLimiter.js'
import { sendInternalError } from '../lib/safeError.js'
import { decodePaymentCursor, listMobilePayments, MOBILE_PAYMENT_STATUSES } from '../services/mobilePaymentService.js'

export const mobileRouter = Router()

mobileRouter.get('/profile', requireMerchant, (req: Request, res: Response) => {
  const client = (req as any).client
  res.setHeader('Cache-Control', 'no-store')
  return res.json({ ok: true, profile: { id: client.id, businessName: client.businessName, email: client.email, profileImageData: client.profileImageData ?? null } })
})

mobileRouter.get('/payments', requireMerchant, async (req: Request, res: Response) => {
  const status = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : 'ALL'
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : ''
  const limit = req.query.limit === undefined ? 30 : Number(req.query.limit)
  let cursor: ReturnType<typeof decodePaymentCursor> | undefined
  try {
    if (!Object.hasOwn(MOBILE_PAYMENT_STATUSES, status) || search.length > 200 || !Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error()
    if (req.query.cursor !== undefined) {
      if (typeof req.query.cursor !== 'string') throw new Error()
      cursor = decodePaymentCursor(req.query.cursor)
    }
  } catch {
    return res.status(400).json({ ok: false, error: 'Invalid payment filter, search, limit, or cursor.' })
  }
  try {
    const result = await listMobilePayments((req as any).client.id, status, search, limit, cursor)
    res.setHeader('Cache-Control', 'no-store')
    return res.json({ ok: true, ...result })
  } catch (error) {
    return sendInternalError(res, error, 'Failed to load merchant payments')
  }
})

// Rate limiter for device enrollment: 10 per 15 min per device & IP
const deviceEnrollLimiter = createRateLimiterWithKey(
  15 * 60 * 1000,
  10,
  'Too many device enrollment attempts. Please try again later.',
  (req) => {
    const deviceId = typeof req.body?.deviceId === 'string' ? req.body.deviceId.slice(0, 128) : 'nodevice'
    return `device-enroll:${getRequestIp(req)}:${deviceId}`
  }
)

/**
 * GET /api/mobile/config
 * Provides runtime version policies, sunset notices, and force-update configurations.
 */
mobileRouter.get('/config', (req: Request, res: Response) => {
  const sunsetStr = process.env.LEGACY_DETECT_TOKEN_SUNSET
  let sunsetWarning: string | null = null

  if (sunsetStr) {
    const sunsetDate = new Date(sunsetStr)
    if (Number.isFinite(sunsetDate.getTime())) {
      const now = Date.now()
      const diffMs = sunsetDate.getTime() - now
      const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000))

      if (diffDays <= 30) {
        sunsetWarning =
          diffDays > 0
            ? `Notice: Legacy detect tokens will cease functioning in ${diffDays} day${diffDays === 1 ? '' : 's'} (${sunsetDate.toISOString()}). Please upgrade to a per-device credential.`
            : `Warning: Legacy detect tokens were sunset on ${sunsetDate.toISOString()}. Clients must use per-device credentials.`
      }
    }
  }

  const requestedApp = typeof req.query.app === 'string' ? req.query.app.toLowerCase() : null
  const requestedVersion = typeof req.query.version === 'string' ? req.query.version : null

  const minVersions: Record<string, string> = {
    merchant: process.env.MIN_VERSION_MERCHANT || '1.0.0',
    detector: process.env.MIN_VERSION_DETECTOR || '1.0.0',
    admin: process.env.MIN_VERSION_ADMIN || '1.0.0',
  }

  let updateRequired = false
  if (requestedApp && requestedVersion && minVersions[requestedApp]) {
    updateRequired = compareSemanticVersions(requestedVersion, minVersions[requestedApp]) < 0
  }

  return res.json({
    ok: true,
    minVersions,
    message: process.env.MOBILE_CONFIG_MESSAGE || null,
    legacyDetectTokenSunset: sunsetStr || null,
    sunsetWarning,
    ...(requestedApp ? { updateRequired } : {}),
  })
})

function compareSemanticVersions(v1: string, v2: string): number {
  const p1 = v1.split('.').map((n) => parseInt(n, 10) || 0)
  const p2 = v2.split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const a = p1[i] || 0
    const b = p2[i] || 0
    if (a > b) return 1
    if (a < b) return -1
  }
  return 0
}

/**
 * POST /api/mobile/devices/enroll
 * Registers a detector device and returns its permanent device token ONCE.
 */
mobileRouter.post('/devices/enroll', requireMerchant, deviceEnrollLimiter, async (req: Request, res: Response) => {
  try {
    const client = (req as any).client
    const { deviceId, name, appVersion, androidVersion } = req.body

    if (!deviceId || typeof deviceId !== 'string' || deviceId.trim().length < 3) {
      return res.status(400).json({ ok: false, error: 'deviceId is required and must be at least 3 characters' })
    }

    const enrolled = await enrollDetectorDevice({
      clientId: client.id,
      deviceId,
      name,
      appVersion,
      androidVersion,
      requestIp: getRequestIp(req),
    })

    return res.json({
      ok: true,
      deviceId: enrolled.deviceId,
      id: enrolled.id,
      name: enrolled.name,
      deviceToken: enrolled.deviceToken,
      message: 'Device enrolled successfully. Store this deviceToken securely; it will not be displayed again.',
    })
  } catch (err: unknown) {
    return sendInternalError(res, err, 'Device enrollment failed')
  }
})

/**
 * GET /api/mobile/devices
 * Lists all registered detector devices for the authenticated merchant.
 */
mobileRouter.get('/devices', requireMerchant, async (req: Request, res: Response) => {
  try {
    const client = (req as any).client
    const devices = await listMerchantDevices(client.id)
    return res.json({ ok: true, devices })
  } catch (err: unknown) {
    return sendInternalError(res, err, 'Failed to list devices')
  }
})

/**
 * DELETE /api/mobile/devices/:id
 * Revokes a device credential immediately.
 */
mobileRouter.delete('/devices/:id', requireMerchant, async (req: Request, res: Response) => {
  try {
    const client = (req as any).client
    const targetId = String(req.params.id || '').trim()
    if (!targetId) {
      return res.status(400).json({ ok: false, error: 'Device identifier is required' })
    }

    const revoked = await revokeDetectorDevice(client.id, targetId)
    if (!revoked) {
      return res.status(404).json({ ok: false, error: 'Device not found or not owned by merchant' })
    }

    return res.json({ ok: true, message: 'Device revoked successfully' })
  } catch (err: unknown) {
    return sendInternalError(res, err, 'Failed to revoke device')
  }
})
