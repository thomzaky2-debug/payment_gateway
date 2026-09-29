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

const app = express()
const server = http.createServer(app)

const PORT = Number(process.env.PORT) || 3001
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173'

// ─── Middlewares ───────────────────────────────────────────────────

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, postman) or matching dev client
      callback(null, true)
    },
    credentials: true,
  })
)

app.use(express.json())
app.use(cookieParser())

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

app.use('/api/auth', authRouter)
app.use('/api/webhooks', webhookRouter)
app.use('/api/v1/checkout', v1CheckoutRouter)
app.use('/api/checkout', checkoutRouter)
app.use('/api/transactions', transactionRouter)
app.use('/api/admin', adminRouter)
app.use('/api/settings', settingsRouter)

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
