import assert from 'node:assert/strict'
import test from 'node:test'
import { parseTrustProxy } from './proxyTrust.js'

test('parseTrustProxy normalizes boolean settings and accepts explicit hop counts', () => {
  assert.equal(parseTrustProxy('TRUE', true), 1)
  assert.equal(parseTrustProxy('False', true), false)
  assert.equal(parseTrustProxy('0', true), 0)
  assert.equal(parseTrustProxy('2', true), 2)
})

test('parseTrustProxy rejects missing or malformed production settings', () => {
  assert.throws(() => parseTrustProxy(undefined, true), /must be explicitly set/)
  assert.throws(() => parseTrustProxy('proxy.example', true), /must be true, false, or a non-negative proxy hop count/)
})
