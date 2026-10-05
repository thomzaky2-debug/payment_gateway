import crypto from 'crypto'
import { db } from '../db.js'
import type { Client } from '@prisma/client'

export const MERCHANT_SESSION_COOKIE_NAME = 'instapay_merchant_session'
export const OWNER_SESSION_COOKIE_NAME = 'instapay_owner_session'
export const MERCHANT_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
export const OWNER_SESSION_TTL_MS = 12 * 60 * 60 * 1000

const MERCHANT_SESSION_PREFIX = 'ims_'
const OWNER_SESSION_PREFIX = 'ios_'
const MAX_ACTIVE_SESSIONS = 10

function acceptsLegacySessions(): boolean {
  return process.env.NODE_ENV === 'development' && process.env.AUTH_ACCEPT_LEGACY_SESSIONS === 'true'
}

export interface SessionMetadata {
  userAgent?: string | null
  ipAddress?: string | null
}

export function getOwnerSecret(): string {
  const secret = process.env.OWNER_SECRET
  if (!secret || secret.length < 32 || secret.startsWith('dev-insecure-')) {
    throw new Error('OWNER_SECRET must be configured with at least 32 random characters')
  }
  return secret
}

export function getTokenPepper(): string {
  const pepper = process.env.TOKEN_PEPPER
  if (!pepper || pepper.length < 32 || pepper.startsWith('dev-insecure-')) {
    throw new Error('TOKEN_PEPPER must be configured with at least 32 random characters')
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
  if (typeof password !== 'string' || Buffer.byteLength(password, 'utf8') > 1024) {
    throw new Error('Password is invalid or too long')
  }
  const salt = crypto.randomBytes(16).toString('hex')
  const derivedKey = crypto.scryptSync(password, salt, 64)
  return `${salt}.${derivedKey.toString('hex')}`
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const dummyHash =
    'd7d8e8b0a9c8d7e6f5a4b3c2d1e0f9a8b7.c5d753f0c97333b3b3e882c657419c1606d7689933532099665293a3965e6a2d9eca1f012b2a2c186f5441450215d2f37680a8e4fbeaf08e41880b9702d3'
  const hasFormat = storedHash && storedHash.includes('.')
  const targetHash = hasFormat ? storedHash : dummyHash
  const safePassword = typeof password === 'string' && Buffer.byteLength(password, 'utf8') <= 1024 ? password : ''

  const [salt, hash] = targetHash.split('.')
  const derivedKey = crypto.scryptSync(safePassword, salt, 64)
  const isMatch = timingSafeCompare(derivedKey.toString('hex'), hash)

  if (!hasFormat || safePassword !== password) return false
  return isMatch
}

export function validatePasswordPolicy(password: unknown): string | null {
  if (typeof password !== 'string') return 'Password is required'
  const bytes = Buffer.byteLength(password, 'utf8')
  if (bytes < 12) return 'Password must be at least 12 characters'
  if (bytes > 128) return 'Password must be at most 128 bytes'
  return null
}

export function isApprovedActiveMerchant(client: Pick<Client, 'approvalStatus' | 'isActive'>): boolean {
  return client.approvalStatus === 'APPROVED' && client.isActive === true
}

// ─── Session Management ─────────────────────────────────────────────

interface LegacyClientSessionPayload {
  clientId: string
  expiresAt: number
}

interface LegacyOwnerSessionPayload {
  subject: 'owner'
  scope: 'admin'
  issuedAt: number
  expiresAt: number
}

function createOpaqueSessionToken(kind: 'MERCHANT' | 'OWNER'): string {
  const prefix = kind === 'MERCHANT' ? MERCHANT_SESSION_PREFIX : OWNER_SESSION_PREFIX
  return `${prefix}${crypto.randomBytes(32).toString('base64url')}`
}

function cleanSessionMetadata(metadata?: SessionMetadata) {
  return {
    userAgent: metadata?.userAgent?.trim().slice(0, 512) || null,
    ipAddress: metadata?.ipAddress?.trim().slice(0, 128) || null,
  }
}

async function enforceSessionLimit(kind: 'MERCHANT' | 'OWNER', clientId: string | null) {
  const sessions = await db.authSession.findMany({
    where: {
      kind,
      clientId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
    skip: MAX_ACTIVE_SESSIONS,
  })

  if (sessions.length > 0) {
    await db.authSession.updateMany({
      where: { id: { in: sessions.map((session) => session.id) }, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }
}

/**
 * Creates a random, revocable merchant session. Only the peppered token hash is
 * persisted, so a database read cannot be used to impersonate an active user.
 */
export async function createSessionToken(clientId: string, metadata?: SessionMetadata): Promise<string> {
  const token = createOpaqueSessionToken('MERCHANT')
  const now = new Date()
  const cleanMetadata = cleanSessionMetadata(metadata)

  await db.authSession.create({
    data: {
      tokenHash: hashToken(token),
      kind: 'MERCHANT',
      clientId,
      ...cleanMetadata,
      expiresAt: new Date(now.getTime() + MERCHANT_SESSION_TTL_MS),
    },
  })
  await enforceSessionLimit('MERCHANT', clientId)
  return token
}

function verifyLegacyClientSessionToken(token: string): string | null {
  const secret = getOwnerSecret()
  if (!token || !token.includes('.')) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [base64Payload, signature] = parts

  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(base64Payload)
      .digest('hex')

    if (!timingSafeCompare(signature, expectedSignature)) return null

    const payloadStr = Buffer.from(base64Payload, 'base64url').toString('utf8')
    const payload = JSON.parse(payloadStr) as LegacyClientSessionPayload

    if (!payload.clientId || typeof payload.clientId !== 'string') return null
    if (!Number.isFinite(payload.expiresAt) || Date.now() > payload.expiresAt) return null
    return payload.clientId
  } catch {
    return null
  }
}

export async function verifySessionToken(token: string | null | undefined): Promise<string | null> {
  if (!token || token.length > 4096) return null

  // Transitional verification keeps already-issued signed sessions valid until
  // their original expiry only when explicitly enabled in local development.
  if (!token.startsWith(MERCHANT_SESSION_PREFIX)) {
    return acceptsLegacySessions() ? verifyLegacyClientSessionToken(token) : null
  }

  const session = await db.authSession.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      kind: true,
      clientId: true,
      expiresAt: true,
      revokedAt: true,
      lastSeenAt: true,
    },
  })

  if (
    !session ||
    session.kind !== 'MERCHANT' ||
    !session.clientId ||
    session.revokedAt ||
    session.expiresAt.getTime() <= Date.now()
  ) {
    return null
  }

  if (Date.now() - session.lastSeenAt.getTime() > 5 * 60 * 1000) {
    void db.authSession.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { lastSeenAt: new Date() },
    })
  }

  return session.clientId
}

export async function createOwnerSessionToken(metadata?: SessionMetadata): Promise<string> {
  const token = createOpaqueSessionToken('OWNER')
  const now = new Date()
  const cleanMetadata = cleanSessionMetadata(metadata)
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) throw new Error('ADMIN_PASSWORD is not configured')

  await db.authSession.create({
    data: {
      tokenHash: hashToken(token),
      kind: 'OWNER',
      clientId: null,
      credentialFingerprint: ownerCredentialFingerprint(adminPassword),
      ...cleanMetadata,
      expiresAt: new Date(now.getTime() + OWNER_SESSION_TTL_MS),
    },
  })
  await enforceSessionLimit('OWNER', null)
  return token
}

function ownerCredentialFingerprint(adminPassword: string): string {
  return hashToken(`owner-credential:${adminPassword}:${process.env.ADMIN_TOTP_SECRET || ''}`)
}

function verifyLegacyOwnerSessionToken(token: string): boolean {
  if (!token || !token.includes('.')) return false
  const parts = token.split('.')
  if (parts.length !== 2) return false
  const secret = getOwnerSecret()
  const [base64Payload, signature] = parts

  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(base64Payload)
      .digest('hex')

    if (!timingSafeCompare(signature, expectedSignature)) return false

    const payloadStr = Buffer.from(base64Payload, 'base64url').toString('utf8')
    const payload = JSON.parse(payloadStr) as LegacyOwnerSessionPayload

    if (payload.subject !== 'owner' || payload.scope !== 'admin') return false
    if (!Number.isFinite(payload.expiresAt) || Date.now() > payload.expiresAt) return false
    return true
  } catch {
    return false
  }
}

export async function verifyOwnerSessionToken(token: string | null | undefined): Promise<boolean> {
  if (!token || token.length > 4096) return false
  if (!token.startsWith(OWNER_SESSION_PREFIX)) {
    return acceptsLegacySessions() ? verifyLegacyOwnerSessionToken(token) : false
  }

  const session = await db.authSession.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      kind: true,
      expiresAt: true,
      revokedAt: true,
      lastSeenAt: true,
      credentialFingerprint: true,
    },
  })

  if (
    !session ||
    session.kind !== 'OWNER' ||
    session.revokedAt ||
    session.expiresAt.getTime() <= Date.now() ||
    !process.env.ADMIN_PASSWORD ||
    !timingSafeCompare(
      session.credentialFingerprint || '',
      ownerCredentialFingerprint(process.env.ADMIN_PASSWORD)
    )
  ) {
    return false
  }

  if (Date.now() - session.lastSeenAt.getTime() > 5 * 60 * 1000) {
    void db.authSession.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { lastSeenAt: new Date() },
    })
  }

  return true
}

export async function revokeSessionToken(
  token: string | null | undefined,
  expectedKind?: 'MERCHANT' | 'OWNER'
): Promise<boolean> {
  if (!token || token.length > 4096) return false
  const result = await db.authSession.updateMany({
    where: {
      tokenHash: hashToken(token),
      revokedAt: null,
      ...(expectedKind ? { kind: expectedKind } : {}),
    },
    data: { revokedAt: new Date() },
  })
  return result.count > 0
}

export async function revokeAllMerchantSessions(clientId: string): Promise<number> {
  const result = await db.authSession.updateMany({
    where: { clientId, kind: 'MERCHANT', revokedAt: null },
    data: { revokedAt: new Date() },
  })
  return result.count
}

export async function cleanupExpiredAuthSessions(): Promise<number> {
  const retentionCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const result = await db.authSession.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: retentionCutoff } },
        { revokedAt: { lt: retentionCutoff } },
      ],
    },
  })
  return result.count
}

// ─── Token Authentication Lookups ───────────────────────────────────

export async function authenticateByApiKey(rawKey: string): Promise<Client | null> {
  const cleanKey = (rawKey || '').replace(/^Bearer\s+/i, '').trim()
  if (!cleanKey) return null

  const keyHash = hashToken(cleanKey)
  // Try hashed lookup first
  let client = await db.client.findFirst({
    where: { apiKeyHash: keyHash, isActive: true, approvalStatus: 'APPROVED' },
  })

  // Fallback to legacy plaintext lookup if not yet migrated
  if (!client) {
    client = await db.client.findFirst({
      where: { apiKey: cleanKey, isActive: true, approvalStatus: 'APPROVED' },
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
    }).catch(() => {})
  }

  return client
}

export async function authenticateByDetectToken(rawToken: string): Promise<Client | null> {
  const cleanToken = (rawToken || '').replace(/^Bearer\s+/i, '').trim()
  if (!cleanToken) return null

  const tokenHash = hashToken(cleanToken)
  let client = await db.client.findFirst({
    where: { detectTokenHash: tokenHash, isActive: true, approvalStatus: 'APPROVED' },
  })

  if (!client) {
    client = await db.client.findFirst({
      where: { detectToken: cleanToken, isActive: true, approvalStatus: 'APPROVED' },
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
    }).catch(() => {})
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

/**
 * Ensures that an approved merchant has all necessary integration credentials:
 * 1. apiKey & apiKeyHash (e.g. egp_live_...)
 * 2. detectToken & detectTokenHash (e.g. det_...)
 * 3. webhookSecret & webhookSecretHash (e.g. whsec_...)
 *
 * If any of these tokens or their indexed hashes are missing, generates and persists them to the database.
 */
export async function ensureMerchantIntegrationTokens(client: any): Promise<any> {
  if (!client || client.approvalStatus !== 'APPROVED') {
    return client
  }

  const needsApiKey = !client.apiKey || !client.apiKeyHash
  const needsDetectToken = !client.detectToken || !client.detectTokenHash
  const needsWebhookSecret = !client.webhookSecret || !client.webhookSecretHash

  if (!needsApiKey && !needsDetectToken && !needsWebhookSecret) {
    return client
  }

  const generated = generateMerchantKeys()
  const updateData: Record<string, string> = {}

  if (needsApiKey) {
    updateData.apiKey = client.apiKey || generated.apiKey
    updateData.apiKeyHash = client.apiKey ? hashToken(client.apiKey) : generated.apiKeyHash
  }
  if (needsDetectToken) {
    updateData.detectToken = client.detectToken || generated.detectToken
    updateData.detectTokenHash = client.detectToken ? hashToken(client.detectToken) : generated.detectTokenHash
  }
  if (needsWebhookSecret) {
    updateData.webhookSecret = client.webhookSecret || generated.webhookSecret
    updateData.webhookSecretHash = client.webhookSecret ? hashToken(client.webhookSecret) : generated.webhookSecretHash
  }

  const updatedClient = await db.client.update({
    where: { id: client.id },
    data: updateData,
  })

  Object.assign(client, updatedClient)
  return client
}

/**
 * Automatically backfills and synchronizes integration tokens for all approved merchants.
 * Ensures that any approved merchant in the database has a valid API Key, Companion Token,
 * and Webhook Secret (with SHA-256 peppered hashes).
 */
export async function syncApprovedMerchantsTokens(): Promise<number> {
  try {
    const approvedMerchants = await db.client.findMany({
      where: {
        approvalStatus: 'APPROVED',
        OR: [
          { apiKey: null },
          { detectToken: null },
          { webhookSecret: null },
          { apiKeyHash: null },
          { detectTokenHash: null },
          { webhookSecretHash: null },
        ],
      },
    })

    if (approvedMerchants.length === 0) {
      return 0
    }

    console.info(`[authService] Found ${approvedMerchants.length} approved merchant(s) missing integration tokens. Generating...`)

    let updatedCount = 0
    for (const merchant of approvedMerchants) {
      await ensureMerchantIntegrationTokens(merchant)
      updatedCount++
    }

    console.info(`[authService] Successfully generated integration tokens for ${updatedCount} approved merchant(s).`)
    return updatedCount
  } catch (err) {
    console.warn('[authService] Failed to sync approved merchant tokens:', err)
    return 0
  }
}
