import crypto from 'crypto'
import { db } from '../db.js'
import { toEgpCents } from '../lib/money.js'
import { normalizeHandle } from './matcherService.js'
import { Prisma, type Client } from '@prisma/client'

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

const SERIALIZABLE_RETRY_LIMIT = 5

function isSerializableConflict(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2034'
  )
}

async function waitForSerializableRetry(attempt: number): Promise<void> {
  const exponentialDelayMs = Math.min(10 * 2 ** attempt, 100)
  const jitterMs = Math.floor(Math.random() * 10)
  await new Promise((resolve) => setTimeout(resolve, exponentialDelayMs + jitterMs))
}

async function runSerializableCheckout<T>(
  operation: (transactionDb: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  for (let attempt = 0; attempt < SERIALIZABLE_RETRY_LIMIT; attempt += 1) {
    try {
      return await db.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      })
    } catch (error) {
      if (!isSerializableConflict(error)) throw error
      if (attempt === SERIALIZABLE_RETRY_LIMIT - 1) {
        throw new Error('Checkout capacity is busy. Please retry your request.')
      }
      await waitForSerializableRetry(attempt)
    }
  }

  throw new Error('Checkout capacity is busy. Please retry your request.')
}

export async function createCheckoutSession(
  input: CreateCheckoutInput
): Promise<CheckoutResult> {
  const { client, amountEgp, note, purpose = 'CHECKOUT', subscriptionPlanName } = input

  if (!amountEgp || !Number.isFinite(amountEgp) || amountEgp <= 0) {
    throw new Error('amountEgp must be a positive finite number')
  }

  if (amountEgp > 10_000_000) {
    throw new Error('amountEgp exceeds the maximum allowed transaction limit (10,000,000 EGP)')
  }

  const cleanAmountEgp = Math.round(amountEgp * 100) / 100

  const sender = input.senderHandle?.trim()
    ? normalizeHandle(input.senderHandle)
    : 'pending@instapay'
  const amountCents = toEgpCents(cleanAmountEgp)

  const createTransaction = (
    transactionDb: Pick<Prisma.TransactionClient, 'transaction'>,
    effectiveClient: Client,
    now: Date
  ) => {
    const ttlMin = effectiveClient.checkoutTtlMin || 10
    const expiresAt = new Date(now.getTime() + ttlMin * 60 * 1000)
    const sessionId = `cmt_${crypto.randomBytes(12).toString('hex')}`
    const deepLinkToken = crypto.randomBytes(8).toString('hex')
    const deepLinkUrl =
      effectiveClient.instapayPaymentUrl?.trim() ||
      `https://ipn.eg/S/${effectiveClient.instapayHandle.replace(/@instapay$/i, '')}/instapay/${deepLinkToken}`

    return transactionDb.transaction.create({
      data: {
        sessionId,
        clientId: effectiveClient.id,
        senderHandle: sender,
        recipientHandle: effectiveClient.instapayHandle,
        amountEgp: cleanAmountEgp,
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
  }

  const transaction = purpose === 'CHECKOUT'
    ? await runSerializableCheckout(async (transactionDb) => {
        const now = new Date()
        const freshClient = await transactionDb.client.findUnique({ where: { id: client.id } })

        if (!freshClient || freshClient.approvalStatus !== 'APPROVED' || !freshClient.isActive) {
          throw new Error('Merchant account is inactive or not approved.')
        }
        if (
          (freshClient.isFreeTrial || freshClient.subscriptionPlan === 'FREE_TRIAL') &&
          !freshClient.subscriptionEndsAt
        ) {
          throw new Error('Activate your free trial before creating checkout sessions.')
        }
        if (freshClient.subscriptionEndsAt && freshClient.subscriptionEndsAt.getTime() < now.getTime()) {
          throw new Error('Subscription expired. Please upgrade or renew your plan.')
        }

        const activeReservations = await transactionDb.transaction.count({
          where: {
            clientId: freshClient.id,
            purpose: 'CHECKOUT',
            status: 'PENDING',
            expiresAt: { gt: now },
          },
        })
        const usedAndReserved = freshClient.txCount + activeReservations
        if (usedAndReserved >= freshClient.txLimit) {
          throw new Error(
            `Transaction limit reached (${freshClient.txCount} confirmed + ${activeReservations} pending / ${freshClient.txLimit}). Upgrade your plan.`
          )
        }

        return createTransaction(transactionDb, freshClient, now)
      })
    : await createTransaction(db, client, new Date())

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173'
  const checkoutUrl = `${clientUrl}/pay/${transaction.sessionId}`

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
