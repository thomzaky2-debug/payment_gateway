import crypto from 'crypto'
import { db } from '../db.js'
import type { Client } from '@prisma/client'

const SESSION_COOKIE_NAME = 'instapay_merchant_session'
const OWNER_COOKIE_NAME = 'instapay_owner_session'

export function getOwnerSecret(): string {
  const secret = process.env.OWNER_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('OWNER_SECRET environment variable is missing!')
    }
    return 'dev-insecure-owner-secret-key-32-chars-long-minimum'
  }
  return secret
}

export function getTokenPepper(): string {
  const pepper = process.env.TOKEN_PEPPER
  if (!pepper) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('TOKEN_PEPPER environment variable is missing!')
    }
    return 'dev-insecure-token-pepper-minimum-32-chars'
  }
  return pepper
}

export function timingSafeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a)
    const bufB = Buffer.from(b)
    if (bufA.length !== bufB.length) return false
    return crypto.timingSafeEqual(bufA, bufB)
  } catch {
    return false
  }
}

// ─── Token Hashing (Peppered SHA-256) ──────────────────────────────

export function hashToken(token: string): string {
  const pepper = getTokenPepper()
  return crypto.createHmac('sha256', pepper).update(token).digest('hex')
}

// ─── Password Hashing (Secure Scrypt) ──────────────────────────────

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const derivedKey = crypto.scryptSync(password, salt, 64)
  return `${salt}.${derivedKey.toString('hex')}`
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const dummyHash =
    'd7d8e8b0a9c8d7e6f5a4b3c2d1e0f9a8b7.c5d753f0c97333b3b3e882c657419c1606d7689933532099665293a3965e6a2d9eca1f012b2a2c186f5441450215d2f37680a8e4fbeaf08e41880b9702d3'
  const hasFormat = storedHash && storedHash.includes('.')
  const targetHash = hasFormat ? storedHash : dummyHash

  const [salt, hash] = targetHash.split('.')
  const derivedKey = crypto.scryptSync(password, salt, 64)
  const isMatch = timingSafeCompare(derivedKey.toString('hex'), hash)

  if (!hasFormat) return false
  return isMatch
}

// ─── Session Management ─────────────────────────────────────────────

interface ClientSessionPayload {
  clientId: string
  expiresAt: number
}

interface OwnerSessionPayload {
  subject: 'owner'
  scope: 'admin'
  issuedAt: number
  expiresAt: number
}

export function createSessionToken(clientId: string): string {
  const secret = getOwnerSecret()
  const payload: ClientSessionPayload = {
    clientId,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  }
  const payloadStr = JSON.stringify(payload)
  const base64Payload = Buffer.from(payloadStr).toString('base64url')

  const signature = crypto
    .createHmac('sha256', secret)
    .update(base64Payload)
    .digest('hex')

  return `${base64Payload}.${signature}`
}

export function verifySessionToken(token: string | null | undefined): string | null {
  if (!token || !token.includes('.')) return null
  const secret = getOwnerSecret()
  const [base64Payload, signature] = token.split('.')

  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(base64Payload)
      .digest('hex')

    if (!timingSafeCompare(signature, expectedSignature)) return null

    const payloadStr = Buffer.from(base64Payload, 'base64url').toString('utf8')
    const payload = JSON.parse(payloadStr) as ClientSessionPayload

    if (Date.now() > payload.expiresAt) return null
    return payload.clientId
  } catch {
    return null
  }
}

export function createOwnerSessionToken(): string {
  const secret = getOwnerSecret()
  const payload: OwnerSessionPayload = {
    subject: 'owner',
    scope: 'admin',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 12 * 60 * 60 * 1000, // 12 hours
  }
  const payloadStr = JSON.stringify(payload)
  const base64Payload = Buffer.from(payloadStr).toString('base64url')

  const signature = crypto
    .createHmac('sha256', secret)
    .update(base64Payload)
    .digest('hex')

  return `${base64Payload}.${signature}`
}

export function verifyOwnerSessionToken(token: string | null | undefined): boolean {
  if (!token || !token.includes('.')) return false
  const secret = getOwnerSecret()
  const [base64Payload, signature] = token.split('.')

  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(base64Payload)
      .digest('hex')

    if (!timingSafeCompare(signature, expectedSignature)) return false

    const payloadStr = Buffer.from(base64Payload, 'base64url').toString('utf8')
    const payload = JSON.parse(payloadStr) as OwnerSessionPayload

    if (payload.subject !== 'owner' || payload.scope !== 'admin') return false
    if (Date.now() > payload.expiresAt) return false
    return true
  } catch {
    return false
  }
}

// ─── Token Authentication Lookups ───────────────────────────────────

export async function authenticateByApiKey(rawKey: string): Promise<Client | null> {
  const cleanKey = (rawKey || '').replace(/^Bearer\s+/i, '').trim()
  if (!cleanKey) return null

  const keyHash = hashToken(cleanKey)
  // Try hashed lookup first
  let client = await db.client.findFirst({
    where: { apiKeyHash: keyHash, isActive: true },
  })

  // Fallback to legacy plaintext lookup if not yet migrated
  if (!client) {
    client = await db.client.findFirst({
      where: { apiKey: cleanKey, isActive: true },
    })
    if (client && !client.apiKeyHash) {
      await db.client.update({
        where: { id: client.id },
        data: { apiKeyHash: keyHash, apiKeyLastUsedAt: new Date() },
      })
    }
  } else {
    // Record usage asynchronously
    void db.client.update({
      where: { id: client.id },
      data: { apiKeyLastUsedAt: new Date() },
    })
  }

  return client
}

export async function authenticateByDetectToken(rawToken: string): Promise<Client | null> {
  const cleanToken = (rawToken || '').replace(/^Bearer\s+/i, '').trim()
  if (!cleanToken) return null

  const tokenHash = hashToken(cleanToken)
  let client = await db.client.findFirst({
    where: { detectTokenHash: tokenHash, isActive: true },
  })

  if (!client) {
    client = await db.client.findFirst({
      where: { detectToken: cleanToken, isActive: true },
    })
    if (client && !client.detectTokenHash) {
      await db.client.update({
        where: { id: client.id },
        data: { detectTokenHash: tokenHash, detectTokenLastUsedAt: new Date() },
      })
    }
  } else {
    void db.client.update({
      where: { id: client.id },
      data: { detectTokenLastUsedAt: new Date() },
    })
  }

  return client
}

// ─── Keys Generator ────────────────────────────────────────────────

export function generateMerchantKeys(): {
  apiKey: string
  detectToken: string
  webhookSecret: string
  apiKeyHash: string
  detectTokenHash: string
  webhookSecretHash: string
} {
  const apiKey = `egp_live_${crypto.randomBytes(24).toString('hex')}`
  const detectToken = `det_${crypto.randomBytes(24).toString('hex')}`
  const webhookSecret = `whsec_${crypto.randomBytes(24).toString('hex')}`

  return {
    apiKey,
    detectToken,
    webhookSecret,
    apiKeyHash: hashToken(apiKey),
    detectTokenHash: hashToken(detectToken),
    webhookSecretHash: hashToken(webhookSecret),
  }
}
