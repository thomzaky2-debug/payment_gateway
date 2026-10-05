import type { Request } from 'express'

export type AuthTransport = 'bearer' | 'cookie'

export interface RequestAuthToken {
  token: string
  transport: AuthTransport
}

/**
 * Reads an Authorization bearer token first, then falls back to an HttpOnly
 * session cookie. Malformed authorization headers are never treated as tokens.
 */
export function getRequestAuthToken(req: Request, cookieName: string): RequestAuthToken | null {
  const authorization = req.headers.authorization
  if (authorization) {
    const match = authorization.match(/^Bearer\s+([^\s]+)$/i)
    if (!match || match[1].length > 4096) return null
    return { token: match[1], transport: 'bearer' }
  }

  const cookieToken = req.cookies?.[cookieName]
  if (typeof cookieToken !== 'string' || !cookieToken || cookieToken.length > 4096) return null
  return { token: cookieToken, transport: 'cookie' }
}

export function getRequestIp(req: Request): string | null {
  return req.ip || req.socket.remoteAddress || null
}
