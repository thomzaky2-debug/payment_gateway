import { Router, Request, Response } from 'express'
import { db } from '../db.js'
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

    let currentStatus = tx.status
    if (secondsRemaining === 0 && currentStatus === 'PENDING') {
      currentStatus = 'EXPIRED'
      void db.transaction
        .update({
          where: { id: tx.id },
          data: { status: 'EXPIRED' },
        })
        .catch(() => {})
    }

    return res.json({
      ok: true,
      checkout: {
        sessionId: tx.sessionId,
        businessName: tx.client.businessName,
        recipientHandle: tx.recipientHandle,
        senderHandle: tx.senderHandle,
        amountEgp: tx.amountEgp,
        currency: tx.currency,
        status: currentStatus,
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

/**
 * Allows the customer to set or update the InstaPay account handle they will pay from
 */
checkoutRouter.patch('/:sessionId/sender', async (req: Request, res: Response) => {
  try {
    const sessionId = String(req.params.sessionId)
    const { senderHandle } = req.body

    if (!senderHandle || typeof senderHandle !== 'string') {
      return res.status(400).json({ ok: false, error: 'InstaPay account username is required' })
    }

    const tx = await db.transaction.findUnique({
      where: { sessionId },
    })

    if (!tx) {
      return res.status(404).json({ ok: false, error: 'Checkout session not found' })
    }

    if (tx.status !== 'PENDING') {
      return res.status(400).json({ ok: false, error: `Cannot update handle for session in ${tx.status} status` })
    }

    const clean = senderHandle.trim().toLowerCase().replace(/^@/, '')
    const local = clean.split('@')[0]
    if (!local) {
      return res.status(400).json({ ok: false, error: 'Invalid InstaPay handle format' })
    }
    const normalized = `${local}@instapay`

    const updated = await db.transaction.update({
      where: { sessionId },
      data: { senderHandle: normalized },
    })

    return res.json({
      ok: true,
      senderHandle: updated.senderHandle,
      message: 'InstaPay account username updated successfully',
    })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})
