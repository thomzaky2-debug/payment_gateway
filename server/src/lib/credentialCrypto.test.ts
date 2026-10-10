import { test } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'crypto'
import {
  encryptCredential,
  decryptCredential,
  isCredentialEncrypted,
} from './credentialCrypto.js'

test('encryptCredential encrypts data with AES-256-GCM envelope including key ID', () => {
  const secret = 'egp_live_1234567890abcdef'
  const encrypted = encryptCredential(secret)

  assert.ok(encrypted)
  assert.ok(encrypted.startsWith('enc:v1:'))
  assert.ok(isCredentialEncrypted(encrypted))
  assert.notEqual(encrypted, secret)

  // Expect 4 parts: enc:v1:<keyId>:<iv>:<tag>:<ciphertext>
  const parts = encrypted.slice('enc:v1:'.length).split(':')
  assert.equal(parts.length, 4)

  const decrypted = decryptCredential(encrypted)
  assert.equal(decrypted, secret)
})

test('encryptCredential is idempotent on already encrypted strings', () => {
  const secret = 'whsec_abcdef123456'
  const encrypted1 = encryptCredential(secret)
  const encrypted2 = encryptCredential(encrypted1)
  assert.equal(encrypted1, encrypted2)
})

test('decryptCredential returns raw string if not prefixed (legacy fallback)', () => {
  const legacy = 'legacy_plaintext_key'
  assert.equal(decryptCredential(legacy), legacy)
  assert.equal(isCredentialEncrypted(legacy), false)
})

test('decryptCredential returns null on tampered ciphertext', () => {
  const secret = 'det_123456'
  const encrypted = encryptCredential(secret)!
  const tampered = encrypted.slice(0, -4) + 'ffff'
  assert.equal(decryptCredential(tampered), null)
})

test('decryptCredential handles legacy 3-part envelope from commit 347ebf0', () => {
  // Legacy format: enc:v1:<iv>:<tag>:<data>
  // Encrypted with single sha256(pepper)
  const pepper = process.env.TOKEN_PEPPER || 'dev-local-credential-pepper-key-only'
  const legacyKey = crypto.createHash('sha256').update(pepper).digest()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', legacyKey, iv)
  const plaintext = 'dtk_legacy_test_secret_123'
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const tag = cipher.getAuthTag().toString('hex')

  const legacyEnvelope = `enc:v1:${iv.toString('hex')}:${tag}:${encrypted}`
  const decrypted = decryptCredential(legacyEnvelope)
  assert.equal(decrypted, plaintext)
})

test('decryptCredential supports rotated keys via PREVIOUS_CREDENTIAL_ENCRYPTION_KEYS', () => {
  const oldSecret = 'old_secret_pepper_version_one_rotated'
  const oldKey = crypto
    .createHmac('sha256', oldSecret)
    .update('instapay:credential:aes-256-gcm:v1')
    .digest()
  const oldKeyId = crypto.createHash('sha256').update(oldKey).digest('hex').slice(0, 8)

  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', oldKey, iv)
  const plaintext = 'dtk_rotated_test_token_999'
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const tag = cipher.getAuthTag().toString('hex')

  const envelope = `enc:v1:${oldKeyId}:${iv.toString('hex')}:${tag}:${encrypted}`

  // Without PREVIOUS_CREDENTIAL_ENCRYPTION_KEYS, decryption fails
  const failed = decryptCredential(envelope)
  assert.equal(failed, null)

  // With PREVIOUS_CREDENTIAL_ENCRYPTION_KEYS set, decryption succeeds
  const oldEnv = process.env.PREVIOUS_CREDENTIAL_ENCRYPTION_KEYS
  try {
    process.env.PREVIOUS_CREDENTIAL_ENCRYPTION_KEYS = oldSecret
    const succeeded = decryptCredential(envelope)
    assert.equal(succeeded, plaintext)
  } finally {
    process.env.PREVIOUS_CREDENTIAL_ENCRYPTION_KEYS = oldEnv
  }
})
