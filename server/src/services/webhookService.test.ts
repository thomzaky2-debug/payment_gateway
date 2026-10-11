import assert from 'node:assert/strict'
import test from 'node:test'
import {
  generateWebhookSignature,
  resolveWebhookSigningSecret,
  forwardToClientWebhook,
} from './webhookService.js'
import { encryptCredential } from '../lib/credentialCrypto.js'

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

test('forwardToClientWebhook aborts delivery immediately when secret resolution fails', async () => {
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
  assert.ok(res.error?.includes('failed decryption'))
})
