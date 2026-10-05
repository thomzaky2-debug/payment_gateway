import type { CookieOptions, Response } from 'express'
import {
  MERCHANT_SESSION_COOKIE_NAME,
  MERCHANT_SESSION_TTL_MS,
  OWNER_SESSION_COOKIE_NAME,
  OWNER_SESSION_TTL_MS,
} from '../services/authService.js'

function sessionCookieOptions(maxAge: number): CookieOptions {
  const secureRuntime = process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test'
  return {
    httpOnly: true,
    secure: secureRuntime,
    sameSite: 'strict',
    path: '/',
    maxAge,
  }
}

function clearCookieOptions(): CookieOptions {
  const secureRuntime = process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test'
  return {
    httpOnly: true,
    secure: secureRuntime,
    sameSite: 'strict',
    path: '/',
  }
}

export function setMerchantSessionCookie(res: Response, token: string) {
  res.cookie(MERCHANT_SESSION_COOKIE_NAME, token, sessionCookieOptions(MERCHANT_SESSION_TTL_MS))
}

export function clearMerchantSessionCookie(res: Response) {
  res.clearCookie(MERCHANT_SESSION_COOKIE_NAME, clearCookieOptions())
}

export function setOwnerSessionCookie(res: Response, token: string) {
  res.cookie(OWNER_SESSION_COOKIE_NAME, token, sessionCookieOptions(OWNER_SESSION_TTL_MS))
}

export function clearOwnerSessionCookie(res: Response) {
  res.clearCookie(OWNER_SESSION_COOKIE_NAME, clearCookieOptions())
}
