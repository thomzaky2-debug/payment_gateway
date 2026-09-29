import dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import http from 'http'
import cors from 'cors'
import cookieParser from 'cookie-parser'

import { initSocketIO } from './services/notificationService.js'
import { startWebhookRetryWorker, stopWebhookRetryWorker } from './workers/webhookRetryWorker.js'

import { authRouter } from './routes/authRoutes.js'
import { webhookRouter } from './routes/webhookRoutes.js'
import { v1CheckoutRouter } from './routes/v1CheckoutRoutes.js'
import { checkoutRouter } from './routes/checkoutRoutes.js'
import { transactionRouter } from './routes/transactionRoutes.js'
import { adminRouter } from './routes/adminRoutes.js'
import { settingsRouter } from './routes/settingsRoutes.js'
import { planRouter } from './routes/planRoutes.js'
import { notificationRouter } from './routes/notificationRoutes.js'
import { apkRouter } from './routes/apkRoutes.js'

import { createRateLimiter } from './lib/rateLimiter.js'

const app = express()
const server = http.createServer(app)

const PORT = Number(process.env.PORT) || 3001
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173'

const allowedOrigins = [
  CLIENT_URL,
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
]

// ─── Middlewares ───────────────────────────────────────────────────

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, native tools)
      if (!origin) return callback(null, true)
      if (
        allowedOrigins.includes(origin) ||
        process.env.NODE_ENV !== 'production' ||
        (process.env.ALLOWED_ORIGINS && process.env.ALLOWED_ORIGINS.split(',').includes(origin))
      ) {
        return callback(null, true)
      }
      callback(new Error('Blocked by CORS policy'))
    },
    credentials: true,
  })
)

app.use(express.json())
app.use(cookieParser())

// Rate limiters for sensitive endpoints
const authLimiter = createRateLimiter(15 * 60 * 1000, 30, 'Too many login attempts. Please try again in 15 minutes.')
const webhookLimiter = createRateLimiter(60 * 1000, 120, 'Webhook rate limit exceeded.')

// Request Logger
app.use((req, _res, next) => {
  if (!req.url.startsWith('/api/health')) {
    console.log(`[HTTP] ${req.method} ${req.url}`)
  }
  next()
})

// ─── Initialize Real-time Socket.IO ────────────────────────────────
initSocketIO(server)

// ─── Initialize Background Webhook Retry Worker ────────────────────
startWebhookRetryWorker(30000) // Poll every 30 seconds

// ─── API Routes ────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'InstaPay Gateway Backend',
    version: '2.0.0',
  })
})

app.use('/api/auth', authLimiter, authRouter)
app.use('/api/webhooks', webhookLimiter, webhookRouter)
app.use('/api/v1/checkout', v1CheckoutRouter)
app.use('/api/checkout', checkoutRouter)
app.use('/api/transactions', transactionRouter)
app.use('/api/admin', adminRouter)
app.use('/api/settings', settingsRouter)
app.use('/api/plans', planRouter)
app.use('/api/subscription', planRouter)
app.use('/api/notifications', notificationRouter)
app.use('/api/apks', apkRouter)

// ─── Global Error Handler ──────────────────────────────────────────

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Global Error Handler]', err)
  res.status(err.status || 500).json({
    ok: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message || 'Internal server error',
  })
})

// ─── Graceful Shutdown ─────────────────────────────────────────────

process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down gracefully...')
  stopWebhookRetryWorker()
  server.close(() => {
    console.log('[Server] Closed HTTP & Socket.IO server')
    process.exit(0)
  })
})

process.on('SIGTERM', () => {
  stopWebhookRetryWorker()
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
  console.log(`⚡ Automated Webhook Retry Worker: ACTIVE`)
  console.log(`======================================================\n`)
})
