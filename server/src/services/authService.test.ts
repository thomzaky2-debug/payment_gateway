import assert from 'node:assert/strict'
import test from 'node:test'
import {
  hashPassword,
  hashToken,
  timingSafeCompare,
  validatePasswordPolicy,
  verifyPassword,
} from './authService.js'

process.env.OWNER_SECRET = 'test-owner-secret-0123456789abcdef0123456789'
process.env.TOKEN_PEPPER = 'test-token-pepper-0123456789abcdef0123456789'

test('password hashes are salted and verify in constant-time comparison path', () => {
  const first = hashPassword('Correct Horse Battery Staple')
  const second = hashPassword('Correct Horse Battery Staple')
  assert.notEqual(first, second)
  assert.equal(verifyPassword('Correct Horse Battery Staple', first), true)
  assert.equal(verifyPassword('wrong password', first), false)
})

test('password policy enforces a bounded minimum and maximum', () => {
  assert.match(validatePasswordPolicy('short') || '', /at least 12/)
  assert.equal(validatePasswordPolicy('a secure passphrase'), null)
  assert.match(validatePasswordPolicy('x'.repeat(129)) || '', /at most 128/)
})

test('token hashing is deterministic and peppered', () => {
  assert.equal(hashToken('token-value'), hashToken('token-value'))
  assert.notEqual(hashToken('token-value'), hashToken('other-token'))
  assert.equal(timingSafeCompare('same', 'same'), true)
  assert.equal(timingSafeCompare('short', 'longer'), false)
})
