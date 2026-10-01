import { Request, Response, NextFunction } from 'express'
import { verifyOwnerSessionToken } from '../services/authService.js'

/**
 * Shared middleware — Authenticate Superadmin session.
 * Extracted from adminRoutes.ts for reuse.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token =
    req.headers.authorization?.replace(/^Bearer\s+/i, '') ||
    req.cookies?.['instapay_owner_session']

  if (!verifyOwnerSessionToken(token)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized admin access' })
  }
  next()
}
