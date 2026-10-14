import crypto from 'crypto'
import { db } from '../db.js'
import { verifyPassword, hashPassword } from './authService.js'
import {
  verifyOtpCode,
  normalizeEmail,
  generateOtp,
  hashOtp,
} from '../lib/emailDelivery.js'
import { isExplicitDevAuthEnabled, issueOtpVerification, OTP_TTL_MS } from '../routes/authRoutes.js'

export interface DeleteAccountInput {
  clientId: string
  password?: string
  verificationId?: string
  otp?: string
  skipOtp?: boolean
}

export type DeleteAccountResult =
  | { ok: true; message: string }
  | { ok: true; otpRequired: true; verificationId: string; expiresInSeconds: number; devOtp?: string }
  | { ok: false; error: string; status: number }

/**
 * Handles merchant account deletion with strict security verification:
 * 1. Checks merchant password
 * 2. Requires fresh OTP verification (or explicit test bypass)
 * 3. Immediately revokes all sessions and detector devices
 * 4. Cancels all pending webhook deliveries
 * 5. Anonymizes personal identification data (name, email, phone, whatsapp, profile photo, credentials)
 * 6. Preserves immutable transaction ledgers and audit records for compliance retention
 */
export async function deleteMerchantAccount(
  input: DeleteAccountInput
): Promise<DeleteAccountResult> {
  const { clientId, password, verificationId, otp, skipOtp } = input
  const client = await db.client.findUnique({ where: { id: clientId } })
  if (!client) {
    return { ok: false, error: 'Merchant account not found', status: 404 }
  }

  // 1. Verify merchant password
  if (!password || !verifyPassword(password, client.passwordHash)) {
    return { ok: false, error: 'Invalid password', status: 401 }
  }

  // 2. Fresh OTP verification
  const isBypass = isExplicitDevAuthEnabled('AUTH_ALLOW_DEV_BYPASS') && skipOtp === true
  if (!isBypass && (!verificationId || !otp)) {
    const { otp: generatedOtp, verification } = await issueOtpVerification(
      client.email,
      'ACCOUNT_DELETION'
    )
    return {
      ok: true,
      otpRequired: true,
      verificationId: verification.id,
      expiresInSeconds: OTP_TTL_MS / 1000,
      ...(isExplicitDevAuthEnabled('AUTH_EXPOSE_DEV_OTP') ? { devOtp: generatedOtp } : {}),
    }
  }

  if (!isBypass) {
    const otpResult = await verifyOtpCode(
      db,
      client.email,
      String(verificationId),
      String(otp),
      'ACCOUNT_DELETION'
    )
    if (!otpResult.valid) {
      return { ok: false, error: otpResult.error || 'Invalid verification code', status: 400 }
    }
  }

  const now = new Date()

  // 3. Immediately revoke all sessions
  await db.authSession.updateMany({
    where: { clientId: client.id, revokedAt: null },
    data: { revokedAt: now },
  })

  // 4. Immediately revoke all detector devices
  await db.detectorDevice.updateMany({
    where: { clientId: client.id, revokedAt: null },
    data: { revokedAt: now },
  })

  // 5. Cancel pending webhook deliveries
  await db.webhookLog.updateMany({
    where: {
      clientId: client.id,
      isSuccess: false,
      nextAttemptAt: { not: null },
    },
    data: {
      nextAttemptAt: null,
      deliveryLockedUntil: null,
      response: 'Cancelled due to account deletion',
    },
  })

  // 6. Scrub personal webhook log contents
  await db.webhookLog.updateMany({
    where: { clientId: client.id },
    data: {
      url: 'https://deleted.local/webhook',
      payload: '{"anonymized":true}',
    },
  })

  // 7. Anonymize all personal fields on the Client record
  const anonymizedEmail = `deleted_${client.id}_${now.getTime()}@deleted.local`
  const anonymizedHandle = `deleted_${client.id.slice(-8)}@instapay`
  const dummyPasswordHash = hashPassword(crypto.randomBytes(32).toString('hex'))

  await db.client.update({
    where: { id: client.id },
    data: {
      firstName: null,
      lastName: null,
      businessName: `Deleted Merchant ${client.id.slice(-6)}`,
      businessType: null,
      email: anonymizedEmail,
      whatsappNumber: null,
      profileImageData: null,
      apiKey: null,
      detectToken: null,
      apiKeyHash: null,
      detectTokenHash: null,
      webhookUrl: null,
      webhookSecret: null,
      webhookSecretHash: null,
      instapayHandle: anonymizedHandle,
      instapayPaymentUrl: null,
      isActive: false,
      approvalStatus: 'DELETED',
      passwordHash: dummyPasswordHash,
      deletionRequestedAt: now,
      deletedAt: now,
    },
  })

  return {
    ok: true,
    message: 'Account deleted successfully. Personal data scrubbed; financial records preserved per compliance requirements.',
  }
}

/**
 * Public request handler for merchants requesting deletion outside the app.
 * Gives balanced timing and identical responses for known and unknown emails to prevent enumeration.
 */
export async function requestPublicAccountDeletion(email: string): Promise<boolean> {
  const cleanEmail = normalizeEmail(email)
  const client = await db.client.findUnique({ where: { email: cleanEmail } })
  const isEligible = Boolean(client && client.isActive && client.approvalStatus === 'APPROVED')

  if (isEligible) {
    try {
      await issueOtpVerification(cleanEmail, 'ACCOUNT_DELETION')
      return true
    } catch (err) {
      console.error('[accountService] Failed to issue public deletion OTP:', err)
      return false
    }
  }

  // Balanced timing path: perform equivalent crypto operation and database query
  // to ensure request durations are indistinguishable for existing and non-existing accounts.
  const dummyOtp = generateOtp()
  hashOtp(cleanEmail, dummyOtp)
  await db.emailVerification.findFirst({
    where: { email: cleanEmail, purpose: 'ACCOUNT_DELETION' },
  }).catch(() => null)

  return false
}
