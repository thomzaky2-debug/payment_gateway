import type { Request, Response, NextFunction } from 'express'

interface RateLimitRecord {
  count: number
  resetAt: number
}

/**
 * Creates an in-memory IP rate limiter middleware.
 * @param windowMs Time window in milliseconds.
 * @param max Max allowed requests within the window.
 * @param message Custom error message.
 */
export function createRateLimiter(windowMs: number, max: number, message = 'Too many requests, please try again later.') {
  const hits = new Map<string, RateLimitRecord>()

  // Cleanup expired windows every 5 minutes
  setInterval(() => {
    const now = Date.now()
    for (const [key, record] of hits.entries()) {
      if (now > record.resetAt) {
        hits.delete(key)
      }
    }
  }, 5 * 60 * 1000).unref()

  return (req: Request, res: Response, next: NextFunction) => {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown'
    const now = Date.now()
    const isLocalhost = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === 'localhost'
    const effectiveMax = process.env.NODE_ENV !== 'production' && isLocalhost ? Math.max(max * 20, 500) : max

    const record = hits.get(ip)

    if (!record || now > record.resetAt) {
      hits.set(ip, { count: 1, resetAt: now + windowMs })
      return next()
    }

    if (record.count >= effectiveMax) {
      const retryAfter = Math.ceil((record.resetAt - now) / 1000)
      res.setHeader('Retry-After', retryAfter)
      return res.status(429).json({
        ok: false,
        error: message,
        retryAfterSeconds: retryAfter,
      })
    }

    record.count += 1
    next()
  }
}
