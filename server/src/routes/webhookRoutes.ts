import { Router, Request, Response } from 'express'
import { authenticateByDetectToken } from '../services/authService.js'
import { processInstaPayNotification } from '../services/matcherService.js'
import { getRequestIp } from '../middleware/authToken.js'

export const webhookRouter = Router()

/**
 * Android Detector Webhook Ingestion Endpoint
 *
 * The companion Android Detector APK sends receipt notifications here.
 */
webhookRouter.post('/instapay', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization
    const bearerMatch = authHeader?.match(/^Bearer\s+([^\s]+)$/i)
    const token = bearerMatch?.[1]

    if (!token) {
      return res.status(401).json({ ok: false, error: 'Unauthorized. Missing detectToken.' })
    }

    const client = await authenticateByDetectToken(token)
    if (!client) {
      return res.status(401).json({ ok: false, error: 'Unauthorized. Invalid detectToken.' })
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
    const error = err as Error
    console.error('[webhook/instapay] Processing error:', error)
    return res.status(400).json({ ok: false, error: error.message || 'Notification processing failed' })
  }
})
