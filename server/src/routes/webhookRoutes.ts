import { Router, Request, Response } from 'express'
import { authenticateByDetectToken } from '../services/authService.js'
import { processInstaPayNotification } from '../services/matcherService.js'

export const webhookRouter = Router()

/**
 * Android Detector Webhook Ingestion Endpoint
 *
 * The companion Android Detector APK sends receipt notifications here.
 */
webhookRouter.post('/instapay', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization
    const token = authHeader?.replace(/^Bearer\s+/i, '') || (req.query.detectToken as string)

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
    } = req.body

    const requestIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      null

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
      requestIp,
    })

    return res.json(result)
  } catch (err: unknown) {
    const error = err as Error
    console.error('[webhook/instapay] Processing error:', error)
    return res.status(400).json({ ok: false, error: error.message || 'Notification processing failed' })
  }
})
