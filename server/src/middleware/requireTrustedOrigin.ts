import type { NextFunction, Request, Response } from 'express'
import {
  MERCHANT_SESSION_COOKIE_NAME,
  OWNER_SESSION_COOKIE_NAME,
} from '../services/authService.js'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

function originFromReferer(referer: string | undefined): string | null {
  if (!referer) return null
  try {
    return new URL(referer).origin
  } catch {
    return null
  }
}

/**
 * Cookie-authenticated state changes must come from a configured first-party
 * origin. Bearer clients (API consumers and native apps) are unaffected.
 */
export function requireTrustedOrigin(allowedOrigins: ReadonlySet<string>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (SAFE_METHODS.has(req.method.toUpperCase())) return next()
    if (req.headers.authorization) return next()

    const hasSessionCookie = Boolean(
      req.cookies?.[MERCHANT_SESSION_COOKIE_NAME] || req.cookies?.[OWNER_SESSION_COOKIE_NAME]
    )
    if (!hasSessionCookie) return next()

    const requestOrigin = req.get('origin') || originFromReferer(req.get('referer'))
    if (!requestOrigin || !allowedOrigins.has(requestOrigin)) {
      return res.status(403).json({ ok: false, error: 'Untrusted request origin' })
    }

    next()
  }
}
