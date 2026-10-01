import crypto from 'crypto'
import { db } from '../db.js'
import { toEgpCents } from '../lib/money.js'
import { normalizeHandle } from './matcherService.js'
import type { Client } from '@prisma/client'

export interface CreateCheckoutInput {
  client: Client
  amountEgp: number
  senderHandle?: string | null
  note?: string | null
  purpose?: 'CHECKOUT' | 'SUBSCRIPTION'
  subscriptionPlanName?: string | null
}

export interface CheckoutResult {
  sessionId: string
  status: string
  amountEgp: number
  currency: string
  deepLinkUrl: string
  checkoutUrl: string
  recipientHandle: string
  senderHandle: string
  expiresAt: string
}

export async function createCheckoutSession(
  input: CreateCheckoutInput
): Promise<CheckoutResult> {
  const { client, amountEgp, note, purpose = 'CHECKOUT', subscriptionPlanName } = input

  // Check quota if checkout is for customer payment
  if (purpose === 'CHECKOUT') {
    if (client.subscriptionEndsAt && new Date(client.subscriptionEndsAt).getTime() < Date.now()) {
      throw new Error('Subscription expired. Please upgrade or renew your plan.')
    }
    if (client.txCount >= client.txLimit) {
      throw new Error(`Transaction limit reached (${client.txCount}/${client.txLimit}). Upgrade your plan.`)
    }
  }

  if (!amountEgp || amountEgp <= 0) {
    throw new Error('amountEgp must be a positive number')
  }

  const sender = input.senderHandle?.trim()
    ? normalizeHandle(input.senderHandle)
    : 'pending@instapay'

  const ttlMin = client.checkoutTtlMin || 10
  const expiresAt = new Date(Date.now() + ttlMin * 60 * 1000)
  const sessionId = `cmt_${crypto.randomBytes(12).toString('hex')}`
  const deepLinkToken = crypto.randomBytes(8).toString('hex')

  // Reuse static payment URL if configured, otherwise fallback to standard deep link pattern
  const deepLinkUrl =
    client.instapayPaymentUrl?.trim() ||
    `https://ipn.eg/S/${client.instapayHandle.replace(/@instapay$/i, '')}/instapay/${deepLinkToken}`

  const amountCents = toEgpCents(amountEgp)

  const transaction = await db.transaction.create({
    data: {
      sessionId,
      clientId: client.id,
      senderHandle: sender,
      recipientHandle: client.instapayHandle,
      amountEgp,
      amountCents,
      currency: 'EGP',
      status: 'PENDING',
      purpose,
      subscriptionPlanName,
      note,
      deepLinkUrl,
      deepLinkToken,
      expiresAt,
    },
  })

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173'
  const checkoutUrl = `${clientUrl}/pay/${sessionId}`

  return {
    sessionId: transaction.sessionId,
    status: transaction.status,
    amountEgp: transaction.amountEgp,
    currency: transaction.currency,
    deepLinkUrl: transaction.deepLinkUrl,
    checkoutUrl,
    recipientHandle: transaction.recipientHandle,
    senderHandle: transaction.senderHandle,
    expiresAt: transaction.expiresAt.toISOString(),
  }
}

export async function getCheckoutSession(sessionId: string) {
  const tx = await db.transaction.findUnique({
    where: { sessionId },
    include: {
      client: {
        select: {
          businessName: true,
          instapayHandle: true,
          instapayPaymentUrl: true,
          checkoutTtlMin: true,
          isFreeTrial: true,
          subscriptionPlan: true,
          subscriptionEndsAt: true,
        },
      },
    },
  })

  if (!tx) return null

  // Auto-expire check
  if (tx.status === 'PENDING' && new Date() > tx.expiresAt) {
    return {
      ...tx,
      status: 'EXPIRED',
    }
  }

  return tx
}
