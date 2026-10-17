import crypto from 'crypto'
import { db } from '../db.js'
import { verifyPassword, hashPassword } from './authService.js'
import {
  verifyOtpCode,
  normalizeEmail,
  generateOtp,
  hashOtp,
  sendOtpEmail,
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

  await performAccountDataScrub(client)

  return {
    ok: true,
    message: 'Account deleted successfully. Personal data scrubbed; financial records preserved per compliance requirements.',
  }
}

/**
 * Reusable account scrubber that revokes sessions and devices, cancels pending webhooks,
 * scrubs personal payloads, and anonymizes client PII while retaining audit records.
 */
export async function performAccountDataScrub(client: { id: string }): Promise<void> {
  const now = new Date()

  // 1. Immediately revoke all sessions
  await db.authSession.updateMany({
    where: { clientId: client.id, revokedAt: null },
    data: { revokedAt: now },
  })

  // 2. Immediately revoke all detector devices
  await db.detectorDevice.updateMany({
    where: { clientId: client.id, revokedAt: null },
    data: { revokedAt: now },
  })

  // 3. Cancel pending webhook deliveries
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

  // 4. Scrub personal webhook log contents
  await db.webhookLog.updateMany({
    where: { clientId: client.id },
    data: {
      url: 'https://deleted.local/webhook',
      payload: '{"anonymized":true}',
    },
  })

  // 5. Anonymize all personal fields on the Client record
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
}

export const ACCOUNT_RECORD_RETENTION_DAYS = 5 * 365 // 1825 days (5 years) statutory compliance retention
export const PUBLIC_DELETION_OTP_TTL_MS = 30 * 60 * 1000 // 30 minutes

/**
 * Public request handler for merchants requesting deletion outside the app.
 * Gives balanced timing and identical responses for known and unknown emails.
 * Stores a single-use code with purpose ACCOUNT_DELETION_PUBLIC (30 min expiry).
 * Never invalidates the merchant's in-app ACCOUNT_DELETION code.
 * Queues the email send asynchronously and never awaits SMTP.
 */
export async function requestPublicAccountDeletion(email: string): Promise<boolean> {
  const cleanEmail = normalizeEmail(email)
  const client = await db.client.findUnique({ where: { email: cleanEmail } })
  const isEligible = Boolean(client && client.isActive && client.approvalStatus === 'APPROVED')

  if (isEligible) {
    const now = new Date()
    // Invalidate previous unconsumed ACCOUNT_DELETION_PUBLIC codes ONLY (does not touch ACCOUNT_DELETION)
    await db.emailVerification.updateMany({
      where: { email: cleanEmail, purpose: 'ACCOUNT_DELETION_PUBLIC', consumedAt: null },
      data: { consumedAt: now },
    })

    const code = generateOtp()
    await db.emailVerification.create({
      data: {
        email: cleanEmail,
        otpHash: hashOtp(cleanEmail, code),
        purpose: 'ACCOUNT_DELETION_PUBLIC',
        expiresAt: new Date(now.getTime() + PUBLIC_DELETION_OTP_TTL_MS),
      },
    })

    // Queue email asynchronously — NEVER await SMTP/network send in the HTTP request handler
    setImmediate(() => {
      sendOtpEmail({ to: cleanEmail, otp: code, purpose: 'ACCOUNT_DELETION_PUBLIC' }).catch((err) => {
        console.error('[accountService] Failed to send async public deletion email:', err)
      })
    })

    return true
  }

  // Uniform timing work for unknown or inactive accounts:
  // Perform equivalent cryptographic calculation and database query so timing is uniform.
  const dummyOtp = generateOtp()
  hashOtp(cleanEmail, dummyOtp)
  await db.emailVerification.findFirst({
    where: { email: cleanEmail, purpose: 'ACCOUNT_DELETION_PUBLIC' },
  }).catch(() => null)
  setImmediate(() => {})

  return false
}

/**
 * Public confirmation handler for verifying deletion code and scrubbing account data.
 * Verifies the ACCOUNT_DELETION_PUBLIC single-use code. Locked after 5 failed tries.
 */
export async function confirmPublicAccountDeletion(params: {
  email: string
  code: string
}): Promise<{ ok: true; message: string } | { ok: false; error: string; status: number }> {
  const { email, code } = params
  if (!email || typeof email !== 'string' || !code || typeof code !== 'string') {
    return { ok: false, error: 'Email and confirmation code are required', status: 400 }
  }

  const cleanEmail = normalizeEmail(email)
  const cleanCode = code.trim()

  const client = await db.client.findUnique({ where: { email: cleanEmail } })
  if (!client || !client.isActive || client.approvalStatus !== 'APPROVED') {
    return { ok: false, error: 'No active merchant account found for this email address', status: 400 }
  }

  const verification = await db.emailVerification.findFirst({
    where: {
      email: cleanEmail,
      purpose: 'ACCOUNT_DELETION_PUBLIC',
      consumedAt: null,
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!verification) {
    return { ok: false, error: 'Please request a new confirmation code.', status: 400 }
  }

  if (verification.expiresAt.getTime() <= Date.now()) {
    return { ok: false, error: 'Confirmation code has expired. Please request a new code.', status: 400 }
  }

  if (verification.attempts >= 5) {
    return { ok: false, error: 'Too many failed attempts. This code is locked. Please request a new code.', status: 400 }
  }

  const expectedOtpHash = hashOtp(cleanEmail, cleanCode)
  const codeMatches = (() => {
    try {
      const actual = Buffer.from(verification.otpHash, 'hex')
      const expected = Buffer.from(expectedOtpHash, 'hex')
      return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
    } catch {
      return false
    }
  })()

  if (!codeMatches) {
    const nextAttempts = verification.attempts + 1
    await db.emailVerification.update({
      where: { id: verification.id },
      data: { attempts: { increment: 1 } },
    }).catch(() => {})

    const remaining = Math.max(0, 5 - nextAttempts)
    if (remaining === 0) {
      return { ok: false, error: 'Incorrect confirmation code. Maximum attempts reached. Please request a new code.', status: 400 }
    }
    return { ok: false, error: `Incorrect confirmation code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`, status: 400 }
  }

  // Atomic consumption of the single-use code
  const consumed = await db.emailVerification.updateMany({
    where: {
      id: verification.id,
      email: cleanEmail,
      purpose: 'ACCOUNT_DELETION_PUBLIC',
      otpHash: expectedOtpHash,
      consumedAt: null,
      expiresAt: { gt: new Date() },
      attempts: { lt: 5 },
    },
    data: { consumedAt: new Date() },
  })

  if (consumed.count !== 1) {
    return { ok: false, error: 'This confirmation code is no longer valid. Please request a new code.', status: 400 }
  }

  // Execute the exact same deletion and scrubbing as the in-app path
  await performAccountDataScrub(client)

  return {
    ok: true,
    message: 'Account deleted successfully. Personal data scrubbed; financial records preserved per compliance requirements.',
  }
}
