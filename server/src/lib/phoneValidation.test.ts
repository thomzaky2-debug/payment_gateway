import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeEgyptianMobileNumber } from './phoneValidation.js'

test('Egyptian merchant mobile numbers require exactly 11 local digits starting with 01', () => {
  assert.equal(normalizeEgyptianMobileNumber('01123456789'), '+201123456789')
  assert.equal(normalizeEgyptianMobileNumber('01012345678'), '+201012345678')
  assert.equal(normalizeEgyptianMobileNumber('01212345678'), '+201212345678')
  assert.equal(normalizeEgyptianMobileNumber('01512345678'), '+201512345678')
  assert.equal(normalizeEgyptianMobileNumber('1123456789'), null)
  assert.equal(normalizeEgyptianMobileNumber('0112345678'), null)
  assert.equal(normalizeEgyptianMobileNumber('+201123456789'), null)
  assert.equal(normalizeEgyptianMobileNumber('0112345678a'), null)
})
