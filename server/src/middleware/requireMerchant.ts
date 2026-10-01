import { Request, Response, NextFunction } from 'express'
import { db } from '../db.js'
import { verifySessionToken } from '../services/authService.js'

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
  const token =
    req.headers.authorization?.replace(/^Bearer\s+/i, '') ||
    req.cookies?.['instapay_merchant_session']

  const clientId = verifySessionToken(token)
  if (!clientId) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' })
  }

  const client = await db.client.findUnique({ where: { id: clientId } })
  if (!client) {
    return res.status(401).json({ ok: false, error: 'Merchant not found' })
  }

  if (client.subscriptionPlan === 'FREE_TRIAL' || client.isFreeTrial) {
    const trialPlan = await (db.plan as any).findUnique({ where: { name: 'FREE_TRIAL' } })
    if (trialPlan && trialPlan.maxTransactions && client.txLimit !== trialPlan.maxTransactions) {
      client.txLimit = trialPlan.maxTransactions
      db.client.update({ where: { id: client.id }, data: { txLimit: trialPlan.maxTransactions } }).catch(() => {})
    }
  }

  ;(req as any).client = client
  next()
}

/**
 * Helper to retrieve the authenticated merchant from the request.
 * Use after `requireMerchant` middleware.
 */
export function getMerchant(req: Request) {
  return (req as any).client
}
