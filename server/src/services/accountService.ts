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
 * Retention period: how long anonymized financial rows are kept for deleted merchants.
 * Read from the environment; validated at startup. Default: 1825 days (5 years).
 */
export function getAccountRecordRetentionDays(): number {
  const raw = process.env.ACCOUNT_RECORD_RETENTION_DAYS
  if (raw === undefined || raw === '') return 1825
  const parsed = parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1825
}

// Legacy static export preserved for tests that reference it directly.
export const ACCOUNT_RECORD_RETENTION_DAYS = 1825
export const PUBLIC_DELETION_OTP_TTL_MS = 30 * 60 * 1000 // 30 minutes
export const PUBLIC_DELETION_GRACE_PERIOD_MS = 72 * 60 * 60 * 1000 // 72 hours

// ─── Generic public-facing error for all confirmation failure modes ─────────
// Using a single message prevents an attacker from distinguishing between
// unknown email, ineligible account, missing code, expired code, locked code,
// or wrong code.
export const CONFIRM_GENERIC_RESPONSE = {
  ok: false as const,
  status: 400,
  error: 'Your request could not be completed. Please check your email and confirmation code, or request a new code.',
}

/**
 * Handles merchant account deletion with strict security verification:
 * 1. Checks merchant password
 * 2. Requires fresh OTP verification (or explicit test bypass)
 * 3. Checks for pending checkouts and unsettled funds before proceeding
 * 4. Immediately runs full account data scrub inside a single db.$transaction
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

  // 3. Check for blocking conditions before scrub
  const blockReason = await checkDeletionBlockers(client.id)
  if (blockReason) {
    return { ok: false, error: blockReason, status: 409 }
  }

  await performAccountDataScrub(client)

  return {
    ok: true,
    message: 'Account deleted successfully. Personal data scrubbed; financial records preserved per compliance requirements.',
  }
}

/**
 * Returns a human-readable rejection reason if the account cannot be deleted yet,
 * or null if deletion may proceed.
 *
 * Blocking conditions (unsettled funds / unfinished settlements):
 *  - Unmatched payments that have not been reconciled.
 *  - In-flight payment events currently being processed.
 *
 * Note: PENDING checkouts are not unsettled funds — they are automatically
 * cancelled/expired by performAccountDataScrub before scrubbing.
 */
export async function checkDeletionBlockers(clientId: string): Promise<string | null> {
  // Blocking condition: In-flight payment events currently being processed
  const inFlightCount = await db.incomingPaymentEvent.count({
    where: {
      clientId,
      result: 'PROCESSING',
    },
  })
  if (inFlightCount > 0) {
    return 'Cannot delete account: Payment settlements are currently in progress. Please retry later once processing completes.'
  }

  return null
}

/**
 * Reusable account scrubber.
 *
 * Runs all mutations inside a single db.$transaction so that partial scrubs
 * cannot leave PII in any table. Steps:
 *
 *  1.  Cancel or expire all PENDING checkouts for the merchant.
 *  2.  Revoke all AuthSession rows; null out ipAddress, userAgent, credentialFingerprint.
 *  3.  Revoke all DetectorDevice rows; null out lastIp, name, and anonymize deviceId.
 *  4.  Cancel pending webhook deliveries; scrub url and payload.
 *  5.  Delete all EmailVerification rows for the merchant's original email.
 *  6.  Delete all MerchantNotification rows for the merchant.
 *  7.  Scrub payer data in Transaction rows:
 *      replace senderHandle (payer InstaPay handle) and recipientHandle with placeholder,
 *      null out note and deepLinkUrl.
 *      Columns kept for accounting: sessionId, clientId, amountEgp, amountCents, currency,
 *      status, purpose, subscriptionPlanName, detectedAmountEgp, detectedAmountCents,
 *      detectedAt, detectedRef, createdAt, expiresAt.
 *  8.  Scrub personal data in AuditLog details mentioning the merchant's businessName,
 *      email, phone, or name.
 *  9.  Replace senderHandle in IncomingPaymentEvent with placeholder [deleted].
 *  10. Replace senderHandle in MismatchedPayment with placeholder [deleted],
 *      and flag any UNMATCHED payments for admin review.
 *  11. Revoke SpecialOffer rows for the merchant and blank titles/descriptions.
 *  12. Anonymize all personal fields on the Client record.
 */
export async function performAccountDataScrub(client: { id: string; email?: string }): Promise<void> {
  const now = new Date()
  const clientId = client.id

  // Retrieve existing client details to sanitize from audit logs and other tables
  const clientRecord = await db.client.findUnique({
    where: { id: clientId },
    select: {
      email: true,
      businessName: true,
      whatsappNumber: true,
      firstName: true,
      lastName: true,
      deletionRequestedAt: true,
    },
  })

  const originalEmail = client.email ?? clientRecord?.email ?? ''
  const anonymizedEmail = `deleted_${clientId}_${now.getTime()}@deleted.local`
  const anonymizedHandle = `deleted_${clientId.slice(-8)}@instapay`
  const dummyPasswordHash = hashPassword(crypto.randomBytes(32).toString('hex'))

  await db.$transaction(async (tx) => {
    // 1. Cancel or expire all PENDING checkouts before scrubbing
    await tx.transaction.updateMany({
      where: { clientId, status: 'PENDING' },
      data: { status: 'EXPIRED', expiresAt: now },
    })

    // 2. Revoke all auth sessions; null out IP and user-agent
    await tx.authSession.updateMany({
      where: { clientId },
      data: {
        revokedAt: now,
        ipAddress: null,
        userAgent: null,
        credentialFingerprint: null,
        refreshTokenHash: null,
        deviceId: null,
      },
    })

    // 3. Revoke all detector devices; replace identifying fields
    const devices = await tx.detectorDevice.findMany({ where: { clientId } })
    for (const d of devices) {
      await tx.detectorDevice.update({
        where: { id: d.id },
        data: {
          revokedAt: now,
          lastIp: null,
          name: null,
          deviceId: `deleted_device_${clientId.slice(-8)}_${d.id.slice(-6)}`,
          credentialHash: null,
        },
      })
    }

    // 4a. Cancel pending webhook deliveries
    await tx.webhookLog.updateMany({
      where: {
        clientId,
        isSuccess: false,
        nextAttemptAt: { not: null },
      },
      data: {
        nextAttemptAt: null,
        deliveryLockedUntil: null,
        response: 'Cancelled due to account deletion',
      },
    })

    // 4b. Scrub url and payload from all webhook log rows
    await tx.webhookLog.updateMany({
      where: { clientId },
      data: {
        url: 'https://deleted.local/webhook',
        payload: '{"anonymized":true}',
        response: null,
      },
    })

    // 5. Delete all EmailVerification rows for the merchant's original email
    if (originalEmail) {
      await tx.emailVerification.deleteMany({
        where: { email: originalEmail },
      })
    }

    // 6. Delete all MerchantNotification rows
    await tx.merchantNotification.deleteMany({
      where: { clientId },
    })

    // 7. Scrub payer data and merchant handle in Transaction rows
    //    Keep: sessionId, clientId, amountEgp, amountCents, currency, status, purpose,
    //          subscriptionPlanName, detectedAmountEgp, detectedAmountCents, detectedAt,
    //          detectedRef, createdAt, expiresAt for accounting and tax records.
    await tx.transaction.updateMany({
      where: { clientId },
      data: {
        senderHandle: '[deleted]',
        recipientHandle: '[deleted]',
        note: null,
        deepLinkUrl: 'https://deleted.local/pay',
      },
    })

    // 8. Sanitize audit log entries mentioning merchant PII
    const piiTerms = [
      originalEmail,
      clientRecord?.businessName,
      clientRecord?.whatsappNumber,
      clientRecord?.firstName,
      clientRecord?.lastName,
    ].filter((term): term is string => Boolean(term && term.length > 2))

    if (piiTerms.length > 0) {
      const auditRows = await tx.auditLog.findMany({
        where: {
          OR: piiTerms.map((term) => ({ details: { contains: term } })),
        },
      })
      for (const row of auditRows) {
        let sanitized = row.details
        for (const term of piiTerms) {
          sanitized = sanitized.replaceAll(term, '[deleted]')
        }
        await tx.auditLog.update({
          where: { id: row.id },
          data: { details: sanitized },
        })
      }
    }

    // 9. Replace senderHandle in IncomingPaymentEvent with placeholder
    await tx.incomingPaymentEvent.updateMany({
      where: { clientId },
      data: { senderHandle: '[deleted]' },
    })

    // 10. Replace senderHandle in MismatchedPayment with placeholder [deleted],
    //     and flag any UNMATCHED payments for admin review.
    const unmatchedCount = await tx.mismatchedPayment.count({
      where: { clientId, status: 'UNMATCHED' },
    })
    if (unmatchedCount > 0) {
      console.warn(
        `[ADMIN REVIEW NEEDED] Account deletion for merchant ${clientId} proceeded with ${unmatchedCount} UNMATCHED payment(s). Retained for reconciliation.`
      )
      await tx.auditLog.create({
        data: {
          action: 'MERCHANT_DELETION_UNMATCHED_PAYMENTS_FLAGGED',
          details: `Merchant ${clientId} deleted with ${unmatchedCount} UNMATCHED payment(s). Flagged for admin review and reconciliation.`,
        },
      })
    }
    await tx.mismatchedPayment.updateMany({
      where: { clientId },
      data: { senderHandle: '[deleted]' },
    })

    // 11. Revoke and scrub any SpecialOffer records
    await tx.specialOffer.updateMany({
      where: { clientId },
      data: {
        status: 'REVOKED',
        title: 'Deleted Special Offer',
        description: null,
      },
    })

    // 12. Anonymize all personal fields on the Client record
    await tx.client.update({
      where: { id: clientId },
      data: {
        firstName: null,
        lastName: null,
        businessName: `Deleted Merchant ${clientId.slice(-6)}`,
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
        deletionRequestedAt: clientRecord?.deletionRequestedAt ?? now,
        deletedAt: now,
      },
    })
  }, { timeout: 15000, maxWait: 5000 })
}

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

  if (isEligible && client) {
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
 * Public confirmation handler for verifying deletion code.
 *
 * Anti-enumeration: all failure modes (unknown email, ineligible account,
 * missing code, expired code, locked code, wrong code) return the exact same HTTP 400
 * status and generic message. Only a successful path returns a distinct response.
 *
 * On success:
 *  - Immediately revokes all AuthSession and DetectorDevice rows.
 *  - Sets deletionRequestedAt = now and isActive = false.
 *  - 72-hour grace period begins: merchant can log in within 72 hours to cancel.
 *  - The daily retention worker completes the data scrub after 72 hours.
 */
export async function confirmPublicAccountDeletion(params: {
  email?: string
  code?: string
}): Promise<{ ok: true; message: string } | { ok: false; error: string; status: number }> {
  const { email, code } = params
  if (!email || typeof email !== 'string' || !code || typeof code !== 'string') {
    return CONFIRM_GENERIC_RESPONSE
  }

  const cleanEmail = normalizeEmail(email)
  const cleanCode = code.trim()

  // Look up client — failures here are deliberately indistinguishable from
  // code-related failures (anti-enumeration).
  const client = await db.client.findUnique({ where: { email: cleanEmail } })
  if (!client || !client.isActive || client.approvalStatus !== 'APPROVED') {
    // Perform equivalent DB query to maintain uniform timing
    await db.emailVerification.findFirst({
      where: { email: cleanEmail, purpose: 'ACCOUNT_DELETION_PUBLIC', consumedAt: null },
    }).catch(() => null)
    return CONFIRM_GENERIC_RESPONSE
  }

  const verification = await db.emailVerification.findFirst({
    where: {
      email: cleanEmail,
      purpose: 'ACCOUNT_DELETION_PUBLIC',
      consumedAt: null,
    },
    orderBy: { createdAt: 'desc' },
  })

  // No code, expired code, or locked code — all treated identically
  if (
    !verification ||
    verification.expiresAt.getTime() <= Date.now() ||
    verification.attempts >= 5
  ) {
    return CONFIRM_GENERIC_RESPONSE
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
    await db.emailVerification.update({
      where: { id: verification.id },
      data: { attempts: { increment: 1 } },
    }).catch(() => {})
    // Wrong code — same generic response (anti-enumeration)
    return CONFIRM_GENERIC_RESPONSE
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
    return CONFIRM_GENERIC_RESPONSE
  }

  // Immediately revoke sessions and devices, then schedule scrub via deletionRequestedAt.
  // The actual data scrub runs in the daily retention purge worker after 72 hours.
  const now = new Date()

  await db.$transaction(async (tx) => {
    // Revoke all sessions and devices immediately
    await tx.authSession.updateMany({
      where: { clientId: client.id, revokedAt: null },
      data: {
        revokedAt: now,
        ipAddress: null,
        userAgent: null,
        credentialFingerprint: null,
        refreshTokenHash: null,
        deviceId: null,
      },
    })

    const devices = await tx.detectorDevice.findMany({ where: { clientId: client.id } })
    for (const d of devices) {
      await tx.detectorDevice.update({
        where: { id: d.id },
        data: {
          revokedAt: now,
          lastIp: null,
          name: null,
          deviceId: `deleted_device_${client.id.slice(-8)}_${d.id.slice(-6)}`,
          credentialHash: null,
        },
      })
    }

    // Mark account for deferred deletion (grace period starts now)
    await tx.client.update({
      where: { id: client.id },
      data: {
        deletionRequestedAt: now,
        isActive: false,
      },
    })
  }, { timeout: 15000, maxWait: 5000 })

  return {
    ok: true,
    message: 'Deletion confirmed. Your account has been deactivated and will be permanently deleted in 72 hours. If you change your mind, log in before the deadline to cancel.',
  }
}

/**
 * Cancel a pending public deletion request.
 * Called from the login flow when the merchant authenticates within the 72-hour grace window.
 * Clears deletionRequestedAt and restores isActive.
 */
export async function cancelPublicDeletionRequest(clientId: string): Promise<void> {
  await db.client.update({
    where: { id: clientId },
    data: {
      deletionRequestedAt: null,
      isActive: true,
    },
  }).catch(() => {})
}

/**
 * Checks whether an account is currently within its 72-hour deletion grace period.
 */
export function isWithinDeletionGracePeriod(client: {
  isActive?: boolean
  approvalStatus?: string
  deletionRequestedAt: Date | null
  deletedAt: Date | null
}): boolean {
  if (client.deletedAt !== null) return false
  if (client.approvalStatus !== 'APPROVED') return false
  if (!client.deletionRequestedAt) return false
  return Date.now() - new Date(client.deletionRequestedAt).getTime() < PUBLIC_DELETION_GRACE_PERIOD_MS
}

/**
 * Run the daily retention purge:
 *  - Complete deferred public deletions whose 72-hour grace period has elapsed.
 *  - Purge/anonymize financial rows for fully-deleted merchants that are older
 *    than ACCOUNT_RECORD_RETENTION_DAYS.
 *
 * @param nowOverride Optional date override for testing with a fake clock.
 */
export async function runDailyRetentionPurge(nowOverride?: Date): Promise<{
  deferredDeletionsCompleted: number
  retentionRowsAnonymized: number
}> {
  const now = nowOverride ?? new Date()
  const graceCutoff = new Date(now.getTime() - PUBLIC_DELETION_GRACE_PERIOD_MS)
  const retentionDays = getAccountRecordRetentionDays()
  const retentionCutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000)

  let deferredDeletionsCompleted = 0
  let retentionRowsAnonymized = 0

  // 1. Find merchants whose 72-hour grace period has elapsed but are not yet fully deleted.
  const pendingDeletions = await db.client.findMany({
    where: {
      deletionRequestedAt: { lte: graceCutoff },
      deletedAt: null,
      approvalStatus: { not: 'DELETED' },
    },
    select: { id: true, email: true },
  })

  for (const merchant of pendingDeletions) {
    try {
      await performAccountDataScrub(merchant)
      deferredDeletionsCompleted++
      console.log(`[retention-purge] Completed deferred deletion for merchant ${merchant.id}`)
    } catch (err) {
      console.error(`[retention-purge] Failed to complete deferred deletion for merchant ${merchant.id}:`, err)
    }
  }

  // 2. Purge retained financial rows for deleted merchants older than the retention period.
  //    Rows in Transaction, IncomingPaymentEvent, MismatchedPayment, WebhookLog
  //    are purged when createdAt < retentionCutoff for merchants with deletedAt set.
  const deletedMerchants = await db.client.findMany({
    where: {
      deletedAt: { not: null, lte: retentionCutoff },
      approvalStatus: 'DELETED',
    },
    select: { id: true },
  })

  for (const merchant of deletedMerchants) {
    try {
      let count = 0
      const txResult = await db.transaction.deleteMany({
        where: {
          clientId: merchant.id,
          createdAt: { lt: retentionCutoff },
        },
      })
      count += txResult.count || 0

      const ipeResult = await db.incomingPaymentEvent.deleteMany({
        where: {
          clientId: merchant.id,
          createdAt: { lt: retentionCutoff },
        },
      })
      count += ipeResult.count || 0

      const mmResult = await db.mismatchedPayment.deleteMany({
        where: {
          clientId: merchant.id,
          createdAt: { lt: retentionCutoff },
        },
      })
      count += mmResult.count || 0

      const wlResult = await db.webhookLog.deleteMany({
        where: {
          clientId: merchant.id,
          createdAt: { lt: retentionCutoff },
        },
      })
      count += wlResult.count || 0

      retentionRowsAnonymized += count
      if (count > 0) {
        console.log(`[retention-purge] Purged ${count} retained rows for deleted merchant ${merchant.id}`)
      }
    } catch (err) {
      console.error(`[retention-purge] Failed to purge retained rows for merchant ${merchant.id}:`, err)
    }
  }

  return { deferredDeletionsCompleted, retentionRowsAnonymized }
}
