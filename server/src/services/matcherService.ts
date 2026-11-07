import { db } from '../db.js'
import crypto from 'crypto'
import { toEgpCents, fromEgpCents } from '../lib/money.js'
import { emitCheckoutUpdate } from './notificationService.js'
import { confirmOrdinaryCheckout, enqueueWebhookOutbox } from './settlementService.js'
import { kickWebhookWorker } from '../workers/webhookRetryWorker.js'
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
  eventId?: string | null
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
  let h = (raw || '').trim().toLowerCase().replace(/^@/, '')
  if (!h) return ''
  let local = h.split('@')[0]
  if (!local) return ''
  // Normalize Egyptian phone numbers (e.g. +201..., 201..., 01... -> 01...)
  const phoneMatch = local.match(/^(?:\+?20|0)?(1[0125]\d{8})$/)
  if (phoneMatch) {
    local = `0${phoneMatch[1]}`
  }
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
const IN_FLIGHT_EVENT_WINDOW_MS = 2 * 60 * 1000
// Statuses a notification may move into UNDERPAID/OVERPAID review.
const MISMATCH_SOURCE_STATUSES = ['PENDING', 'EXPIRED']

async function recordMismatchedPayment(data: {
  clientId: string
  senderHandle: string
  amountEgp: number
  amountCents: number
  reference: string | null
  status: string
}) {
  try {
    await db.mismatchedPayment.create({ data })
  } catch (err) {
    console.error('[matcher] Failed to save mismatched payment:', err)
  }
}

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

  const occurredAt = input.notificationTimestamp ? new Date(input.notificationTimestamp) : null
  if (occurredAt && !Number.isFinite(occurredAt.getTime())) {
    throw new Error('notificationTimestamp must be a valid timestamp.')
  }

  // ─── Enforce One Confirmed Checkout Per Bank Reference Per Client ───
  if (reference) {
    const existingConfirmedTx = await db.transaction.findFirst({
      where: {
        clientId: client.id,
        detectedRef: reference,
        status: 'CONFIRMED',
      },
    })
    if (existingConfirmedTx) {
      console.warn(`[matcher] Replay blocked: Bank reference "${reference}" already confirmed session ${existingConfirmedTx.sessionId}`)
      return {
        ok: true,
        matched: false,
        duplicate: true,
        reason: 'DUPLICATE_REFERENCE_ALREADY_CONFIRMED',
        sessionId: existingConfirmedTx.sessionId,
        received: { senderHandle, amountEgp: receivedAmountRounded, reference },
      }
    }
  }

  const sourceIdentity = (input.eventId || reference || '').trim()
  if (!sourceIdentity && !occurredAt) {
    throw new Error('A payment reference, eventId, or notificationTimestamp is required for replay protection.')
  }

  // Deduplicate on eventId if provided, or bank reference, or identity tuple
  const cleanEventId = (input.eventId || '').trim()
  const eventKey = crypto
    .createHash('sha256')
    .update(
      cleanEventId
        ? [client.id, 'event-id', cleanEventId].join('|')
        : reference
          ? [client.id, 'bank-ref', reference].join('|')
          : [
              client.id,
              sourceIdentity || 'timestamp-event',
              senderHandle,
              String(receivedAmountCents),
              occurredAt?.toISOString() || '',
            ].join('|')
    )
    .digest('hex')

  let incomingEventId: string
  try {
    const incomingEvent = await db.incomingPaymentEvent.create({
      data: {
        eventKey,
        clientId: client.id,
        reference,
        senderHandle,
        amountCents: receivedAmountCents,
        occurredAt,
      },
      select: { id: true },
    })
    incomingEventId = incomingEvent.id
  } catch (err: any) {
    if (err?.code !== 'P2002') throw err
    const existingEvent = await db.incomingPaymentEvent.findUnique({ where: { eventKey } })

    // If an earlier attempt ALREADY matched or confirmed a checkout, reject as duplicate replay
    if (existingEvent?.result === 'CONFIRMED' || existingEvent?.sessionId) {
      return {
        ok: true,
        matched: true,
        duplicate: true,
        reason: 'DUPLICATE_NOTIFICATION',
        sessionId: existingEvent.sessionId || undefined,
        status: existingEvent.result || 'CONFIRMED',
        received: { senderHandle, amountEgp: receivedAmountRounded, reference },
      }
    }

    // A concurrent delivery of the same event is still being matched; letting it
    // through would let one payment confirm two same-amount checkouts.
    if (
      existingEvent?.result === 'PROCESSING' &&
      Date.now() - new Date(existingEvent.createdAt).getTime() < IN_FLIGHT_EVENT_WINDOW_MS
    ) {
      return {
        ok: true,
        matched: false,
        duplicate: true,
        reason: 'DUPLICATE_IN_FLIGHT',
        received: { senderHandle, amountEgp: receivedAmountRounded, reference },
      }
    }

    // If previous attempt was UNMATCHED (e.g. offline detector retry before checkout was created),
    // allow this retry to re-evaluate matching against currently pending checkouts
    incomingEventId = existingEvent?.id || ''
  }

  const finalizeIncomingEvent = (result: string, sessionId?: string) => {
    if (!incomingEventId) return Promise.resolve(null)
    return db.incomingPaymentEvent.update({
      where: { id: incomingEventId },
      data: { result, sessionId: sessionId || null },
    }).catch(() => null)
  }

  const now = new Date()
  const GRACE_PERIOD_MS = 30 * 60 * 1000 // 30 minutes grace period
  const graceCutoff = new Date(now.getTime() - GRACE_PERIOD_MS)

  // 3. Matching Step 1: Exact match with active PENDING checkouts
  let match = await db.transaction.findFirst({
    where: {
      clientId: client.id,
      purpose: 'CHECKOUT',
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
        purpose: 'CHECKOUT',
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
  // Set when several checkouts could plausibly own this payment. The matcher
  // never guesses between them; the merchant resolves it from the review queue.
  let ambiguousCandidates = false

  // 5. Matching Step 3: Match by senderHandle (Check for underpayment/overpayment)
  if (!match) {
    const senderCandidates = await db.transaction.findMany({
      where: {
        clientId: client.id,
        purpose: 'CHECKOUT',
        senderHandle,
        status: { in: ['PENDING', 'EXPIRED'] },
        expiresAt: { gte: graceCutoff },
      },
      orderBy: { createdAt: 'asc' },
      take: 2,
    })
    if (senderCandidates.length === 1) {
      match = senderCandidates[0]
      isMismatchedAmount = true
    } else if (senderCandidates.length > 1) {
      ambiguousCandidates = true
      console.warn(`[matcher] Tier 3 ambiguous: ${senderHandle} has several open checkouts with other amounts; routing to review`)
    }
  }

  // 6. Matching Step 4: Checkout amount fallback (handles open checkouts and active sessions)
  if (!match && !ambiguousCandidates) {
    const potentialMatches = await db.transaction.findMany({
      where: {
        clientId: client.id,
        purpose: 'CHECKOUT',
        amountCents: receivedAmountCents,
        amountEgp: receivedAmountRounded,
        status: { in: ['PENDING', 'EXPIRED'] },
        expiresAt: { gte: graceCutoff },
      },
      orderBy: { createdAt: 'asc' },
    })

    // Priority A: Single active PENDING checkout
    const activePendingMatches = potentialMatches.filter(
      (m) => m.status === 'PENDING' && m.expiresAt > now
    )

    if (activePendingMatches.length === 1) {
      const candidate = activePendingMatches[0]
      if (candidate.senderHandle === 'pending@instapay' || normalizeHandle(candidate.senderHandle) === senderHandle) {
        match = candidate
        console.log(`[matcher] Fallback matched single active pending checkout: ${match.sessionId}`)
      }
    } else if (activePendingMatches.length > 1) {
      // Several active checkouts share this amount. Only an unambiguous owner may be
      // confirmed: the one whose declared payer matches, or the only open (no payer)
      // checkout. Anything else would hand one customer's payment to another.
      const matchedSender = activePendingMatches.find(
        (m) => normalizeHandle(m.senderHandle) === senderHandle
      )
      const openCandidates = activePendingMatches.filter(
        (m) => m.senderHandle === 'pending@instapay'
      )
      if (matchedSender) {
        match = matchedSender
        console.log(`[matcher] Fallback matched declared payer among active pending checkouts: ${match.sessionId}`)
      } else if (openCandidates.length === 1) {
        match = openCandidates[0]
        console.log(`[matcher] Fallback matched the only open pending checkout: ${match.sessionId}`)
      } else {
        ambiguousCandidates = true
        console.warn(`[matcher] Tier 4 ambiguous: ${activePendingMatches.length} active checkouts for ${receivedAmountRounded} EGP and no unique owner; routing to review`)
      }
    } else if (potentialMatches.length === 1) {
      const candidate = potentialMatches[0]
      if (candidate.senderHandle === 'pending@instapay' || normalizeHandle(candidate.senderHandle) === senderHandle) {
        match = candidate
        console.log(`[matcher] Fallback matched grace-period checkout: ${match.sessionId}`)
      } else {
        // Cross-payer protection: Expected a specific sender but received from someone else
        console.warn(`[matcher] Tier 4 mismatch: ${candidate.sessionId} expected ${candidate.senderHandle} but payment received from ${senderHandle}`)
        await recordMismatchedPayment({
          clientId: client.id,
          senderHandle,
          amountEgp: receivedAmountRounded,
          amountCents: receivedAmountCents,
          reference,
          status: 'SENDER_MISMATCH',
        })
      }
    }
  }

  // 7. Unmatched / Orphaned / Ambiguous Payment
  if (!match) {
    await recordMismatchedPayment({
      clientId: client.id,
      senderHandle,
      amountEgp: receivedAmountRounded,
      amountCents: receivedAmountCents,
      reference,
      status: 'UNMATCHED',
    })

    await finalizeIncomingEvent(ambiguousCandidates ? 'AMBIGUOUS' : 'UNMATCHED')

    return {
      ok: true,
      matched: false,
      reason: ambiguousCandidates ? 'AMBIGUOUS_CANDIDATES' : 'NO_PENDING_CHECKOUT',
      received: { senderHandle, amountEgp: receivedAmountRounded, reference },
    }
  }

  // 8. Handle Amount Discrepancies (Underpayment vs Overpayment with Merchant Tolerance Policy)
  if (isMismatchedAmount) {
    const requestedAmountCents = match.amountCents ?? toEgpCents(match.amountEgp)

    // Moves the checkout into a review status only while it is still open, so a
    // concurrent confirmation is never overwritten. A lost race keeps this
    // payment visible in the review queue instead of silently dropping it.
    const flagForReview = async (reviewStatus: 'UNDERPAID' | 'OVERPAID', webhookEvent: string): Promise<MatchResult> => {
      const updated = await db.$transaction(async (txDb) => {
        const changed = await txDb.transaction.updateMany({
          where: { id: match.id, clientId: client.id, status: { in: MISMATCH_SOURCE_STATUSES } },
          data: {
            status: reviewStatus, detectedRef: reference, detectedAt: now,
            detectedAmountEgp: receivedAmountRounded, detectedAmountCents: receivedAmountCents,
          },
        })
        if (changed.count !== 1) return null
        const row = await txDb.transaction.findUniqueOrThrow({ where: { id: match.id } })
        await enqueueWebhookOutbox(txDb, row, client, webhookEvent)
        return row
      })

      if (!updated) {
        await recordMismatchedPayment({
          clientId: client.id,
          senderHandle,
          amountEgp: receivedAmountRounded,
          amountCents: receivedAmountCents,
          reference,
          status: 'UNMATCHED',
        })
        await finalizeIncomingEvent('UNMATCHED')
        return {
          ok: true,
          matched: false,
          reason: 'CHECKOUT_ALREADY_SETTLED',
          sessionId: match.sessionId,
          received: { senderHandle, amountEgp: receivedAmountRounded, reference },
        }
      }

      emitCheckoutUpdate({
        sessionId: updated.sessionId,
        status: reviewStatus,
        amountEgp: updated.amountEgp,
        detectedAmountEgp: updated.detectedAmountEgp,
        senderHandle: updated.senderHandle,
        detectedRef: updated.detectedRef,
        detectedAt: updated.detectedAt?.toISOString(),
      })

      void kickWebhookWorker()

      await finalizeIncomingEvent(reviewStatus, updated.sessionId)

      return {
        ok: true,
        matched: false,
        reason: reviewStatus,
        sessionId: updated.sessionId,
        status: updated.status,
        received: { senderHandle, amountEgp: receivedAmountRounded, reference },
      }
    }

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
        return flagForReview('UNDERPAID', 'payment.underpaid')
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
        return flagForReview('OVERPAID', 'payment.overpaid')
      }
    }
  }

  // 9. Settle only ordinary checkouts. The state transition and quota counter
  // update share one transaction so no reservation-to-count gap is observable.
  const settlement = await confirmOrdinaryCheckout({
    transactionId: match.id,
    clientId: client.id,
    allowedStatuses: ['PENDING', 'EXPIRED', 'UNDERPAID', 'OVERPAID'],
    senderHandle,
    detectedRef: reference,
    detectedAt: now,
    detectedAmountEgp: receivedAmountRounded,
    detectedAmountCents: receivedAmountCents,
  })

  if (!settlement || !settlement.newlyConfirmed) {
    const settled = settlement?.transaction
    // A lost race against the same payment (same bank reference, or same payer and
    // amount when references are absent) is a duplicate. Anything else is a real
    // second payment that must stay visible in the review queue.
    const samePayment =
      !!settled &&
      (reference && settled.detectedRef
        ? settled.detectedRef === reference
        : normalizeHandle(settled.senderHandle) === senderHandle &&
          (settled.detectedAmountCents ?? settled.amountCents) === receivedAmountCents)
    if (!samePayment) {
      await recordMismatchedPayment({
        clientId: client.id,
        senderHandle,
        amountEgp: receivedAmountRounded,
        amountCents: receivedAmountCents,
        reference,
        status: 'UNMATCHED',
      })
      await finalizeIncomingEvent('UNMATCHED')
      return {
        ok: true,
        matched: false,
        reason: 'CHECKOUT_ALREADY_SETTLED',
        sessionId: match.sessionId,
        status: settled?.status ?? match.status,
        received: { senderHandle, amountEgp: receivedAmountRounded, reference },
      }
    }

    await finalizeIncomingEvent('DUPLICATE_TRANSACTION', match.sessionId)
    // Already confirmed previously
    return {
      ok: true,
      matched: true,
      duplicate: true,
      sessionId: match.sessionId,
      status: settled?.status ?? match.status,
      received: { senderHandle, amountEgp: receivedAmountRounded, reference },
    }
  }

  const updatedTx = settlement.transaction
  void kickWebhookWorker()
  await finalizeIncomingEvent('CONFIRMED', updatedTx.sessionId)

  // 10. Real-time broadcast to Customer Checkout waiting screen
  emitCheckoutUpdate({
    sessionId: updatedTx.sessionId,
    status: 'CONFIRMED',
    amountEgp: updatedTx.amountEgp,
    detectedAmountEgp: updatedTx.detectedAmountEgp,
    senderHandle: updatedTx.senderHandle,
    detectedRef: updatedTx.detectedRef,
    detectedAt: updatedTx.detectedAt?.toISOString() ?? null,
  })

  // Confirmation webhook is already queued transactionally by
  // confirmOrdinaryCheckout; the retry worker performs the network delivery.

  return {
    ok: true,
    matched: true,
    duplicate: false,
    sessionId: updatedTx.sessionId,
    status: updatedTx.status,
    received: { senderHandle, amountEgp: receivedAmountRounded, reference },
  }
}
