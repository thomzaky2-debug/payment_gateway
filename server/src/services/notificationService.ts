import { Server as SocketIOServer } from 'socket.io'
import type { Server as HTTPServer } from 'http'
import { db } from '../db.js'
import {
  MERCHANT_SESSION_COOKIE_NAME,
  isApprovedActiveMerchant,
  verifySessionToken,
} from './authService.js'

let ioInstance: SocketIOServer | null = null

function cookieValue(rawCookie: string | undefined, name: string): string | null {
  if (!rawCookie) return null
  for (const part of rawCookie.split(';')) {
    const separator = part.indexOf('=')
    if (separator < 0) continue
    const key = part.slice(0, separator).trim()
    if (key !== name) continue
    try {
      return decodeURIComponent(part.slice(separator + 1).trim())
    } catch {
      return null
    }
  }
  return null
}

function bearerValue(header: string | string[] | undefined): string | null {
  if (typeof header !== 'string') return null
  const match = header.match(/^Bearer\s+([^\s]+)$/i)
  return match?.[1] || null
}

export function initSocketIO(server: HTTPServer, allowedOrigins: string[]): SocketIOServer {
  const allowedOriginSet = new Set(allowedOrigins)
  ioInstance = new SocketIOServer(server, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // Socket.IO CORS only covers the polling transport; enforce the same origin
    // list on the WebSocket upgrade. Native apps send no Origin and stay allowed.
    allowRequest: (req, callback) => {
      const origin = req.headers.origin
      callback(null, !origin || allowedOriginSet.has(origin))
    },
  })

  ioInstance.on('connection', async (socket) => {
    const handshakeToken =
      (typeof socket.handshake.auth?.token === 'string' ? socket.handshake.auth.token : null) ||
      bearerValue(socket.handshake.headers.authorization) ||
      cookieValue(socket.handshake.headers.cookie, MERCHANT_SESSION_COOKIE_NAME)

    let merchantId: string | null = null
    if (handshakeToken) {
      const clientId = await verifySessionToken(handshakeToken).catch(() => null)
      if (clientId) {
        const client = await db.client.findUnique({
          where: { id: clientId },
          select: { id: true, approvalStatus: true, isActive: true },
        }).catch(() => null)
        if (client && isApprovedActiveMerchant(client)) {
          merchantId = client.id
          socket.join(`merchant:${client.id}`)
        }
      }
    }

    const checkoutRooms = new Set<string>()
    // Each join costs a database lookup; an anonymous socket gets a small budget.
    let joinAttempts = 0

    // Join room for a specific checkout session
    socket.on('checkout:join', async (sessionId: string) => {
      if (typeof sessionId !== 'string' || sessionId.length > 128 || checkoutRooms.size >= 5) return
      if (++joinAttempts > 20) return
      const room = `checkout:${sessionId}`
      if (checkoutRooms.has(room)) return
      const checkout = await db.transaction.findUnique({
        where: { sessionId },
        select: { sessionId: true },
      }).catch(() => null)
      if (!checkout) return
      checkoutRooms.add(room)
      await socket.join(room)
    })

    // The server derives the tenant from the authenticated session. A caller
    // can never select another merchant's room.
    socket.on('merchant:join', () => {
      if (merchantId) socket.join(`merchant:${merchantId}`)
    })

    socket.on('disconnect', () => {
      // Disconnected
    })
  })

  return ioInstance
}

export function getSocketIO(): SocketIOServer | null {
  return ioInstance
}

export interface CheckoutUpdatePayload {
  sessionId: string
  status: 'CONFIRMED' | 'EXPIRED' | 'UNDERPAID' | 'OVERPAID' | string
  amountEgp?: number
  detectedAmountEgp?: number | null
  senderHandle?: string
  detectedRef?: string | null
  detectedAt?: string | null
}

/**
 * Emits real-time payment confirmation/update to the customer's hosted checkout screen
 * and to the merchant's live dashboard.
 */
export function emitCheckoutUpdate(payload: CheckoutUpdatePayload) {
  if (!ioInstance) {
    console.warn('[Socket.IO] Cannot emit checkout update: Socket.IO not initialized')
    return
  }

  const room = `checkout:${payload.sessionId}`
  ioInstance.to(room).emit('checkout:update', payload)
  console.log(`[Socket.IO] Emitted checkout update to ${room}: ${payload.status}`)

}

/**
 * Emits a real-time notification to a specific merchant
 */
export function emitMerchantNotification(clientId: string, notification: {
  id: string
  title: string
  message: string
  severity: string
  createdAt: string
}) {
  if (!ioInstance) return
  ioInstance.to(`merchant:${clientId}`).emit('notification:new', notification)
}
