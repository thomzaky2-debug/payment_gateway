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

  const now = new Date()

  // ─── DEVICE BINDING CHECK ─────────────────────────────────────────────────
  // If session has a deviceId and the refresh request's deviceId differs, return 401 and revoke the family.
  // Never overwrite a session's deviceId with a request value.
  const normalizedReqDeviceId = typeof deviceId === 'string' && deviceId.trim() ? deviceId.trim() : null
  if (session.deviceId && session.deviceId !== normalizedReqDeviceId) {
    console.warn(
      `[SECURITY ALERT] [mobileAuth] Device binding mismatch for session ${session.id} (bound: ${session.deviceId}, requested: ${normalizedReqDeviceId}). Revoking entire session family.`
    )
    await db.authSession.updateMany({
      where: { familyId: session.familyId, revokedAt: null },
      data: { revokedAt: now },
    })
    return {
      ok: false,
      error: 'Device binding mismatch. Session family revoked.',
      status: 401,
      familyRevoked: true,
    }
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

  // ─── ATOMIC CAS ROTATION & SESSION CREATION TRANSACTION ───────────────────
  // Replace the read-then-update with one compare-and-set:
  // updateMany where { id, rotatedAt: null, revokedAt: null, refreshExpiresAt > now } set rotatedAt.
  // If count is 0, treat it as reuse: revoke the whole familyId and return 401.
  // Create the new session in the same transaction as the rotation.
  const newAccessToken = createOpaqueSessionToken(session.kind as 'MERCHANT' | 'OWNER')
  const newAccessTokenHash = hashToken(newAccessToken)

  const refreshPrefix = session.kind === 'MERCHANT' ? 'rt_mch_' : 'rt_adm_'
  const newRefreshToken = `${refreshPrefix}${crypto.randomBytes(32).toString('base64url')}`
  const newRefreshTokenHash = hashToken(newRefreshToken)

  const transactionResult = await db.$transaction(async (tx) => {
    const cas = await tx.authSession.updateMany({
      where: {
        id: session.id,
        rotatedAt: null,
        revokedAt: null,
        refreshExpiresAt: { gt: now },
      },
      data: {
        rotatedAt: now,
        lastSeenAt: now,
      },
    })

    if (cas.count === 0) {
      console.error(
        `[SECURITY ALERT] [mobileAuth] Refresh token reuse detected for family ${session.familyId}. Revoking entire session family.`
      )
      await tx.authSession.updateMany({
        where: { familyId: session.familyId, revokedAt: null },
        data: { revokedAt: now },
      })
      return {
        ok: false as const,
        error: 'Refresh token has already been used or expired. Session family revoked.',
        status: 401,
        familyRevoked: true,
      }
    }

    // cas.count === 1: Create new session in the same transaction.
    // Retain session.deviceId: never overwrite with a request value.
    await tx.authSession.create({
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
        deviceId: session.deviceId,
      },
    })

    return {
      ok: true as const,
      tokens: {
        accessToken: newAccessToken,
        accessExpiresAt: accessExpiresAt.toISOString(),
        refreshToken: newRefreshToken,
        refreshExpiresAt: refreshExpiresAt.toISOString(),
      },
      kind: session.kind,
      clientId: session.clientId,
    }
  })

  return transactionResult
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
