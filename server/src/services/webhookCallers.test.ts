import assert from 'node:assert/strict'
import test from 'node:test'
import type { Client } from '@prisma/client'
import { db } from '../db.js'
import { processInstaPayNotification } from './matcherService.js'

function makeMockClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 'client_call_site_1',
    slug: 'call-site-client',
    businessName: 'Call Site Merchant',
    businessType: 'Retail',
    instapayHandle: 'merchant@instapay',
    instapayPaymentUrl: null,
    firstName: null,
    lastName: null,
    whatsappNumber: null,
    email: 'merchant@example.com',
    passwordHash: 'dummy',
    apiKey: null,
    detectToken: null,
    apiKeyHash: null,
    detectTokenHash: null,
    apiKeyLastUsedAt: null,
    detectTokenLastUsedAt: null,
    webhookUrl: 'https://merchant.example.com/webhook',
    webhookSecret: 'enc:v1:testKey:00112233445566778899aabb:00112233445566778899aabbccddeeff:11223344',
    webhookSecretHash: null,
    approvalStatus: 'APPROVED',
    isActive: true,
    checkoutTtlMin: 10,
    autoAcceptOverpaid: true,
    overpaidMaxExcessEgp: 100,
    underpaidToleranceEnabled: false,
    underpaidToleranceEgp: 5,
    subscriptionPlan: 'PRO',
    subscriptionEndsAt: null,
    isFreeTrial: false,
    trialRedeemedAt: null,
    txLimit: 1000,
    txCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

test('matcherService queues a durable webhook outbox row on exact confirmation', async (t) => {
  const rawEncryptedSecret = 'enc:v1:fakeKey:00112233445566778899aabb:00112233445566778899aabbccddeeff:deadbeef'
  const client = makeMockClient({ webhookSecret: rawEncryptedSecret })

  let createdWebhookLog: any = null

  const originalTxFindFirst = (db as any).transaction?.findFirst
  const originalTxFindUnique = (db as any).transaction?.findUnique
  const originalTxFindMany = (db as any).transaction?.findMany
  const originalTxUpdate = (db as any).transaction?.update
  const originalIncPaymentCreate = (db as any).incomingPaymentEvent?.create
  const originalIncPaymentUpdate = (db as any).incomingPaymentEvent?.update
  const originalWebhookLogCreate = (db as any).webhookLog?.create
  const originalDbTransaction = (db as any).$transaction
  const originalClientUpdate = (db as any).client?.update
  const originalClientFindUniqueOrThrow = (db as any).client?.findUniqueOrThrow

  const now = new Date()
  ;(db as any).$transaction = async (cb: any) => {
    if (typeof cb === 'function') {
      return cb(db as any)
    }
    return cb
  }

  ;(db as any).client = {
    ...(db as any).client,
    update: async () => client,
    findUniqueOrThrow: async () => client,
  }

  const mockTx = {
    id: 'tx_exact_match_1',
    sessionId: 'cmt_exact_1',
    clientId: client.id,
    amountEgp: 100,
    amountCents: 10000,
    senderHandle: 'customer@instapay',
    recipientHandle: 'merchant@instapay',
    status: 'PENDING',
    purpose: 'CHECKOUT',
    expiresAt: new Date(Date.now() + 600000),
    createdAt: now,
    client,
  }

  ;(db as any).transaction = {
    ...(db as any).transaction,
    findFirst: async (args: any) => {
      if (args?.where?.status === 'CONFIRMED' || args?.where?.detectedRef) {
        return null
      }
      return mockTx
    },
    findUnique: async () => mockTx,
    findUniqueOrThrow: async () => mockTx,
    findMany: async () => [mockTx],
    updateMany: async () => ({ count: 1 }),
    update: async (args: any) => ({
      ...mockTx,
      id: args.where.id,
      status: 'CONFIRMED',
      currency: 'EGP',
      detectedRef: 'REF_TEST_100',
      detectedAt: now,
    }),
  }

  ;(db as any).incomingPaymentEvent = {
    ...(db as any).incomingPaymentEvent,
    create: async () => ({ id: 'inc_1' }),
    update: async () => ({ id: 'inc_1' }),
  }

  ;(db as any).webhookLog = {
    ...(db as any).webhookLog,
    create: async (args: any) => {
      createdWebhookLog = args.data
      return { id: 'whlog_stub', ...args.data }
    },
  }

  t.after(() => {
    if (originalTxFindFirst) (db as any).transaction.findFirst = originalTxFindFirst
    if (originalTxFindUnique) (db as any).transaction.findUnique = originalTxFindUnique
    if (originalTxFindMany) (db as any).transaction.findMany = originalTxFindMany
    if (originalTxUpdate) (db as any).transaction.update = originalTxUpdate
    if (originalIncPaymentCreate) (db as any).incomingPaymentEvent.create = originalIncPaymentCreate
    if (originalIncPaymentUpdate) (db as any).incomingPaymentEvent.update = originalIncPaymentUpdate
    if (originalWebhookLogCreate) (db as any).webhookLog.create = originalWebhookLogCreate
    if (originalDbTransaction) (db as any).$transaction = originalDbTransaction
    if (originalClientUpdate) (db as any).client.update = originalClientUpdate
    if (originalClientFindUniqueOrThrow) (db as any).client.findUniqueOrThrow = originalClientFindUniqueOrThrow
  })

  const matchRes = await processInstaPayNotification({
    client,
    amountEgp: 100,
    senderHandle: 'customer@instapay',
    reference: 'REF_TEST_100',
  })

  assert.ok(createdWebhookLog, 'Expected confirmation to enqueue a WebhookLog in its transaction')
  assert.equal(createdWebhookLog.clientId, client.id)
  assert.equal(createdWebhookLog.event, 'payment.confirmed')
  assert.equal(createdWebhookLog.isSuccess, false)
  assert.equal(createdWebhookLog.attempt, 0)
  assert.equal(createdWebhookLog.outcomeKnown, true)
  assert.ok(createdWebhookLog.nextAttemptAt instanceof Date)
})
