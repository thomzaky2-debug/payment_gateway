import { Router, Request, Response } from 'express'
import { getCheckoutSession } from '../services/checkoutService.js'

export const checkoutRouter = Router()

/**
 * Public endpoint consumed by customer hosted checkout page
 */
checkoutRouter.get('/:sessionId', async (req: Request, res: Response) => {
  try {
    const sessionId = String(req.params.sessionId)
    const tx = await getCheckoutSession(sessionId)

    if (!tx) {
      return res.status(404).json({ ok: false, error: 'Checkout session not found' })
    }

    const now = Date.now()
    const expiresAt = new Date(tx.expiresAt).getTime()
    const secondsRemaining = Math.max(0, Math.floor((expiresAt - now) / 1000))

    return res.json({
      ok: true,
      checkout: {
        sessionId: tx.sessionId,
        businessName: tx.client.businessName,
        recipientHandle: tx.recipientHandle,
        senderHandle: tx.senderHandle,
        amountEgp: tx.amountEgp,
        currency: tx.currency,
        status: tx.status,
        deepLinkUrl: tx.deepLinkUrl,
        expiresAt: tx.expiresAt.toISOString(),
        secondsRemaining,
        detectedRef: tx.detectedRef,
        detectedAt: tx.detectedAt?.toISOString() ?? null,
        note: tx.note,
      },
    })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})
