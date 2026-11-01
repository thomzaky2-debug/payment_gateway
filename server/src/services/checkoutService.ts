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
  idempotencyKey?: string
  amountEgp?: number
  senderHandle?: string | null
  note?: string | null
  productCategory?: string | null
  items?: OrderItem[] | null
  purpose?: 'CHECKOUT' | 'SUBSCRIPTION'
  subscriptionPlanName?: string | null
  returnUrl?: string | null
  redirectUrl?: string | null
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
  returnUrl?: string | null
}

const SERIALIZABLE_RETRY_LIMIT = 5

function isSerializableConflict(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      ['P2034', 'P2002'].includes(String((error as { code?: unknown }).code))
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

export class CheckoutIdempotencyConflict extends CheckoutValidationError {
  status = 409
}

export class CheckoutCapacityBusyError extends CheckoutValidationError {
  status = 503
}

export async function createCheckoutSession(
  input: CreateCheckoutInput
): Promise<CheckoutResult> {
  const key = input.idempotencyKey;
  if (key && input.purpose && input.purpose !== 'CHECKOUT') throw new CheckoutValidationError('Idempotency keys are supported for ordinary checkout sessions only.');
  if (key !== undefined && (typeof key !== 'string' || !/^[A-Za-z0-9._:-]{8,128}$/.test(key))) {
    throw new CheckoutValidationError('Idempotency-Key must contain 8–128 letters, numbers, dots, colons, underscores or hyphens.');
  }
  if (input.senderHandle != null && (typeof input.senderHandle !== 'string' || input.senderHandle.length > 200)) throw new CheckoutValidationError('senderHandle must be text up to 200 characters.');
  if (input.note != null && (typeof input.note !== 'string' || input.note.length > 1000)) throw new CheckoutValidationError('note must be text up to 1000 characters.');
  const rawReturnUrl = input.returnUrl || input.redirectUrl || null;
  if (rawReturnUrl !== null && typeof rawReturnUrl !== 'string') throw new CheckoutValidationError('returnUrl must be a URL string.');
  const validReturnUrl = rawReturnUrl?.trim() || null;
  if (validReturnUrl) {
    let valid = false;
    try { const url = new URL(validReturnUrl); valid = ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; } catch { valid = validReturnUrl.startsWith('/') && !validReturnUrl.startsWith('//'); }
    if (!valid || /[\\\x00-\x1f\x7f]/.test(validReturnUrl)) throw new CheckoutValidationError('returnUrl must be an HTTP(S) URL or a local absolute path.');
  }
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

  const { client, purpose = 'CHECKOUT', subscriptionPlanName } = input

  const note = input.note?.trim() || null
  let amountEgp = input.amountEgp
  if (sanitizedItems && sanitizedItems.length > 0) {
    const itemsSum = Math.round(sanitizedItems.reduce((acc, it) => acc + (it.totalPrice || 0), 0) * 100) / 100
    if (amountEgp == null || isNaN(Number(amountEgp))) {
      amountEgp = itemsSum
    } else if (toEgpCents(Number(amountEgp)) !== toEgpCents(itemsSum)) {
      throw new CheckoutValidationError('amountEgp must match the total of the supplied items')
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

  const idempotencyKeyHash = key ? crypto.createHash('sha256').update(key).digest('hex') : null;
  const idempotencyRequestHash = key ? crypto.createHash('sha256').update(JSON.stringify({
    amountCents, sender, note, productCategory, items: sanitizedItems, purpose,
    subscriptionPlanName: subscriptionPlanName || null, returnUrl: validReturnUrl,
  })).digest('hex') : null;

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
        ...(key ? { idempotencyKeyHash, idempotencyRequestHash } : {}),
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
        if (idempotencyKeyHash) {
          const existing = await transactionDb.transaction.findUnique({ where: {
            clientId_idempotencyKeyHash: { clientId: freshClient.id, idempotencyKeyHash },
          } });
          if (existing) {
            if (existing.idempotencyRequestHash !== idempotencyRequestHash) throw new CheckoutIdempotencyConflict('Idempotency-Key was already used with different checkout details. Use the original request or a new key for a new order.');
            return existing;
          }
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
  const checkoutUrl = validReturnUrl
    ? `${clientUrl}/pay/${transaction.sessionId}?returnUrl=${encodeURIComponent(validReturnUrl)}`
    : `${clientUrl}/pay/${transaction.sessionId}`

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
    returnUrl: validReturnUrl,
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
          webhookUrl: true,
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
