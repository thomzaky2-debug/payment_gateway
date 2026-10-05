import { Request, Response, NextFunction } from 'express'
import { OWNER_SESSION_COOKIE_NAME, verifyOwnerSessionToken } from '../services/authService.js'
import { getRequestAuthToken } from './authToken.js'

/**
 * Shared middleware — Authenticate Superadmin session.
 * Extracted from adminRoutes.ts for reuse.
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const credential = getRequestAuthToken(req, OWNER_SESSION_COOKIE_NAME)
    if (!(await verifyOwnerSessionToken(credential?.token))) {
      return res.status(401).json({ ok: false, error: 'Unauthorized admin access' })
    }
    ;(req as any).auth = {
      role: 'owner',
      subjectId: 'owner',
      transport: credential?.transport,
    }
    next()
  } catch (err) {
    next(err)
  }
}
