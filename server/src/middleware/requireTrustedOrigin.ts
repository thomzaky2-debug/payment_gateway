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

function isOriginAllowed(origin: string, allowedOrigins: ReadonlySet<string>): boolean {
  if (allowedOrigins.has(origin)) return true

  const isLocal = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
  if (isLocal) {
    try {
      const url = new URL(origin)
      const hostname = url.hostname
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '::1' ||
        /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
        /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
        /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)
      ) {
        return true
      }
    } catch {
      return false
    }
  }

  return false
}

/**
 * Cookie-authenticated state changes must come from a configured first-party
 * origin. Bearer clients (API consumers and native apps) are unaffected.
 */
export function requireTrustedOrigin(allowedOrigins: ReadonlySet<string>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (SAFE_METHODS.has(req.method.toUpperCase())) return next()
    if (req.headers.authorization) return next()

    // Logout endpoints only revoke credentials and clear session cookies; never block logout
    if (req.path.endsWith('/logout')) return next()

    const hasSessionCookie = Boolean(
      req.cookies?.[MERCHANT_SESSION_COOKIE_NAME] || req.cookies?.[OWNER_SESSION_COOKIE_NAME]
    )
    if (!hasSessionCookie) return next()

    const requestOrigin = req.get('origin') || originFromReferer(req.get('referer'))
    if (!requestOrigin || !isOriginAllowed(requestOrigin, allowedOrigins)) {
      return res.status(403).json({ ok: false, error: 'Untrusted request origin' })
    }

    next()
  }
}
