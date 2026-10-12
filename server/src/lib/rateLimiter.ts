import { createHash } from 'crypto'
import type { Request, Response, NextFunction } from 'express'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

interface RateLimitRecord {
  count: number
  resetAt: number
}

type RateLimitKeyGenerator = (req: Request) => string

const localHits = new Map<string, RateLimitRecord>()
const hostedLimiters = new Map<string, Ratelimit>()
let redis: Redis | undefined

setInterval(() => {
  const now = Date.now()
  for (const [key, record] of localHits.entries()) {
    if (now > record.resetAt) localHits.delete(key)
  }
}, 5 * 60 * 1000).unref()

function isLocalRuntime() {
  return process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
}

function isLocalhost(ip: string) {
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === 'localhost'
}

function hashIdentifier(key: string) {
  // Avoid storing raw IP addresses or email addresses in Redis keys.
  return createHash('sha256').update(key.slice(0, 512)).digest('hex')
}

function incrementLocalBucket(key: string, windowMs: number, now: number): { count: number; resetAt: number } {
  const windowStart = Math.floor(now / windowMs) * windowMs
  const bucket = `${windowMs}:${windowStart}:${hashIdentifier(key)}`
  const resetAt = windowStart + windowMs
  const record = localHits.get(bucket)
  if (!record) {
    localHits.set(bucket, { count: 1, resetAt })
    return { count: 1, resetAt }
  }
  record.count += 1
  return record
}

function getHostedLimiter(windowMs: number, max: number): Ratelimit {
  const name = `${windowMs}:${max}`
  const cached = hostedLimiters.get(name)
  if (cached) return cached

  redis ??= Redis.fromEnv()
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(max, `${windowMs} ms`),
    prefix: 'instapay-gateway:rate-limit',
    analytics: false,
  })
  hostedLimiters.set(name, limiter)
  return limiter
}

/**
 * Creates a rate limiter. Hosted deployments use Upstash Redis so every API
 * instance shares the same counters; local development and tests use memory.
 */
export function createRateLimiter(windowMs: number, max: number, message = 'Too many requests, please try again later.') {
  return createRateLimiterWithKey(windowMs, max, message)
}

export function createRateLimiterWithKey(
  windowMs: number,
  max: number,
  message = 'Too many requests, please try again later.',
  keyGenerator: RateLimitKeyGenerator = (req) => req.ip || req.socket.remoteAddress || 'unknown'
) {
  return (req: Request, res: Response, next: NextFunction) => {
    void (async () => {
      const ip = req.ip || req.socket.remoteAddress || 'unknown'
      const key = keyGenerator(req).slice(0, 512)
      const now = Date.now()
      const localBypass = isLocalRuntime() && isLocalhost(ip)
      const effectiveMax = process.env.NODE_ENV === 'development' && localBypass ? Math.max(max * 20, 500) : max

      if (isLocalRuntime()) {
        const result = incrementLocalBucket(key, windowMs, now)
        if (result.count <= effectiveMax) return next()
        const retryAfter = Math.max(1, Math.ceil((result.resetAt - now) / 1000))
        res.setHeader('Retry-After', retryAfter)
        return res.status(429).json({ ok: false, error: message, retryAfterSeconds: retryAfter })
      }

      const result = await getHostedLimiter(windowMs, max).limit(hashIdentifier(key))
      void result.pending.catch((err) => console.warn('[rate-limit] Upstash background task failed:', err))
      if (result.success) return next()

      const retryAfter = Math.max(1, Math.ceil((result.reset - now) / 1000))
      res.setHeader('Retry-After', retryAfter)
      return res.status(429).json({ ok: false, error: message, retryAfterSeconds: retryAfter })
    })().catch((err) => {
      // Production must not silently bypass limits when Upstash is unavailable.
      console.error('[rate-limit] Upstash Redis is unavailable:', err)
      res.status(503).json({ ok: false, error: 'Request protection is temporarily unavailable. Please try again shortly.' })
    })
  }
}
