import { Server as SocketIOServer } from 'socket.io'
import type { Server as HTTPServer } from 'http'

let ioInstance: SocketIOServer | null = null

export function initSocketIO(server: HTTPServer): SocketIOServer {
  ioInstance = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  })

  ioInstance.on('connection', (socket) => {
    // Join room for a specific checkout session
    socket.on('checkout:join', (sessionId: string) => {
      if (sessionId && typeof sessionId === 'string') {
        const room = `checkout:${sessionId}`
        socket.join(room)
        console.log(`[Socket.IO] Client joined checkout room: ${room}`)
      }
    })

    // Join room for a specific merchant dashboard
    socket.on('merchant:join', (clientId: string) => {
      if (clientId && typeof clientId === 'string') {
        const room = `merchant:${clientId}`
        socket.join(room)
        console.log(`[Socket.IO] Client joined merchant room: ${room}`)
      }
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

  // Also broadcast to general dashboard
  ioInstance.emit('payment:event', payload)
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
