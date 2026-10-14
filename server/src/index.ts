import dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import http from 'http'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import fs from 'fs'
import path from 'path'

import { initSocketIO } from './services/notificationService.js'
import { startWebhookRetryWorker, stopWebhookRetryWorker } from './workers/webhookRetryWorker.js'
import { startOtpCleanupWorker, stopOtpCleanupWorker } from './workers/otpCleanupWorker.js'
import { syncApprovedMerchantsTokens, migratePlaintextCredentialsAtRest } from './services/authService.js'
import { safeErrorMessage } from './lib/safeError.js'
import { parseTrustProxy } from './lib/proxyTrust.js'
import { getWebhookDeliveryHealth } from './services/webhookHealth.js'

import { authRouter } from './routes/authRoutes.js'
import { webhookRouter } from './routes/webhookRoutes.js'
import { v1CheckoutRouter } from './routes/v1CheckoutRoutes.js'
import { checkoutRouter } from './routes/checkoutRoutes.js'
import { transactionRouter } from './routes/transactionRoutes.js'
import { adminRouter } from './routes/adminRoutes.js'
import { settingsRouter } from './routes/settingsRoutes.js'
import { planCatalogRouter, planRouter } from './routes/planRoutes.js'
import { bundleRouter } from './routes/bundleRoutes.js'
import { notificationRouter } from './routes/notificationRoutes.js'
import { apkRouter } from './routes/apkRoutes.js'
import { mobileAuthRouter } from './routes/mobileAuthRoutes.js'
import { mobileRouter } from './routes/mobileRoutes.js'
import { accountRouter } from './routes/accountRoutes.js'
import { renderAccountDeletionHtml } from './views/accountDeletionHtml.js'

import { createRateLimiter } from './lib/rateLimiter.js'
import { requireTrustedOrigin } from './middleware/requireTrustedOrigin.js'
import { requireAdminOrigin } from './middleware/requireAdminOrigin.js'
import { validateRuntimeConfig } from './config.js'

validateRuntimeConfig()

const app = express()
const server = http.createServer(app)

const PORT = Number(process.env.PORT) || 3001
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173'
const isLocalRuntime = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
const ADMIN_URL = process.env.ADMIN_URL || CLIENT_URL

function normalizeOrigin(value: string): string {
  try {
    return new URL(value).origin
  } catch {
    return value.trim().replace(/\/+$/, '')
  }
}

const allowedOrigins = [
  normalizeOrigin(CLIENT_URL),
  normalizeOrigin(ADMIN_URL),
  ...(isLocalRuntime
    ? [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5173',
      ]
    : []),
  ...(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map(normalizeOrigin),
]
const allowedOriginSet = new Set(allowedOrigins)

app.set('trust proxy', parseTrustProxy(process.env.TRUST_PROXY, !isLocalRuntime))

// Disable fingerprinting
app.disable('x-powered-by')

// ─── Security Headers ──────────────────────────────────────────────
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  res.setHeader('X-XSS-Protection', '0')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  res.setHeader('Content-Security-Policy', "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'; img-src 'self' data: blob: https:; font-src 'self' data: https:; style-src 'self' 'unsafe-inline' https:; script-src 'self'; connect-src 'self' https: wss:")
  if (!isLocalRuntime) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  }
  next()
})

// ─── Middlewares ───────────────────────────────────────────────────

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, native tools)
      if (!origin) return callback(null, true)
      if (isLocalRuntime || allowedOriginSet.has(origin)) {
        return callback(null, true)
      }
      callback(new Error('Blocked by CORS policy'))
    },
    credentials: true,
  })
)

// Profile photos are sent as validated image data URLs. Keep the body limit
// bounded so regular API endpoints cannot be used for oversized uploads.
app.use(express.json({ limit: '2mb' }))
app.use(cookieParser())
app.use('/api', requireTrustedOrigin(allowedOriginSet))

// Rate limiters for sensitive endpoints
const authLimiter = createRateLimiter(15 * 60 * 1000, 30, 'Too many login attempts. Please try again in 15 minutes.')
const webhookLimiter = createRateLimiter(60 * 1000, 120, 'Webhook rate limit exceeded.')
const generalApiLimiter = createRateLimiter(60 * 1000, 300, 'Too many requests. Please slow down.')

// Request Logger
app.use((req, _res, next) => {
  if (!req.url.startsWith('/api/health')) {
    console.log(`[HTTP] ${req.method} ${req.path}`)
  }
  next()
})

// ─── Initialize Real-time Socket.IO ────────────────────────────────
initSocketIO(server, allowedOrigins)

// ─── Initialize Background Webhook Retry Worker ────────────────────
startWebhookRetryWorker(30000) // Poll every 30 seconds
startOtpCleanupWorker(60 * 60 * 1000) // Cleanup expired OTPs every hour

// ─── Auto-Sync Integration Tokens for Approved Merchants ───────────
syncApprovedMerchantsTokens().catch((err) => console.warn('[Startup] Token sync warning:', err))
migratePlaintextCredentialsAtRest().catch((err) => console.warn('[Startup] Credential migration warning:', err))

// ─── API Routes ────────────────────────────────────────────────────

app.get('/api/health', async (_req, res) => {
  // Liveness must represent only whether this HTTP process can respond. Do
  // not remove a healthy API from rotation because a webhook needs manual
  // review; delivery readiness is available separately below.
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    service: 'InstaPay Gateway Backend',
    version: '2.0.0',
  })
})

app.get('/api/health/ready', async (_req, res) => {
  try {
    const health = await getWebhookDeliveryHealth()
    res.status(health.healthy ? 200 : 503).json({
      status: health.healthy ? 'ready' : 'degraded',
      timestamp: new Date().toISOString(),
      service: 'InstaPay Gateway Backend',
    })
  } catch (err) {
    console.error('[health/ready] Webhook delivery health query failed:', err)
    res.status(503).json({ status: 'degraded', timestamp: new Date().toISOString(), service: 'InstaPay Gateway Backend' })
  }
})

app.get('/api/docs/integration-guide', (req, res) => {
  if (req.query.format === 'html' || req.query.view === 'web') {
    return res.redirect(`${CLIENT_URL}/docs`)
  }
  const guidePath = path.resolve(process.cwd(), 'docs/API_INTEGRATION_GUIDE.md')
  if (fs.existsSync(guidePath)) {
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
    res.setHeader('Content-Disposition', 'inline; filename="API_INTEGRATION_GUIDE.md"')
    return res.sendFile(guidePath)
  }
  return res.status(404).json({ ok: false, error: 'Documentation file not found' })
})

app.get(['/account-deletion', '/deletion-info'], (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.send(renderAccountDeletionHtml())
})

// Mobile authentication: login and refresh have dedicated limiters; logout is never rate-limited
app.use('/api/auth/mobile', mobileAuthRouter)
app.use('/api/mobile', generalApiLimiter, mobileRouter)
app.use('/api/account', accountRouter)

app.use('/api/auth', authLimiter, authRouter)
app.use('/api/webhooks', webhookLimiter, webhookRouter)
app.use('/api/v1/checkout', generalApiLimiter, v1CheckoutRouter)
app.use('/api/checkout', generalApiLimiter, checkoutRouter)
app.use('/api/transactions', generalApiLimiter, transactionRouter)
app.use('/api/admin', requireAdminOrigin(ADMIN_URL), adminRouter)
app.use('/api/settings', generalApiLimiter, settingsRouter)
app.use('/api/plans', generalApiLimiter, planCatalogRouter)
app.use('/api/subscription', generalApiLimiter, planRouter)
app.use('/api/bundles', generalApiLimiter, bundleRouter)
app.use('/api/notifications', generalApiLimiter, notificationRouter)
app.use('/api/apks', generalApiLimiter, apkRouter)

// ─── Global Error Handler ──────────────────────────────────────────

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Global Error Handler]', err)
  res.status(err.status || 500).json({
    ok: false,
    error: safeErrorMessage(err, 'Internal server error'),
  })
})

// ─── Graceful Shutdown ─────────────────────────────────────────────

process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down gracefully...')
  stopWebhookRetryWorker()
  stopOtpCleanupWorker()
  server.close(() => {
    console.log('[Server] Closed HTTP & Socket.IO server')
    process.exit(0)
  })
})

process.on('SIGTERM', () => {
  stopWebhookRetryWorker()
  stopOtpCleanupWorker()
  server.close(() => {
    process.exit(0)
  })
})

// ─── Start Server ──────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`\n======================================================`)
  console.log(`🚀 InstaPay Payment Gateway Backend Server`)
  console.log(`📡 REST API & Socket.IO listening on port: ${PORT}`)
  console.log(`💻 Connected to Client UI: ${CLIENT_URL}`)
  console.log(`🔐 Admin portal origin: ${normalizeOrigin(ADMIN_URL)}`)
  console.log(`⚡ Automated Webhook Retry Worker: ACTIVE`)
  console.log(`======================================================\n`)
})
