import { Request, Response, NextFunction } from 'express'
import { db } from '../db.js'
import {
  MERCHANT_SESSION_COOKIE_NAME,
  canMerchantAccessPortal,
  isSessionSteppedUp,
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

    if (!canMerchantAccessPortal(client)) {
      if (client.approvalStatus === 'REJECTED') {
        return res.status(403).json({ ok: false, error: 'Your merchant account was rejected.' })
      }
      return res.status(403).json({ ok: false, error: 'Your merchant account is inactive or suspended.' })
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

/**
 * Whether the merchant session behind this request re-entered its password
 * recently (see POST /api/auth/step-up). Use after `requireMerchant`.
 */
export async function hasMerchantStepUp(req: Request): Promise<boolean> {
  const credential = getRequestAuthToken(req, MERCHANT_SESSION_COOKIE_NAME)
  return isSessionSteppedUp(credential?.token, 'MERCHANT')
}

export function sendMerchantStepUpRequired(res: Response) {
  return res.status(403).json({
    ok: false,
    code: 'STEP_UP_REQUIRED',
    method: 'password',
    error: 'Please re-enter your password to confirm this change.',
  })
}

/** Blocks the route until the merchant has recently re-entered their password. */
export async function requireMerchantStepUp(req: Request, res: Response, next: NextFunction) {
  try {
    if (!(await hasMerchantStepUp(req))) return sendMerchantStepUpRequired(res)
    next()
  } catch (err) {
    next(err)
  }
}
