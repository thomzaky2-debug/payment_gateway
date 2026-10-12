import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseInstaPayPaymentLink } from './instapayPaymentLink.js'

test('accepts a direct HTTPS InstaPay payment link and derives the merchant IPA', () => {
  const result = parseInstaPayPaymentLink('https://ipn.eg/S/platform/instapay/TOKEN')

  assert.deepEqual(result, {
    paymentUrl: 'https://ipn.eg/S/platform/instapay/TOKEN',
    handle: 'platform@instapay',
  })
})

test('rejects payment links outside the direct InstaPay share-link format', () => {
  for (const value of [
    'http://ipn.eg/S/platform/instapay/TOKEN',
    'https://example.com/S/platform/instapay/TOKEN',
    'https://ipn.eg/S/platform/instapay',
    'https://ipn.eg/S/platform/instapay/TOKEN?source=signup',
    'platform@instapay',
  ]) {
    assert.equal(parseInstaPayPaymentLink(value), null, value)
  }
})
