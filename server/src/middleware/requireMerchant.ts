import { Request, Response, NextFunction } from 'express'
import { db } from '../db.js'
import {
  MERCHANT_SESSION_COOKIE_NAME,
  verifySessionToken,
} from '../services/authService.js'
import { getRequestAuthToken } from './authToken.js'

/**
 * Shared middleware — Authenticate merchant session from cookie or Authorization header.
 * Attaches `req.merchant` to the request object for downstream handlers.
 *
 * Replaces 4 duplicated copies across:
 *   - transactionRoutes.ts
 *   - settingsRoutes.ts
 *   - notificationRoutes.ts
 *   - planRoutes.ts
 */
export async function requireMerchant(req: Request, res: Response, next: NextFunction) {
  try {
    const credential = getRequestAuthToken(req, MERCHANT_SESSION_COOKIE_NAME)
    const clientId = await verifySessionToken(credential?.token)
    if (!clientId) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' })
    }

    const client = await db.client.findUnique({ where: { id: clientId } })
    if (!client) {
      return res.status(401).json({ ok: false, error: 'Merchant not found' })
    }

    if (client.approvalStatus === 'PENDING') {
      return res.status(403).json({ ok: false, error: 'Your merchant account is pending admin approval.' })
    }
    if (client.approvalStatus !== 'APPROVED' || !client.isActive) {
      return res.status(403).json({ ok: false, error: 'Your merchant account is inactive or rejected.' })
    }

    if (client.subscriptionPlan === 'FREE_TRIAL' || client.isFreeTrial) {
      const trialPlan = await (db.plan as any).findUnique({ where: { name: 'FREE_TRIAL' } })
      if (trialPlan && trialPlan.maxTransactions && client.txLimit !== trialPlan.maxTransactions) {
        client.txLimit = trialPlan.maxTransactions
        db.client.update({ where: { id: client.id }, data: { txLimit: trialPlan.maxTransactions } }).catch(() => {})
      }
    }

    ;(req as any).auth = {
      role: 'merchant',
      subjectId: client.id,
      transport: credential?.transport,
    }
    ;(req as any).client = client
    next()
  } catch (err) {
    next(err)
  }
}

/**
 * Helper to retrieve the authenticated merchant from the request.
 * Use after `requireMerchant` middleware.
 */
export function getMerchant(req: Request) {
  return (req as any).client
}
