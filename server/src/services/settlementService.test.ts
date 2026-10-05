import assert from 'node:assert/strict'
import test from 'node:test'
import { db } from '../db.js'
import { confirmOrdinaryCheckout } from './settlementService.js'

function replaceTransactionMethod(t: test.TestContext, replacement: (...args: any[]) => any) {
  const original = (db as any).$transaction
  ;(db as any).$transaction = replacement
  t.after(() => {
    ;(db as any).$transaction = original
  })
}

function checkout(overrides: Record<string, unknown> = {}) {
  return {
    id: 'transaction_test',
    sessionId: 'cmt_test',
    clientId: 'merchant_test',
    senderHandle: 'customer@instapay',
    recipientHandle: 'merchant@instapay',
    amountEgp: 25,
    amountCents: 2500,
    currency: 'EGP',
    status: 'CONFIRMED',
    purpose: 'CHECKOUT',
    subscriptionPlanName: null,
    note: null,
    detectedRef: 'payment_ref',
    detectedAt: new Date(),
    detectedAmountEgp: 25,
    detectedAmountCents: 2500,
    deepLinkUrl: 'https://example.test/pay',
    deepLinkToken: 'token',
    expiresAt: new Date(Date.now() + 60_000),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

test('ordinary checkout settlement transitions status and consumes quota in one transaction', async (t) => {
  const calls: string[] = []
  const confirmed = checkout()
  const transactionDb = {
    transaction: {
      updateMany: async (args: any) => {
        calls.push('transition')
        assert.deepEqual(args.where, {
          id: confirmed.id,
          clientId: confirmed.clientId,
          purpose: 'CHECKOUT',
          subscriptionPlanName: null,
          status: { in: ['PENDING', 'EXPIRED'] },
        })
        assert.equal(args.data.status, 'CONFIRMED')
        return { count: 1 }
      },
      findUniqueOrThrow: async () => {
        calls.push('read')
        return confirmed
      },
    },
    client: {
      update: async (args: any) => {
        calls.push('quota')
        assert.deepEqual(args, {
          where: { id: confirmed.clientId },
          data: { txCount: { increment: 1 } },
        })
        return {}
      },
    },
  }

  replaceTransactionMethod(t, async (operation: any) => operation(transactionDb))

  const result = await confirmOrdinaryCheckout({
    transactionId: confirmed.id,
    clientId: confirmed.clientId,
    allowedStatuses: ['PENDING', 'EXPIRED'],
    detectedRef: 'payment_ref',
    detectedAt: confirmed.detectedAt,
    detectedAmountEgp: 25,
    detectedAmountCents: 2500,
  })

  assert.equal(result?.newlyConfirmed, true)
  assert.equal(result?.transaction, confirmed)
  assert.deepEqual(calls, ['transition', 'quota', 'read'])
})

test('failed or ineligible transition never increments quota again', async (t) => {
  const confirmed = checkout()
  let quotaUpdates = 0
  const transactionDb = {
    transaction: {
      updateMany: async (args: any) => {
        assert.equal(args.where.purpose, 'CHECKOUT')
        assert.equal(args.where.subscriptionPlanName, null)
        return { count: 0 }
      },
      findFirst: async () => confirmed,
    },
    client: {
      update: async () => {
        quotaUpdates += 1
      },
    },
  }

  replaceTransactionMethod(t, async (operation: any) => operation(transactionDb))

  const result = await confirmOrdinaryCheckout({
    transactionId: confirmed.id,
    clientId: confirmed.clientId,
    allowedStatuses: ['PENDING'],
  })

  assert.equal(result?.newlyConfirmed, false)
  assert.equal(result?.transaction, confirmed)
  assert.equal(quotaUpdates, 0)
})

test('ordinary checkout settlement rejects an already-confirmed source state', async (t) => {
  let transactionCalls = 0
  replaceTransactionMethod(t, async () => {
    transactionCalls += 1
  })

  await assert.rejects(
    confirmOrdinaryCheckout({
      transactionId: 'transaction_test',
      clientId: 'merchant_test',
      allowedStatuses: ['CONFIRMED'],
    }),
    /CONFIRMED cannot be used as a source status/
  )
  assert.equal(transactionCalls, 0)
})

test('quota update failures abort ordinary checkout settlement', async (t) => {
  const transactionDb = {
    transaction: {
      updateMany: async () => ({ count: 1 }),
      findUniqueOrThrow: async () => {
        throw new Error('fetch must not run after a failed quota update')
      },
    },
    client: {
      update: async () => {
        throw new Error('quota write failed')
      },
    },
  }

  replaceTransactionMethod(t, async (operation: any) => operation(transactionDb))

  await assert.rejects(
    confirmOrdinaryCheckout({
      transactionId: 'transaction_test',
      clientId: 'merchant_test',
      allowedStatuses: ['PENDING'],
    }),
    /quota write failed/
  )
})
