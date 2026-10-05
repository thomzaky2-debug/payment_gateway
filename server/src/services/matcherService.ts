import { db } from '../db.js'
import { toEgpCents, fromEgpCents, egpAmountFromRow } from '../lib/money.js'
import { emitCheckoutUpdate } from './notificationService.js'
import { forwardToClientWebhook } from './webhookService.js'
import type { Client } from '@prisma/client'

export interface ProcessNotificationInput {
  client: Client
  amountEgp?: number | null
  senderHandle?: string | null
  reference?: string | null
  rawText?: string | null
  notificationTimestamp?: string | Date | null
  deviceId?: string | null
  appVersion?: string | null
  androidVersion?: string | null
  requestIp?: string | null
}

export interface MatchResult {
  ok: boolean
  matched: boolean
  duplicate?: boolean
  reason?: string
  sessionId?: string
  status?: string
  received: {
    senderHandle: string | null
    amountEgp: number | null
    reference: string | null
  }
}

export function normalizeHandle(raw: string): string {
  const h = (raw || '').trim().toLowerCase().replace(/^@/, '')
  if (!h) return ''
  const local = h.split('@')[0]
  if (!local) return ''
  return `${local}@instapay`
}

export function extractSenderFromText(text: string): string | null {
  const clean = text.toLowerCase()
  // Matches Arabic or English notifications
  const matchEn = clean.match(/received\s+[\d.,]+\s*egp?\s+from\s+([a-z0-9_.\-]+@instapay)/)
  if (matchEn) return matchEn[1]

  const matchAr = clean.match(/من\s+([a-z0-9_.\-]+@instapay)/)
  if (matchAr) return matchAr[1]

  return null
}

export function extractAmountFromText(text: string): number | null {
  const clean = text.toLowerCase()
  const matchEn = clean.match(/received\s+([\d]+(?:\.[\d]{1,2})?)\s*egp?\b/)
  if (matchEn) {
    const n = Number(matchEn[1])
    return Number.isFinite(n) ? n : null
  }

  const matchAr = clean.match(/استلمت\s+([\d]+(?:\.[\d]{1,2})?)\s*جنيه/)
  if (matchAr) {
    const n = Number(matchAr[1])
    return Number.isFinite(n) ? n : null
  }

  return null
}

/**
 * Core Matching Algorithm for Incoming InstaPay Notifications
 */
export async function processInstaPayNotification(
  input: ProcessNotificationInput
): Promise<MatchResult> {
  const { client, deviceId, appVersion, androidVersion, requestIp } = input

  // 1. Record device heartbeat
  if (deviceId && deviceId.trim()) {
    try {
      await db.detectorDevice.upsert({
        where: {
          clientId_deviceId: {
            clientId: client.id,
            deviceId: deviceId.trim().slice(0, 128),
          },
        },
        create: {
          clientId: client.id,
          deviceId: deviceId.trim().slice(0, 128),
          appVersion: appVersion?.trim().slice(0, 64) || null,
          androidVersion: androidVersion?.trim().slice(0, 64) || null,
          lastIp: requestIp || null,
        },
        update: {
          appVersion: appVersion?.trim().slice(0, 64) || undefined,
          androidVersion: androidVersion?.trim().slice(0, 64) || undefined,
          lastIp: requestIp || null,
          lastSeenAt: new Date(),
        },
      })
    } catch (heartbeatErr) {
      console.warn('[matcher] Failed to upsert detector device heartbeat:', heartbeatErr)
    }
  }

  // 2. Parse text if provided
  let amountEgp: number | null = input.amountEgp != null ? Number(input.amountEgp) : null
  let senderHandle: string | null = input.senderHandle
    ? normalizeHandle(input.senderHandle)
    : null

  if (input.rawText) {
    const extractedSender = extractSenderFromText(input.rawText)
    if (extractedSender) senderHandle = normalizeHandle(extractedSender)
    const extractedAmount = extractAmountFromText(input.rawText)
    if (extractedAmount != null) amountEgp = extractedAmount
  }

  const reference = (input.reference || '').trim() || null

  if (amountEgp == null || !Number.isFinite(amountEgp) || amountEgp <= 0) {
    throw new Error('amountEgp is required and must be a positive number.')
  }
  const receivedAmountCents = toEgpCents(amountEgp)
  const receivedAmountRounded = fromEgpCents(receivedAmountCents) ?? 0

  if (!senderHandle) {
    throw new Error('senderHandle is required (e.g. "customer@instapay").')
  }

  if (senderHandle === client.instapayHandle) {
    throw new Error('Sender equals recipient handle.')
  }

  const now = new Date()
  const GRACE_PERIOD_MS = 30 * 60 * 1000 // 30 minutes grace period
  const graceCutoff = new Date(now.getTime() - GRACE_PERIOD_MS)

  // 3. Matching Step 1: Exact match with active PENDING checkouts
  let match = await db.transaction.findFirst({
    where: {
      clientId: client.id,
      senderHandle,
      amountCents: receivedAmountCents,
      amountEgp: receivedAmountRounded,
      status: 'PENDING',
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: 'asc' },
  })

  // 4. Matching Step 2: Exact match in 30-minute grace period
  if (!match) {
    match = await db.transaction.findFirst({
      where: {
        clientId: client.id,
        senderHandle,
        amountCents: receivedAmountCents,
        amountEgp: receivedAmountRounded,
        status: { in: ['PENDING', 'EXPIRED'] },
        expiresAt: { gte: graceCutoff },
      },
      orderBy: { createdAt: 'asc' },
    })
  }

  let isMismatchedAmount = false

  // 5. Matching Step 3: Match by senderHandle (Check for underpayment/overpayment)
  if (!match) {
    match = await db.transaction.findFirst({
      where: {
        clientId: client.id,
        senderHandle,
        status: { in: ['PENDING', 'EXPIRED'] },
        expiresAt: { gte: graceCutoff },
      },
      orderBy: { createdAt: 'asc' },
    })
    if (match) {
      isMismatchedAmount = true
    }
  }

  // 6. Matching Step 4: Single checkout amount fallback
  if (!match) {
    const potentialMatches = await db.transaction.findMany({
      where: {
        clientId: client.id,
        amountCents: receivedAmountCents,
        amountEgp: receivedAmountRounded,
        status: { in: ['PENDING', 'EXPIRED'] },
        expiresAt: { gte: graceCutoff },
      },
    })
    if (potentialMatches.length === 1) {
      match = potentialMatches[0]
      console.log(`[matcher] Fallback matched exactly 1 checkout: ${match.sessionId}`)
    }
  }

  // 7. Unmatched / Orphaned Payment
  if (!match) {
    try {
      await db.mismatchedPayment.create({
        data: {
          clientId: client.id,
          senderHandle,
          amountEgp: receivedAmountRounded,
          amountCents: receivedAmountCents,
          reference,
          status: 'UNMATCHED',
        },
      })
    } catch (err) {
      console.error('[matcher] Failed to save mismatched payment:', err)
    }

    return {
      ok: true,
      matched: false,
      reason: 'NO_PENDING_CHECKOUT',
      received: { senderHandle, amountEgp: receivedAmountRounded, reference },
    }
  }

  // 8. Handle Amount Discrepancies (Underpayment vs Overpayment with Merchant Tolerance Policy)
  if (isMismatchedAmount) {
    const requestedAmountCents = match.amountCents ?? toEgpCents(match.amountEgp)

    // CASE A: Underpayment
    if (receivedAmountCents < requestedAmountCents) {
      const shortageCents = requestedAmountCents - receivedAmountCents
      const shortageEgp = fromEgpCents(shortageCents) ?? (shortageCents / 100)
      const toleranceEgp = client.underpaidToleranceEnabled ? (client.underpaidToleranceEgp ?? 0) : 0
      const toleranceCents = toEgpCents(toleranceEgp)

      // If underpayment is within the merchant's agreed precision tolerance:
      if (client.underpaidToleranceEnabled && shortageCents <= toleranceCents) {
        console.log(
          `[matcher] Underpayment of ${shortageEgp.toFixed(2)} EGP is within agreed merchant precision tolerance (${toleranceEgp.toFixed(2)} EGP). Auto-confirming session ${match.sessionId}`
        )
        // Proceed to Step 9 (auto-confirm transaction with detectedAmountEgp recorded)
      } else {
        // Exceeds tolerance or tolerance disabled -> mark UNDERPAID and route to Manual Review Queue
        const updated = await db.transaction.update({
          where: { id: match.id },
          data: {
            status: 'UNDERPAID',
            detectedRef: reference,
            detectedAt: now,
            detectedAmountEgp: receivedAmountRounded,
            detectedAmountCents: receivedAmountCents,
          },
        })

        emitCheckoutUpdate({
          sessionId: updated.sessionId,
          status: 'UNDERPAID',
          amountEgp: updated.amountEgp,
          detectedAmountEgp: updated.detectedAmountEgp,
          senderHandle: updated.senderHandle,
          detectedRef: updated.detectedRef,
          detectedAt: updated.detectedAt?.toISOString(),
        })

        if (client.webhookUrl) {
          void forwardToClientWebhook(client.id, client.webhookUrl, client.webhookSecret, {
            event: 'payment.underpaid',
            clientId: client.id,
            businessName: client.businessName,
            transaction: {
              sessionId: updated.sessionId,
              senderHandle: updated.senderHandle,
              recipientHandle: updated.recipientHandle,
              amountEgp: egpAmountFromRow(match),
              detectedAmountEgp: updated.detectedAmountEgp,
              currency: updated.currency,
              status: updated.status,
              detectedRef: updated.detectedRef,
              detectedAt: updated.detectedAt?.toISOString() ?? null,
              note: updated.note,
              createdAt: updated.createdAt.toISOString(),
            },
          })
        }

        return {
          ok: true,
          matched: false,
          reason: 'UNDERPAID',
          sessionId: updated.sessionId,
          status: updated.status,
          received: { senderHandle, amountEgp: receivedAmountRounded, reference },
        }
      }
    }

    // CASE B: Overpayment
    if (receivedAmountCents > requestedAmountCents) {
      const excessCents = receivedAmountCents - requestedAmountCents
      const excessEgp = fromEgpCents(excessCents) ?? (excessCents / 100)
      const autoAccept = client.autoAcceptOverpaid ?? true
      const maxExcessEgp = client.overpaidMaxExcessEgp

      const isWithinLimit = maxExcessEgp == null || excessEgp <= maxExcessEgp

      if (autoAccept && isWithinLimit) {
        console.log(
          `[matcher] Overpayment of +${excessEgp.toFixed(2)} EGP auto-accepted per merchant policy. Auto-confirming session ${match.sessionId}`
        )
        // Proceed to Step 9 (auto-confirm transaction with detectedAmountEgp recorded)
      } else {
        // Flag for manual review as OVERPAID
        const updated = await db.transaction.update({
          where: { id: match.id },
          data: {
            status: 'OVERPAID',
            detectedRef: reference,
            detectedAt: now,
            detectedAmountEgp: receivedAmountRounded,
            detectedAmountCents: receivedAmountCents,
          },
        })

        emitCheckoutUpdate({
          sessionId: updated.sessionId,
          status: 'OVERPAID',
          amountEgp: updated.amountEgp,
          detectedAmountEgp: updated.detectedAmountEgp,
          senderHandle: updated.senderHandle,
          detectedRef: updated.detectedRef,
          detectedAt: updated.detectedAt?.toISOString(),
        })

        if (client.webhookUrl) {
          void forwardToClientWebhook(client.id, client.webhookUrl, client.webhookSecret, {
            event: 'payment.overpaid',
            clientId: client.id,
            businessName: client.businessName,
            transaction: {
              sessionId: updated.sessionId,
              senderHandle: updated.senderHandle,
              recipientHandle: updated.recipientHandle,
              amountEgp: egpAmountFromRow(match),
              detectedAmountEgp: updated.detectedAmountEgp,
              currency: updated.currency,
              status: updated.status,
              detectedRef: updated.detectedRef,
              detectedAt: updated.detectedAt?.toISOString() ?? null,
              note: updated.note,
              createdAt: updated.createdAt.toISOString(),
            },
          })
        }

        return {
          ok: true,
          matched: false,
          reason: 'OVERPAID',
          sessionId: updated.sessionId,
          status: updated.status,
          received: { senderHandle, amountEgp: receivedAmountRounded, reference },
        }
      }
    }
  }

  // 9. Confirm Transaction Atomically (Idempotent)
  const confirmed = await db.transaction.updateMany({
    where: { id: match.id, status: { in: ['PENDING', 'EXPIRED', 'UNDERPAID', 'OVERPAID'] } },
    data: {
      status: 'CONFIRMED',
      senderHandle,
      detectedRef: reference,
      detectedAt: now,
      detectedAmountEgp: receivedAmountRounded,
      detectedAmountCents: receivedAmountCents,
    },
  })

  if (confirmed.count === 0) {
    // Already confirmed previously
    return {
      ok: true,
      matched: true,
      duplicate: true,
      sessionId: match.sessionId,
      status: match.status,
      received: { senderHandle, amountEgp: receivedAmountRounded, reference },
    }
  }

  const updatedTx = await db.transaction.findUniqueOrThrow({
    where: { id: match.id },
  })

  // 10. Handle Subscription Renewal or Bundle Top-Up if this was a subscription/bundle payment
  if (updatedTx.purpose === 'SUBSCRIPTION' && updatedTx.subscriptionPlanName) {
    // ─── Handle Top-Up Bundle Purchase ─────────────────────────────
    if (updatedTx.subscriptionPlanName.startsWith('BUNDLE:')) {
      const bundleName = updatedTx.subscriptionPlanName.replace('BUNDLE:', '')
      try {
        // Find and confirm the bundle purchase record
        const bundlePurchase = await (db as any).bundlePurchase.findFirst({
          where: { sessionId: updatedTx.sessionId, clientId: client.id, status: 'PENDING' },
          include: { bundle: true },
        })

        if (bundlePurchase) {
          const extraTx = bundlePurchase.extraTx || bundlePurchase.bundle?.extraTx || 0

          // Increment merchant's txLimit by the bundle's extra transactions
          await db.client.update({
            where: { id: client.id },
            data: { txLimit: { increment: extraTx } },
          })

          // Mark the bundle purchase as confirmed
          await (db as any).bundlePurchase.update({
            where: { id: bundlePurchase.id },
            data: { status: 'CONFIRMED' },
          })

          await db.auditLog.create({
            data: {
              action: 'BUNDLE_PURCHASED',
              details: `Merchant ${client.businessName} purchased ${bundlePurchase.bundle?.displayName || bundleName} bundle (+${extraTx} tx, ${bundlePurchase.priceEgp} EGP) via session ${updatedTx.sessionId}`,
            },
          }).catch(() => {})

          await db.merchantNotification.create({
            data: {
              clientId: client.id,
              title: 'Extra Bundle Activated! 🎉',
              message: `Your ${bundlePurchase.bundle?.displayName || bundleName} top-up has been applied! +${extraTx} extra transactions added to your quota.`,
              severity: 'SUCCESS',
            },
          }).catch(() => {})

          console.log(`[matcher] Bundle ${bundleName} activated for merchant ${client.businessName}: +${extraTx} tx`)
        } else {
          console.warn(`[matcher] Bundle purchase record not found for session ${updatedTx.sessionId}`)
        }
      } catch (bundleErr) {
        console.error('[matcher] Failed to process bundle purchase:', bundleErr)
      }
    } else {
      // ─── Handle Normal Subscription Plan Activation ──────────────
      const plan = await db.plan.findUnique({
        where: { name: updatedTx.subscriptionPlanName },
      })
      if (plan) {
        // Re-fetch fresh client state to obtain current subscription ends date
        const freshClient = await db.client.findUnique({ where: { id: client.id } })
        const nowMs = Date.now()
        const currentEndMs = freshClient?.subscriptionEndsAt ? new Date(freshClient.subscriptionEndsAt).getTime() : 0
        const trialPlan = await db.plan.findUnique({ where: { name: 'FREE_TRIAL' } })
        const remainingTrialMs = Math.max(0, currentEndMs - nowMs)
        let bonusDays = Math.ceil(remainingTrialMs / (24 * 60 * 60 * 1000))
        if (trialPlan?.periodDays && bonusDays > trialPlan.periodDays) {
          bonusDays = trialPlan.periodDays
        }
        const basePeriodDays = plan.periodDays || 30
        const totalPeriodDays = basePeriodDays + bonusDays
        const newEndsAt = new Date(nowMs + totalPeriodDays * 24 * 60 * 60 * 1000)

        await db.client.update({
          where: { id: client.id },
          data: {
            subscriptionPlan: plan.name,
            subscriptionEndsAt: newEndsAt,
            isFreeTrial: false,
            txLimit: plan.maxTransactions,
            txCount: 0,
          },
        })
        await db.auditLog
          .create({
            data: {
              action: 'SUBSCRIPTION_ACTIVATED',
              details: `Activated ${plan.name} for merchant ${client.businessName} (Total: ${totalPeriodDays} days: ${basePeriodDays} plan + ${bonusDays} trial rollover, Limit: ${plan.maxTransactions} txs) via session ${updatedTx.sessionId}`,
            },
          })
          .catch(() => {})

        await db.merchantNotification
          .create({
            data: {
              clientId: client.id,
              title: 'Plan Activated Successfully',
              message:
                bonusDays > 0
                  ? `Your ${plan.name} plan is now active for ${totalPeriodDays} days (${basePeriodDays} days + ${bonusDays} rollover days from your trial)! Quota refreshed to ${plan.maxTransactions} transactions.`
                  : `Your ${plan.name} plan is now active for ${totalPeriodDays} days! Quota refreshed to ${plan.maxTransactions} transactions.`,
              severity: 'SUCCESS',
            },
          })
          .catch(() => {})
      }
    }
  } else {
    // Increment normal checkout transaction quota
    await db.client
      .update({
        where: { id: client.id },
        data: { txCount: { increment: 1 } },
      })
      .catch((err) => {
        console.error('[matcher] Failed to increment merchant txCount:', err)
      })
  }

  // 11. Real-time broadcast to Customer Checkout waiting screen
  emitCheckoutUpdate({
    sessionId: updatedTx.sessionId,
    status: 'CONFIRMED',
    amountEgp: updatedTx.amountEgp,
    detectedAmountEgp: updatedTx.detectedAmountEgp,
    senderHandle: updatedTx.senderHandle,
    detectedRef: updatedTx.detectedRef,
    detectedAt: updatedTx.detectedAt?.toISOString() ?? null,
  })

  // 12. Deliver signed webhook callback to Merchant server
  if (client.webhookUrl) {
    void forwardToClientWebhook(client.id, client.webhookUrl, client.webhookSecret, {
      event:
        updatedTx.purpose === 'SUBSCRIPTION'
          ? 'subscription.payment_confirmed'
          : 'payment.confirmed',
      clientId: client.id,
      businessName: client.businessName,
      transaction: {
        sessionId: updatedTx.sessionId,
        senderHandle: updatedTx.senderHandle,
        recipientHandle: updatedTx.recipientHandle,
        amountEgp: updatedTx.amountEgp,
        detectedAmountEgp: updatedTx.detectedAmountEgp,
        currency: updatedTx.currency,
        status: updatedTx.status,
        detectedRef: updatedTx.detectedRef,
        detectedAt: updatedTx.detectedAt?.toISOString() ?? null,
        note: updatedTx.note,
        createdAt: updatedTx.createdAt.toISOString(),
      },
    })
  }

  return {
    ok: true,
    matched: true,
    duplicate: false,
    sessionId: updatedTx.sessionId,
    status: updatedTx.status,
    received: { senderHandle, amountEgp: receivedAmountRounded, reference },
  }
}
