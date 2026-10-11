import { test } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'crypto'
import {
  encryptCredential,
  decryptCredential,
  isCredentialEncrypted,
  needsReencryption,
  reencryptCredential,
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
  // Encrypted with single sha256(TOKEN_PEPPER)
  const pepper = 'legacy-test-pepper-token-0123456789'
  const oldPepper = process.env.TOKEN_PEPPER
  try {
    process.env.TOKEN_PEPPER = pepper
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
  } finally {
    process.env.TOKEN_PEPPER = oldPepper
  }
})

test('decryptCredential seamlessly decrypts TOKEN_PEPPER data after CREDENTIAL_ENCRYPTION_KEY is configured', () => {
  const pepper = 'original-deployment-token-pepper-32bytes-secret'
  const newKey = 'brand-new-credential-encryption-key-32bytes'

  const oldPepper = process.env.TOKEN_PEPPER
  const oldCek = process.env.CREDENTIAL_ENCRYPTION_KEY
  try {
    // 1. Initial state: only TOKEN_PEPPER configured
    process.env.TOKEN_PEPPER = pepper
    delete process.env.CREDENTIAL_ENCRYPTION_KEY

    const plaintext = 'dtk_merchant_secret_data_before_switch'
    const encryptedUnderPepper = encryptCredential(plaintext)!
    assert.ok(encryptedUnderPepper.startsWith('enc:v1:'))

    // Legacy 3-part envelope from commit 347ebf0
    const legacyKey = crypto.createHash('sha256').update(pepper).digest()
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv('aes-256-gcm', legacyKey, iv)
    let legacyEnc = cipher.update('dtk_legacy_data_before_switch', 'utf8', 'hex')
    legacyEnc += cipher.final('hex')
    const tag = cipher.getAuthTag().toString('hex')
    const legacyEnvelope = `enc:v1:${iv.toString('hex')}:${tag}:${legacyEnc}`

    // 2. Operator switches to CREDENTIAL_ENCRYPTION_KEY
    process.env.CREDENTIAL_ENCRYPTION_KEY = newKey

    // Both should still decrypt successfully through candidates!
    const decrypted1 = decryptCredential(encryptedUnderPepper)
    assert.equal(decrypted1, plaintext)

    const decrypted2 = decryptCredential(legacyEnvelope)
    assert.equal(decrypted2, 'dtk_legacy_data_before_switch')

    // 3. Both should be flagged as needing re-encryption
    assert.equal(needsReencryption(encryptedUnderPepper), true)
    assert.equal(needsReencryption(legacyEnvelope), true)

    // 4. Re-encrypting migrates them to the new active key ID
    const reencrypted = reencryptCredential(encryptedUnderPepper)!
    assert.ok(reencrypted)
    assert.equal(needsReencryption(reencrypted), false)
    assert.equal(decryptCredential(reencrypted), plaintext)
  } finally {
    process.env.TOKEN_PEPPER = oldPepper
    process.env.CREDENTIAL_ENCRYPTION_KEY = oldCek
  }
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


