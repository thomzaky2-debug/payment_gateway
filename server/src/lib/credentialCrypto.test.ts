import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  encryptCredential,
  decryptCredential,
  isCredentialEncrypted,
} from './credentialCrypto.js'

test('encryptCredential encrypts data with AES-256-GCM envelope', () => {
  const secret = 'egp_live_1234567890abcdef'
  const encrypted = encryptCredential(secret)

  assert.ok(encrypted)
  assert.ok(encrypted.startsWith('enc:v1:'))
  assert.ok(isCredentialEncrypted(encrypted))
  assert.notEqual(encrypted, secret)

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
