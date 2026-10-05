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
  return createRateLimiterWithKey(windowMs, max, message)
}

export function createRateLimiterWithKey(
  windowMs: number,
  max: number,
  message = 'Too many requests, please try again later.',
  keyGenerator: (req: Request) => string = (req) => req.ip || req.socket.remoteAddress || 'unknown'
) {
  const hits = new Map<string, RateLimitRecord>()

  setInterval(() => {
    const now = Date.now()
    for (const [key, record] of hits.entries()) {
      if (now > record.resetAt) hits.delete(key)
    }
  }, 5 * 60 * 1000).unref()

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown'
    const key = keyGenerator(req).slice(0, 512)
    const now = Date.now()
    const isLocalhost = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === 'localhost'
    const effectiveMax = process.env.NODE_ENV === 'development' && isLocalhost ? Math.max(max * 20, 500) : max

    const record = hits.get(key)

    if (!record || now > record.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs })
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
