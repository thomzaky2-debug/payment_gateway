import { db } from '../db.js'
import crypto from 'crypto'
import { toEgpCents, fromEgpCents, egpAmountFromRow } from '../lib/money.js'
import { emitCheckoutUpdate } from './notificationService.js'
import { forwardToClientWebhook } from './webhookService.js'
import { confirmOrdinaryCheckout } from './settlementService.js'
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

  const occurredAt = input.notificationTimestamp ? new Date(input.notificationTimestamp) : null
  if (occurredAt && !Number.isFinite(occurredAt.getTime())) {
    throw new Error('notificationTimestamp must be a valid timestamp.')
  }

  const sourceIdentity = (input.eventId || reference || '').trim()
  if (!sourceIdentity && !occurredAt) {
    throw new Error('A payment reference, eventId, or notificationTimestamp is required for replay protection.')
  }
  const eventKey = crypto
    .createHash('sha256')
    .update([
      client.id,
      sourceIdentity || 'timestamp-event',
      senderHandle,
      String(receivedAmountCents),
      occurredAt?.toISOString() || '',
    ].join('|'))
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
    return {
      ok: true,
      matched: existingEvent?.result === 'CONFIRMED',
      duplicate: true,
      reason: 'DUPLICATE_NOTIFICATION',
      sessionId: existingEvent?.sessionId || undefined,
      status: existingEvent?.result,
      received: { senderHandle, amountEgp: receivedAmountRounded, reference },
    }
  }

  const finalizeIncomingEvent = (result: string, sessionId?: string) =>
    db.incomingPaymentEvent.update({
      where: { id: incomingEventId },
      data: { result, sessionId: sessionId || null },
    }).catch(() => null)

  const now = new Date()
  const GRACE_PERIOD_MS = 30 * 60 * 1000 // 30 minutes grace period
  const graceCutoff = new Date(now.getTime() - GRACE_PERIOD_MS)

  // 3. Matching Step 1: Exact match with active PENDING checkouts
  let match = await db.transaction.findFirst({
    where: {
      clientId: client.id,
      purpose: 'CHECKOUT',
      recipientHandle: client.instapayHandle,
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
        recipientHandle: client.instapayHandle,
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
        purpose: 'CHECKOUT',
        recipientHandle: client.instapayHandle,
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
        purpose: 'CHECKOUT',
        recipientHandle: client.instapayHandle,
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

    await finalizeIncomingEvent('UNMATCHED')

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

        await finalizeIncomingEvent('UNDERPAID', updated.sessionId)

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

        await finalizeIncomingEvent('OVERPAID', updated.sessionId)

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
    await finalizeIncomingEvent('DUPLICATE_TRANSACTION', match.sessionId)
    // Already confirmed previously
    return {
      ok: true,
      matched: true,
      duplicate: true,
      sessionId: match.sessionId,
      status: settlement?.transaction.status ?? match.status,
      received: { senderHandle, amountEgp: receivedAmountRounded, reference },
    }
  }

  const updatedTx = settlement.transaction
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

  // 11. Deliver signed webhook callback to Merchant server
  if (client.webhookUrl) {
    void forwardToClientWebhook(client.id, client.webhookUrl, client.webhookSecret, {
      event: 'payment.confirmed',
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
