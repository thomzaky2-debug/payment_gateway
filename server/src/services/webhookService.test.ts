import assert from 'node:assert/strict'
import test from 'node:test'
import {
  generateWebhookSignature,
  resolveWebhookSigningSecret,
  forwardToClientWebhook,
} from './webhookService.js'
import { encryptCredential } from '../lib/credentialCrypto.js'
import { db } from '../db.js'
import { processDueWebhookRetries } from '../workers/webhookRetryWorker.js'

test('generateWebhookSignature creates valid HMAC-SHA256 hex signature', () => {
  const secret = 'whsec_test_secret_12345'
  const payload = JSON.stringify({ event: 'test', data: 123 })
  const timestamp = 1710000000

  const sig1 = generateWebhookSignature(payload, secret, timestamp)
  const sig2 = generateWebhookSignature(payload, secret, timestamp)

  assert.equal(sig1, sig2)
  assert.equal(typeof sig1, 'string')
  assert.equal(sig1.length, 64) // 256-bit hex
})

test('resolveWebhookSigningSecret handles null, empty, and whitespace secrets as unconfigured', () => {
  assert.deepEqual(resolveWebhookSigningSecret(null), { ok: true, secret: null })
  assert.deepEqual(resolveWebhookSigningSecret(undefined), { ok: true, secret: null })
  assert.deepEqual(resolveWebhookSigningSecret(''), { ok: true, secret: null })
  assert.deepEqual(resolveWebhookSigningSecret('   '), { ok: true, secret: null })
})

test('resolveWebhookSigningSecret passes through legacy plaintext secret', () => {
  const plaintext = 'whsec_unencrypted_legacy_123'
  const res = resolveWebhookSigningSecret(plaintext)
  assert.equal(res.ok, true)
  assert.equal(res.secret, plaintext)
})

test('resolveWebhookSigningSecret decrypts valid encrypted secret at rest', () => {
  const plaintext = 'whsec_valid_encrypted_secret_999'
  const encrypted = encryptCredential(plaintext)!
  assert.ok(encrypted.startsWith('enc:v1:'))

  const res = resolveWebhookSigningSecret(encrypted)
  assert.equal(res.ok, true)
  assert.equal(res.secret, plaintext)
})

test('resolveWebhookSigningSecret fails closed on tampered encrypted secret', () => {
  const plaintext = 'whsec_secret_to_tamper'
  const encrypted = encryptCredential(plaintext)!
  const tampered = encrypted.slice(0, -4) + '0000'

  const res = resolveWebhookSigningSecret(tampered)
  assert.equal(res.ok, false)
  assert.equal(res.secret, null)
  assert.ok(res.error?.includes('failed decryption'))
})

test('resolveWebhookSigningSecret fails closed on malformed enc:v1: envelope', () => {
  const malformed = 'enc:v1:malformed:envelope'
  const res = resolveWebhookSigningSecret(malformed)
  assert.equal(res.ok, false)
  assert.equal(res.secret, null)
  assert.ok(res.error?.includes('failed decryption'))
})

test('forwardToClientWebhook aborts delivery immediately when secret resolution fails and records failed audit log', async (t) => {
  let createdLog: any = null
  const originalCreate = (db as any).webhookLog?.create
  ;(db as any).webhookLog = {
    ...(db as any).webhookLog,
    create: async (args: any) => {
      createdLog = args.data
      return { id: 'whlog_test', ...args.data }
    },
  }
  t.after(() => {
    if (originalCreate) {
      ;(db as any).webhookLog.create = originalCreate
    }
  })

  const tamperedSecret = 'enc:v1:fakeKey:00112233445566778899aabb:00112233445566778899aabbccddeeff:deadbeef'
  const dummyPayload = {
    event: 'payment.confirmed',
    clientId: 'client_test_1',
    businessName: 'Test Business',
    transaction: {
      sessionId: 'cmt_dummy_1',
      senderHandle: 'cust@instapay',
      recipientHandle: 'merchant@instapay',
      amountEgp: 100,
      currency: 'EGP',
      status: 'CONFIRMED',
      detectedRef: 'REF123',
      detectedAt: null,
      createdAt: new Date().toISOString(),
    },
  }

  // Should fail closed before attempting any network connection
  const res = await forwardToClientWebhook(
    'client_test_1',
    'https://merchant.example.com/webhook',
    tamperedSecret,
    dummyPayload
  )

  assert.equal(res.success, false)
  assert.equal(res.statusCode, 500)
  assert.ok(res.error?.includes('failed decryption'))
  assert.ok(createdLog, 'Expected WebhookLog.create to be called')
  assert.equal(createdLog.clientId, 'client_test_1')
  assert.equal(createdLog.isSuccess, false)
  assert.equal(createdLog.statusCode, 500)
  assert.ok(createdLog.nextAttemptAt instanceof Date)
  assert.ok(createdLog.response?.includes('failed decryption'))
})

test('forwardToClientWebhook records an invalid URL failure on an existing delivery and releases its claim', async (t) => {
  let updatedData: any = null
  const originalUpdate = (db as any).webhookLog?.update
  ;(db as any).webhookLog = {
    ...(db as any).webhookLog,
    update: async (args: any) => {
      updatedData = args.data
      return { id: args.where.id, ...args.data }
    },
  }
  t.after(() => {
    if (originalUpdate) (db as any).webhookLog.update = originalUpdate
  })

  const res = await forwardToClientWebhook(
    'client_test_1',
    'not-a-webhook-url',
    null,
    {
      event: 'payment.confirmed',
      clientId: 'client_test_1',
      businessName: 'Test Business',
      transaction: {
        sessionId: 'cmt_invalid_url', senderHandle: 'cust@instapay', recipientHandle: 'merchant@instapay',
        amountEgp: 100, currency: 'EGP', status: 'CONFIRMED', detectedRef: null, detectedAt: null,
        createdAt: new Date().toISOString(),
      },
    },
    3,
    'whlog_existing',
    'evt_existing'
  )

  assert.equal(res.success, false)
  assert.equal(res.statusCode, 400)
  assert.ok(updatedData, 'Expected existing WebhookLog to be updated')
  assert.equal(updatedData.eventId, 'evt_existing')
  assert.equal(updatedData.attempt, 3)
  assert.equal(updatedData.deliveryLockedUntil, null)
  assert.ok(updatedData.nextAttemptAt instanceof Date)
})

test('forwardToClientWebhook pauses an existing delivery for manual review when result persistence fails', async (t) => {
  let updateCalls = 0
  let protectionData: any = null
  const originalUpdate = (db as any).webhookLog?.update
  ;(db as any).webhookLog = {
    ...(db as any).webhookLog,
    update: async (args: any) => {
      updateCalls += 1
      if (updateCalls <= 3) throw new Error('temporary database outage')
      protectionData = args.data
      return { id: args.where.id, ...args.data }
    },
  }
  t.after(() => {
    if (originalUpdate) (db as any).webhookLog.update = originalUpdate
  })

  const res = await forwardToClientWebhook(
    'client_test_1',
    'not-a-webhook-url',
    null,
    {
      event: 'payment.confirmed',
      clientId: 'client_test_1',
      businessName: 'Test Business',
      transaction: {
        sessionId: 'cmt_persistence_failure', senderHandle: 'cust@instapay', recipientHandle: 'merchant@instapay',
        amountEgp: 100, currency: 'EGP', status: 'CONFIRMED', detectedRef: null, detectedAt: null,
        createdAt: new Date().toISOString(),
      },
    },
    1,
    'whlog_persistence_failure',
    'evt_persistence_failure'
  )

  assert.equal(res.persistenceFailed, true)
  assert.equal(updateCalls, 4)
  assert.equal(protectionData.nextAttemptAt, null)
  assert.ok(protectionData.deliveryLockedUntil instanceof Date)
})

test('processDueWebhookRetries preserves nextAttemptAt on secret resolution failure', async (t) => {
  let updatedData: any = null
  const originalFindMany = (db as any).webhookLog?.findMany
  const originalUpdate = (db as any).webhookLog?.update
  const originalUpdateMany = (db as any).webhookLog?.updateMany

  ;(db as any).webhookLog = {
    ...(db as any).webhookLog,
    findMany: async () => [
      {
        id: 'whlog_retry_1',
        clientId: 'client_retry_1',
        url: 'https://merchant.example.com/webhook',
        payload: JSON.stringify({ event: 'payment.confirmed' }),
        attempt: 1,
        client: {
          webhookSecret: 'enc:v1:fakeKey:00112233445566778899aabb:00112233445566778899aabbccddeeff:deadbeef',
        },
      },
    ],
    update: async (args: any) => {
      updatedData = args.data
      return { id: args.where.id, ...args.data }
    },
    updateMany: async () => ({ count: 1 }),
  }

  t.after(() => {
    if (originalFindMany) (db as any).webhookLog.findMany = originalFindMany
    if (originalUpdate) (db as any).webhookLog.update = originalUpdate
    if (originalUpdateMany) (db as any).webhookLog.updateMany = originalUpdateMany
  })

  await processDueWebhookRetries()

  assert.ok(updatedData, 'Expected WebhookLog.update to be called')
  assert.equal(updatedData.attempt, 2)
  assert.equal(updatedData.isSuccess, false)
  assert.equal(updatedData.statusCode, 500)
  assert.ok(updatedData.nextAttemptAt instanceof Date, 'Expected nextAttemptAt to be set for retry')
  assert.ok(updatedData.response?.includes('failed decryption'))
})

test('processDueWebhookRetries stops retrying when max attempts are exhausted on secret resolution failure', async (t) => {
  let updatedData: any = null
  const originalFindMany = (db as any).webhookLog?.findMany
  const originalUpdate = (db as any).webhookLog?.update
  const originalUpdateMany = (db as any).webhookLog?.updateMany

  ;(db as any).webhookLog = {
    ...(db as any).webhookLog,
    findMany: async () => [
      {
        id: 'whlog_retry_max',
        clientId: 'client_retry_1',
        url: 'https://merchant.example.com/webhook',
        payload: JSON.stringify({ event: 'payment.confirmed' }),
        attempt: 7, // 7th attempt, so nextAttemptNumber is 8 (exceeding DECRYPT_FAILURE_BACKOFF_DELAYS_MS.length of 7)
        client: {
          webhookSecret: 'enc:v1:fakeKey:00112233445566778899aabb:00112233445566778899aabbccddeeff:deadbeef',
        },
      },
    ],
    update: async (args: any) => {
      updatedData = args.data
      return { id: args.where.id, ...args.data }
    },
    updateMany: async () => ({ count: 1 }),
  }

  t.after(() => {
    if (originalFindMany) (db as any).webhookLog.findMany = originalFindMany
    if (originalUpdate) (db as any).webhookLog.update = originalUpdate
    if (originalUpdateMany) (db as any).webhookLog.updateMany = originalUpdateMany
  })

  await processDueWebhookRetries()

  assert.ok(updatedData, 'Expected WebhookLog.update to be called')
  assert.equal(updatedData.attempt, 8)
  assert.equal(updatedData.isSuccess, false)
  assert.equal(updatedData.statusCode, 500)
  assert.equal(updatedData.nextAttemptAt, null, 'Expected nextAttemptAt to be null when attempts run out')
})
