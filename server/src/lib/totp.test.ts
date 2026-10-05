import assert from 'node:assert/strict'
import test from 'node:test'
import { verifyTotp } from './totp.js'

test('TOTP verification follows RFC 6238 dynamic truncation', () => {
  const rfcSecret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'
  assert.equal(verifyTotp('287082', rfcSecret, 59_000), true)
  assert.equal(verifyTotp('287083', rfcSecret, 59_000), false)
})

test('TOTP verification rejects malformed values and weak secrets', () => {
  assert.equal(verifyTotp('12345', 'GEZDGNBVGY3TQOJQ'), false)
  assert.equal(verifyTotp('123456', 'INVALID!'), false)
  assert.equal(verifyTotp('123456', 'not-a-base32-secret'), false)
})
