import assert from 'node:assert/strict'
import test from 'node:test'
import { Prisma, type Client } from '@prisma/client'
import { db } from '../db.js'
import { createCheckoutSession } from './checkoutService.js'

function replaceTransactionMethod(t: test.TestContext, replacement: (...args: any[]) => any) {
  const original = (db as any).$transaction
  ;(db as any).$transaction = replacement
  t.after(() => {
    ;(db as any).$transaction = original
  })
}

function replaceTransactionCreate(t: test.TestContext, replacement: (...args: any[]) => any) {
  const transactionModel = db.transaction as any
  const original = transactionModel.create
  transactionModel.create = replacement
  t.after(() => {
    transactionModel.create = original
  })
}

function merchant(overrides: Partial<Client> = {}): Client {
  return {
    id: 'merchant_test',
    slug: 'merchant-test',
    businessName: 'Test Merchant',
    businessType: 'E-commerce',
    instapayHandle: 'merchant@instapay',
    instapayPaymentUrl: null,
    firstName: null,
    lastName: null,
    whatsappNumber: null,
    email: 'merchant@example.com',
    passwordHash: 'unused',
    apiKey: null,
    detectToken: null,
    apiKeyHash: null,
    detectTokenHash: null,
    apiKeyLastUsedAt: null,
    detectTokenLastUsedAt: null,
    approvalStatus: 'APPROVED',
    isActive: true,
    webhookUrl: null,
    webhookSecret: null,
    webhookSecretHash: null,
    checkoutTtlMin: 10,
    autoAcceptOverpaid: true,
    overpaidMaxExcessEgp: 100,
    underpaidToleranceEnabled: false,
    underpaidToleranceEgp: 5,
    subscriptionPlan: 'BASIC',
    subscriptionEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    isFreeTrial: false,
    trialRedeemedAt: null,
    txLimit: 3,
    txCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

test('checkout creation counts active pending reservations inside a serializable transaction', async (t) => {
  const freshClient = merchant({ txCount: 2, txLimit: 3 })
  let createCalls = 0
  let isolationLevel: unknown

  const transactionDb = {
    client: {
      findUnique: async () => freshClient,
    },
    transaction: {
      count: async (args: any) => {
        assert.equal(args.where.clientId, freshClient.id)
        assert.equal(args.where.purpose, 'CHECKOUT')
        assert.equal(args.where.status, 'PENDING')
        assert.ok(args.where.expiresAt.gt instanceof Date)
        return 1
      },
      create: async () => {
        createCalls += 1
        throw new Error('create must not run when confirmed plus reserved quota is full')
      },
    },
  }

  replaceTransactionMethod(t, async (operation: any, options: any) => {
    isolationLevel = options?.isolationLevel
    return operation(transactionDb)
  })

  await assert.rejects(
    createCheckoutSession({ client: merchant(), amountEgp: 25 }),
    /2 confirmed \+ 1 pending \/ 3/
  )
  assert.equal(isolationLevel, Prisma.TransactionIsolationLevel.Serializable)
  assert.equal(createCalls, 0)
})

test('checkout creation retries a serialization conflict before reserving capacity', async (t) => {
  const freshClient = merchant({ txCount: 0, txLimit: 2 })
  let transactionAttempts = 0

  const transactionDb = {
    client: {
      findUnique: async () => freshClient,
    },
    transaction: {
      count: async () => 0,
      create: async ({ data }: any) => ({
        ...data,
        id: 'transaction_test',
        createdAt: new Date(),
        detectedRef: null,
        detectedAt: null,
        detectedAmountEgp: null,
        detectedAmountCents: null,
      }),
    },
  }

  replaceTransactionMethod(t, async (operation: any, options: any) => {
    transactionAttempts += 1
    assert.equal(options?.isolationLevel, Prisma.TransactionIsolationLevel.Serializable)
    if (transactionAttempts === 1) throw { code: 'P2034' }
    return operation(transactionDb)
  })

  const checkout = await createCheckoutSession({
    client: freshClient,
    amountEgp: 12.34,
    senderHandle: 'customer@instapay',
    note: 'Order test',
  })

  assert.equal(transactionAttempts, 2)
  assert.match(checkout.sessionId, /^cmt_[a-f0-9]{24}$/)
  assert.equal(checkout.status, 'PENDING')
  assert.equal(checkout.amountEgp, 12.34)
  assert.equal(checkout.recipientHandle, freshClient.instapayHandle)
  assert.equal(checkout.senderHandle, 'customer@instapay')
})

test('subscription checkout creation remains outside ordinary checkout quota reservation', async (t) => {
  const client = merchant({ txCount: 3, txLimit: 3 })
  replaceTransactionMethod(t, async () => {
    throw new Error('subscription checkout must not enter the quota reservation transaction')
  })
  replaceTransactionCreate(t, async ({ data }: any) => ({
    ...data,
    id: 'subscription_transaction_test',
    createdAt: new Date(),
    detectedRef: null,
    detectedAt: null,
    detectedAmountEgp: null,
    detectedAmountCents: null,
  }))

  const checkout = await createCheckoutSession({
    client,
    amountEgp: 250,
    purpose: 'SUBSCRIPTION',
    subscriptionPlanName: 'PRO',
  })

  assert.equal(checkout.status, 'PENDING')
  assert.equal(checkout.amountEgp, 250)
  assert.equal(checkout.recipientHandle, client.instapayHandle)
})
