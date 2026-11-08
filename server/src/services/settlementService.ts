import { db } from '../db.js'
import type { Transaction } from '@prisma/client'
import crypto from 'crypto'

export interface ConfirmOrdinaryCheckoutInput {
  transactionId: string
  clientId: string
  allowedStatuses: string[]
  senderHandle?: string
  detectedRef?: string | null
  detectedAt?: Date
  detectedAmountEgp?: number | null
  detectedAmountCents?: number | null
}

export interface OrdinaryCheckoutSettlement {
  transaction: Transaction
  newlyConfirmed: boolean
}

/**
 * Transactional webhook outbox: confirmation and its delivery intent commit
 * together. The retry worker owns the later network I/O, so a database outage
 * can never silently drop a confirmed-payment notification.
 */
export async function enqueueWebhookOutbox(txDb: any, transaction: any, client: any, event?: string) {
  if (!client?.webhookUrl) return
  const webhookEvent = event || (transaction.purpose === 'SUBSCRIPTION' ? 'subscription.payment_confirmed' : 'payment.confirmed')
  // The event ID lives inside the signed body as well as in the header, so a
  // captured delivery cannot be replayed under a fresh ID to defeat deduplication.
  const eventId = `evt_${crypto.randomBytes(16).toString('hex')}`
  const payload = {
    event: webhookEvent,
    eventId,
    clientId: client.id,
    businessName: client.businessName,
    transaction: {
      sessionId: transaction.sessionId,
      senderHandle: transaction.senderHandle,
      recipientHandle: transaction.recipientHandle,
      amountEgp: transaction.amountEgp,
      detectedAmountEgp: transaction.detectedAmountEgp,
      currency: transaction.currency,
      status: transaction.status,
      detectedRef: transaction.detectedRef,
      detectedAt: transaction.detectedAt?.toISOString() ?? null,
      note: transaction.note,
      productCategory: transaction.productCategory ?? null,
      items: transaction.items ?? null,
      createdAt: transaction.createdAt.toISOString(),
    },
  }
  await txDb.webhookLog.create({
    data: {
      clientId: client.id,
      url: client.webhookUrl,
      event: webhookEvent,
      eventId,
      payload: JSON.stringify(payload),
      isSuccess: false,
      attempt: 0,
      nextAttemptAt: new Date(),
      outcomeKnown: true,
    },
  })
}

export async function enqueueSubscriptionWebhookOutbox(txDb: any, client: any, event: string, data: any) {
  if (!client?.webhookUrl) return
  const eventId = `evt_${crypto.randomBytes(16).toString('hex')}`
  const payload = {
    event,
    eventId,
    clientId: client.id,
    businessName: client.businessName,
    data,
    createdAt: new Date().toISOString(),
  }
  await txDb.webhookLog.create({
    data: {
      clientId: client.id,
      url: client.webhookUrl,
      event,
      eventId,
      payload: JSON.stringify(payload),
      isSuccess: false,
      attempt: 0,
      nextAttemptAt: new Date(),
      outcomeKnown: true,
    },
  })
}

async function reconcileLinkedCustomerInvoice(txDb: any, transaction: any, client: any, paidAt: Date) {
  try {
    const linkedInvoice = await txDb.customerInvoice.findFirst({
      where: {
        OR: [
          { sessionId: transaction.sessionId },
          { transactionId: transaction.id },
        ],
        status: { in: ['PENDING', 'OVERDUE'] },
      },
      include: { subscription: true },
    })
    if (linkedInvoice) {
      await txDb.customerInvoice.update({
        where: { id: linkedInvoice.id },
        data: { status: 'PAID', paidAt },
      })
      if (linkedInvoice.subscriptionId) {
        await txDb.customerSubscription.update({
          where: { id: linkedInvoice.subscriptionId },
          data: { status: 'ACTIVE' },
        })
      }
      await enqueueSubscriptionWebhookOutbox(txDb, client, 'subscription.invoice_paid', {
        invoiceId: linkedInvoice.id,
        invoiceNumber: linkedInvoice.invoiceNumber,
        subscriptionId: linkedInvoice.subscriptionId,
        customerName: linkedInvoice.customerName,
        customerEmail: linkedInvoice.customerEmail,
        amountEgp: linkedInvoice.amountEgp,
        paidAt: paidAt.toISOString(),
        transactionId: transaction.id,
        sessionId: transaction.sessionId,
      })
    }
  } catch (invErr) {
    console.warn('[settlement] Customer invoice auto-reconciliation warning:', invErr)
  }
}

/**
 * Settles an ordinary merchant checkout and consumes its quota reservation in
 * one database transaction. This prevents checkout creation from observing a
 * gap where the PENDING reservation is gone but txCount has not increased yet.
 */
export async function confirmOrdinaryCheckout(
  input: ConfirmOrdinaryCheckoutInput
): Promise<OrdinaryCheckoutSettlement | null> {
  if (input.allowedStatuses.length === 0) {
    throw new Error('At least one source status is required for checkout confirmation')
  }
  if (input.allowedStatuses.includes('CONFIRMED')) {
    throw new Error('CONFIRMED cannot be used as a source status for checkout confirmation')
  }

  return db.$transaction(async (txDb) => {
    const transition = await txDb.transaction.updateMany({
      where: {
        id: input.transactionId,
        clientId: input.clientId,
        purpose: 'CHECKOUT',
        subscriptionPlanName: null,
        status: { in: input.allowedStatuses },
      },
      data: {
        status: 'CONFIRMED',
        senderHandle: input.senderHandle,
        detectedRef: input.detectedRef,
        detectedAt: input.detectedAt,
        detectedAmountEgp: input.detectedAmountEgp,
        detectedAmountCents: input.detectedAmountCents,
      },
    })

    if (transition.count !== 1) {
      const existing = await txDb.transaction.findFirst({
        where: {
          id: input.transactionId,
          clientId: input.clientId,
          purpose: 'CHECKOUT',
          subscriptionPlanName: null,
        },
      })
      return existing ? { transaction: existing, newlyConfirmed: false } : null
    }

    await txDb.client.update({
      where: { id: input.clientId },
      data: { txCount: { increment: 1 } },
    })

    const transaction = await txDb.transaction.findUniqueOrThrow({
      where: { id: input.transactionId },
    })
    const client = await txDb.client.findUniqueOrThrow({ where: { id: input.clientId } })
    await enqueueWebhookOutbox(txDb, transaction, client)
    await reconcileLinkedCustomerInvoice(txDb, transaction, client, input.detectedAt || new Date())
    return { transaction, newlyConfirmed: true }
  })
}

/**
 * Trusted settlement path for owner/platform-confirmed payments. The payment
 * state transition and any resulting entitlement change share one database
 * transaction, which makes repeated confirmations idempotent.
 */
export async function confirmTransactionAsOwner(sessionId: string) {
  return db.$transaction(async (txDb) => {
    const existing = await txDb.transaction.findUnique({
      where: { sessionId },
      include: { client: true },
    })
    if (!existing) return null
    if (existing.status === 'CONFIRMED') {
      return { transaction: existing, newlyConfirmed: false }
    }

    const transition = await txDb.transaction.updateMany({
      where: { id: existing.id, status: existing.status },
      data: {
        status: 'CONFIRMED',
        detectedAt: new Date(),
        detectedRef: 'ADMIN_FORCE_CONFIRM',
        detectedAmountEgp: existing.amountEgp,
        detectedAmountCents: existing.amountCents,
      },
    })
    if (transition.count !== 1) {
      throw new Error('Transaction state changed during confirmation')
    }

    if (existing.purpose === 'SUBSCRIPTION') {
      if (!existing.subscriptionPlanName) {
        throw new Error('Subscription transaction is missing its plan classification')
      }
      if (existing.subscriptionPlanName.startsWith('BUNDLE:')) {
        const purchase = await txDb.bundlePurchase.findFirst({
          where: {
            sessionId: existing.sessionId,
            clientId: existing.clientId,
            status: 'PENDING',
          },
        })
        if (!purchase) throw new Error('Pending bundle purchase record was not found')

        await txDb.client.update({
          where: { id: existing.clientId },
          data: { txLimit: { increment: purchase.extraTx } },
        })
        await txDb.bundlePurchase.update({
          where: { id: purchase.id },
          data: { status: 'CONFIRMED' },
        })
      } else {
        const plan = await txDb.plan.findUnique({ where: { name: existing.subscriptionPlanName } })
        if (!plan || plan.name === 'FREE_TRIAL') {
          throw new Error('Payable subscription plan was not found')
        }

        const now = Date.now()
        const currentEnd = existing.client.subscriptionEndsAt?.getTime() || 0
        const remainingTrialMs = existing.client.isFreeTrial ? Math.max(0, currentEnd - now) : 0
        const trialPlan = await txDb.plan.findUnique({ where: { name: 'FREE_TRIAL' } })
        let bonusDays = Math.ceil(remainingTrialMs / (24 * 60 * 60 * 1000))
        if (trialPlan?.periodDays) bonusDays = Math.min(bonusDays, trialPlan.periodDays)
        const periodDays = (plan.periodDays || 30) + bonusDays

        await txDb.client.update({
          where: { id: existing.clientId },
          data: {
            subscriptionPlan: plan.name,
            subscriptionEndsAt: new Date(now + periodDays * 24 * 60 * 60 * 1000),
            isFreeTrial: false,
            txLimit: plan.maxTransactions,
            txCount: 0,
          },
        })
      }
    } else if (existing.purpose === 'CHECKOUT' && !existing.subscriptionPlanName) {
      await txDb.client.update({
        where: { id: existing.clientId },
        data: { txCount: { increment: 1 } },
      })
    } else {
      throw new Error('Unsupported transaction classification')
    }

    const transaction = await txDb.transaction.findUniqueOrThrow({
      where: { id: existing.id },
      include: { client: true },
    })
    await enqueueWebhookOutbox(txDb, transaction, transaction.client)
    await reconcileLinkedCustomerInvoice(txDb, transaction, transaction.client, existing.detectedAt || new Date())
    return { transaction, newlyConfirmed: true }
  })
}
