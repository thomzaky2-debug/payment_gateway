import crypto from 'crypto'
import { db } from '../db.js'
import {
  hashToken,
  createOpaqueSessionToken,
  ownerCredentialFingerprint,
} from './authService.js'

export const DETECTOR_ACCESS_TOKEN_TTL_MS = 30 * 60 * 1000 // 30 minutes
export const DETECTOR_REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
export const ADMIN_ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000 // 15 minutes
export const ADMIN_SESSION_MAX_LIFETIME_MS = 12 * 60 * 60 * 1000 // 12 hours hard limit

export interface CreateMobileSessionParams {
  kind: 'MERCHANT' | 'OWNER'
  clientId?: string | null
  deviceId?: string | null
  userAgent?: string | null
  ipAddress?: string | null
}

export interface MobileSessionTokens {
  accessToken: string
  accessExpiresAt: string
  refreshToken: string
  refreshExpiresAt: string
}

export interface RotateMobileSessionParams {
  refreshToken: string
  deviceId?: string | null
  userAgent?: string | null
  ipAddress?: string | null
}

export type RotateResult =
  | { ok: true; tokens: MobileSessionTokens; kind: string; clientId: string | null }
  | { ok: false; error: string; status: number; familyRevoked?: boolean }

/**
 * Creates an initial rotating mobile session family for a Merchant or Admin.
 * Stores tokens only as peppered hashes and never logs raw credentials.
 */
export async function createMobileSession(
  params: CreateMobileSessionParams
): Promise<MobileSessionTokens> {
  const { kind, clientId, deviceId, userAgent, ipAddress } = params
  const now = new Date()

  const accessToken = createOpaqueSessionToken(kind)
  const tokenHash = hashToken(accessToken)

  const refreshPrefix = kind === 'MERCHANT' ? 'rt_mch_' : 'rt_adm_'
  const refreshToken = `${refreshPrefix}${crypto.randomBytes(32).toString('base64url')}`
  const refreshTokenHash = hashToken(refreshToken)

  const familyId = `fam_${crypto.randomBytes(24).toString('hex')}`

  const accessExpiresAt =
    kind === 'MERCHANT'
      ? new Date(now.getTime() + DETECTOR_ACCESS_TOKEN_TTL_MS)
      : new Date(now.getTime() + ADMIN_ACCESS_TOKEN_TTL_MS)

  const refreshExpiresAt =
    kind === 'MERCHANT'
      ? new Date(now.getTime() + DETECTOR_REFRESH_TOKEN_TTL_MS)
      : new Date(now.getTime() + ADMIN_SESSION_MAX_LIFETIME_MS)

  const adminPassword = process.env.ADMIN_PASSWORD
  const credentialFingerprint =
    kind === 'OWNER' && adminPassword
      ? ownerCredentialFingerprint(adminPassword)
      : null

  await db.authSession.create({
    data: {
      tokenHash,
      kind,
      clientId: clientId || null,
      userAgent: userAgent?.trim().slice(0, 512) || null,
      ipAddress: ipAddress?.trim().slice(0, 128) || null,
      credentialFingerprint,
      expiresAt: accessExpiresAt,
      refreshTokenHash,
      refreshExpiresAt,
      familyId,
      deviceId: deviceId?.trim().slice(0, 128) || null,
    },
  })

  return {
    accessToken,
    accessExpiresAt: accessExpiresAt.toISOString(),
    refreshToken,
    refreshExpiresAt: refreshExpiresAt.toISOString(),
  }
}

/**
 * Rotates an existing refresh token for a new pair within the same session family.
 * If an already-rotated token is presented (reuse attempt), revokes the ENTIRE family immediately.
 */
export async function rotateMobileSession(
  params: RotateMobileSessionParams
): Promise<RotateResult> {
  const { refreshToken, deviceId, userAgent, ipAddress } = params
  if (!refreshToken || typeof refreshToken !== 'string' || refreshToken.length > 512) {
    return { ok: false, error: 'Invalid refresh token format', status: 400 }
  }

  const targetHash = hashToken(refreshToken)
  const session = await db.authSession.findUnique({
    where: { refreshTokenHash: targetHash },
  })

  if (!session || !session.familyId) {
    return { ok: false, error: 'Invalid or expired refresh token', status: 401 }
  }

  // ─── REUSE DETECTION: If token was already rotated, revoke whole family ───
  if (session.rotatedAt != null) {
    console.error(
      `[SECURITY ALERT] [mobileAuth] Refresh token reuse detected for family ${session.familyId}. Revoking entire session family.`
    )
    await db.authSession.updateMany({
      where: { familyId: session.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    return {
      ok: false,
      error: 'Refresh token has already been used. Session family revoked.',
      status: 401,
      familyRevoked: true,
    }
  }

  // ─── REVOKED CHECK ────────────────────────────────────────────────────────
  if (session.revokedAt != null) {
    return { ok: false, error: 'Session has been revoked', status: 401 }
  }

  // ─── EXPIRY CHECK ─────────────────────────────────────────────────────────
  const now = new Date()
  if (session.refreshExpiresAt && session.refreshExpiresAt.getTime() <= now.getTime()) {
    return { ok: false, error: 'Refresh token has expired', status: 401 }
  }

  // ─── ADMIN 12-HOUR HARD CEILING CHECK ─────────────────────────────────────
  let accessExpiresAt: Date
  let refreshExpiresAt: Date

  if (session.kind === 'OWNER') {
    const rootSession = await db.authSession.findFirst({
      where: { familyId: session.familyId },
      orderBy: { createdAt: 'asc' },
    })
    const familyStart = rootSession?.createdAt.getTime() || session.createdAt.getTime()
    const elapsed = now.getTime() - familyStart

    if (elapsed >= ADMIN_SESSION_MAX_LIFETIME_MS) {
      await db.authSession.updateMany({
        where: { familyId: session.familyId, revokedAt: null },
        data: { revokedAt: now },
      })
      return {
        ok: false,
        error: 'Admin session max lifetime (12h) exceeded. Please sign in again.',
        status: 401,
      }
    }

    const remainingMs = ADMIN_SESSION_MAX_LIFETIME_MS - elapsed
    const accessTtl = Math.min(ADMIN_ACCESS_TOKEN_TTL_MS, remainingMs)
    accessExpiresAt = new Date(now.getTime() + accessTtl)
    refreshExpiresAt = new Date(now.getTime() + remainingMs)
  } else {
    // Merchant / Detector
    accessExpiresAt = new Date(now.getTime() + DETECTOR_ACCESS_TOKEN_TTL_MS)
    refreshExpiresAt = new Date(now.getTime() + DETECTOR_REFRESH_TOKEN_TTL_MS)
  }

  // Mark the current session as rotated
  await db.authSession.update({
    where: { id: session.id },
    data: {
      rotatedAt: now,
      lastSeenAt: now,
    },
  })

  // Issue new tokens in the SAME family
  const newAccessToken = createOpaqueSessionToken(session.kind as 'MERCHANT' | 'OWNER')
  const newAccessTokenHash = hashToken(newAccessToken)

  const refreshPrefix = session.kind === 'MERCHANT' ? 'rt_mch_' : 'rt_adm_'
  const newRefreshToken = `${refreshPrefix}${crypto.randomBytes(32).toString('base64url')}`
  const newRefreshTokenHash = hashToken(newRefreshToken)

  await db.authSession.create({
    data: {
      tokenHash: newAccessTokenHash,
      kind: session.kind,
      clientId: session.clientId,
      userAgent: userAgent?.trim().slice(0, 512) || session.userAgent,
      ipAddress: ipAddress?.trim().slice(0, 128) || session.ipAddress,
      credentialFingerprint: session.credentialFingerprint,
      expiresAt: accessExpiresAt,
      refreshTokenHash: newRefreshTokenHash,
      refreshExpiresAt,
      familyId: session.familyId,
      deviceId: deviceId?.trim().slice(0, 128) || session.deviceId,
    },
  })

  return {
    ok: true,
    tokens: {
      accessToken: newAccessToken,
      accessExpiresAt: accessExpiresAt.toISOString(),
      refreshToken: newRefreshToken,
      refreshExpiresAt: refreshExpiresAt.toISOString(),
    },
    kind: session.kind,
    clientId: session.clientId,
  }
}

/**
 * Revokes an entire mobile session family on logout.
 * Works with either refreshToken or accessToken.
 */
export async function revokeMobileSessionFamily(params: {
  refreshToken?: string | null
  accessToken?: string | null
}): Promise<boolean> {
  const { refreshToken, accessToken } = params

  let familyId: string | null = null

  if (refreshToken) {
    const session = await db.authSession.findUnique({
      where: { refreshTokenHash: hashToken(refreshToken) },
      select: { familyId: true },
    })
    if (session?.familyId) familyId = session.familyId
  }

  if (!familyId && accessToken) {
    const session = await db.authSession.findUnique({
      where: { tokenHash: hashToken(accessToken) },
      select: { familyId: true },
    })
    if (session?.familyId) familyId = session.familyId
  }

  if (familyId) {
    await db.authSession.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    return true
  }

  return false
}
