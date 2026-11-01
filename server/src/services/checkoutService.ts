import crypto from 'crypto'
import { db } from '../db.js'
import { toEgpCents } from '../lib/money.js'
import { normalizeHandle } from './matcherService.js'
import { Prisma, type Client } from '@prisma/client'
import { expirePendingTransactions } from './transactionExpiryService.js'

export interface OrderItem {
  name: string
  quantity: number
  unitPrice: number
  totalPrice?: number
  category?: string
}

export interface CreateCheckoutInput {
  client: Client
  amountEgp?: number
  senderHandle?: string | null
  note?: string | null
  productCategory?: string | null
  items?: OrderItem[] | null
  purpose?: 'CHECKOUT' | 'SUBSCRIPTION'
  subscriptionPlanName?: string | null
}

export interface CheckoutResult {
  productCategory: string | null
  items?: OrderItem[] | null
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
        throw new CheckoutCapacityBusyError('Checkout capacity is busy. Please retry your request.')
      }
      await waitForSerializableRetry(attempt)
    }
  }

  throw new CheckoutCapacityBusyError('Checkout capacity is busy. Please retry your request.')
}

export class CheckoutValidationError extends Error {
  status = 400
}

export class CheckoutCapacityBusyError extends CheckoutValidationError {
  status = 503
}

export async function createCheckoutSession(
  input: CreateCheckoutInput
): Promise<CheckoutResult> {
  if (input.productCategory != null && (typeof input.productCategory !== 'string' || input.productCategory.trim().length > 100)) {
    throw new CheckoutValidationError('Product category must be text with at most 100 characters')
  }
  const productCategory = input.productCategory?.trim() || null

  let sanitizedItems: OrderItem[] | null = null
  if (input.items != null) {
    if (!Array.isArray(input.items) || input.items.length === 0) {
      throw new CheckoutValidationError('items must be a non-empty array of product order items')
    }
    if (input.items.length > 100) {
      throw new CheckoutValidationError('items cannot exceed 100 items per checkout session')
    }
    sanitizedItems = input.items.map((it, idx) => {
      if (!it || typeof it !== 'object') {
        throw new CheckoutValidationError(`Item at index ${idx} must be an object with name, quantity, and unitPrice`)
      }
      const name = typeof it.name === 'string' ? it.name.trim() : ''
      if (!name || name.length > 200) {
        throw new CheckoutValidationError(`Item at index ${idx} must have a valid name (1-200 characters)`)
      }
      const quantity = Number(it.quantity)
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new CheckoutValidationError(`Item "${name}" must have a positive quantity`)
      }
      const unitPrice = Number(it.unitPrice)
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        throw new CheckoutValidationError(`Item "${name}" must have a valid positive unitPrice`)
      }
      const roundedUnitPrice = Math.round(unitPrice * 100) / 100
      const totalPrice = Math.round(quantity * roundedUnitPrice * 100) / 100
      const category = typeof it.category === 'string' && it.category.trim() ? it.category.trim().slice(0, 100) : undefined

      return {
        name,
        quantity,
        unitPrice: roundedUnitPrice,
        totalPrice,
        ...(category ? { category } : {}),
      }
    })
  }

  const { client, note, purpose = 'CHECKOUT', subscriptionPlanName } = input

  let amountEgp = input.amountEgp
  if (sanitizedItems && sanitizedItems.length > 0) {
    const itemsSum = Math.round(sanitizedItems.reduce((acc, it) => acc + (it.totalPrice || 0), 0) * 100) / 100
    if (amountEgp == null || isNaN(Number(amountEgp))) {
      amountEgp = itemsSum
    }
  }

  if (!amountEgp || !Number.isFinite(amountEgp) || amountEgp <= 0) {
    throw new CheckoutValidationError('amountEgp must be a positive finite number')
  }

  if (amountEgp > 10_000_000) {
    throw new CheckoutValidationError('amountEgp exceeds the maximum allowed transaction limit (10,000,000 EGP)')
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
        productCategory,
        items: sanitizedItems ? (sanitizedItems as any) : undefined,
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
          throw new CheckoutValidationError('Merchant account is inactive or not approved.')
        }
        if (
          (freshClient.isFreeTrial || freshClient.subscriptionPlan === 'FREE_TRIAL') &&
          !freshClient.subscriptionEndsAt
        ) {
          throw new CheckoutValidationError('Activate your free trial before creating checkout sessions.')
        }
        if (freshClient.subscriptionEndsAt && freshClient.subscriptionEndsAt.getTime() < now.getTime()) {
          throw new CheckoutValidationError('Subscription expired. Please upgrade or renew your plan.')
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
          throw new CheckoutValidationError(
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
    productCategory: transaction.productCategory,
    items: (transaction.items as unknown as OrderItem[]) ?? null,
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
          profileImageData: true,
        },
      },
    },
  })

  if (!tx) return null

  // Persist expiry so dashboard counts and checkout state agree. Reload after
  // the conditional update because a concurrent confirmation may have won.
  if (tx.status === 'PENDING' && tx.expiresAt.getTime() <= Date.now()) {
    await expirePendingTransactions(tx.clientId, new Date(), tx.id)
    const latest = await db.transaction.findUnique({ where: { sessionId } })
    return latest ? { ...tx, ...latest } : null
  }

  return tx
}
