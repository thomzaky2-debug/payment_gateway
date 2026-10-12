import type { NextFunction, Request, Response } from 'express'

function originFromReferer(referer: string | undefined): string | null {
  if (!referer) return null
  try {
    return new URL(referer).origin
  } catch {
    return null
  }
}

/**
 * Keep a browser owner session usable only from the dedicated admin site.
 *
 * This is deliberately stricter than the general CSRF middleware: it applies
 * to reads too, because an owner cookie must never make administrative data
 * available to the merchant web application. Native admin clients authenticate
 * with an Authorization bearer token and therefore do not send an Origin.
 */
export function requireAdminOrigin(adminUrl: string) {
  const adminOrigin = new URL(adminUrl).origin

  return (req: Request, res: Response, next: NextFunction) => {
    // Android and other native clients use a bearer token. Authentication and
    // authorization are still enforced by the route-level requireAdmin guard.
    if (req.headers.authorization) return next()

    const requestOrigin = req.get('origin') || originFromReferer(req.get('referer'))
    if (requestOrigin === adminOrigin) return next()

    // A native client has no browser Origin on its first login. The login
    // endpoint accepts JSON only, so a cross-site HTML form cannot use this
    // exception to create a browser owner session.
    if (!requestOrigin && req.path === '/auth') return next()

    return res.status(403).json({ ok: false, error: 'Admin requests must originate from the configured admin portal.' })
  }
}
