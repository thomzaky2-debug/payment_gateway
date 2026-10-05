import assert from 'node:assert/strict'
import test from 'node:test'
import { canMerchantResolveTransaction } from './transactionPolicy.js'

test('merchant review accepts ordinary checkout anomalies', () => {
  assert.equal(canMerchantResolveTransaction({ purpose: 'CHECKOUT', status: 'UNDERPAID' }), true)
  assert.equal(canMerchantResolveTransaction({ purpose: 'CHECKOUT', status: 'OVERPAID' }), true)
  assert.equal(
    canMerchantResolveTransaction({ purpose: 'CHECKOUT', status: 'EXPIRED', detectedAmountEgp: 25 }),
    true
  )
})

test('merchant review rejects pending and unpaid expired checkouts', () => {
  assert.equal(canMerchantResolveTransaction({ purpose: 'CHECKOUT', status: 'PENDING' }), false)
  assert.equal(canMerchantResolveTransaction({ purpose: 'CHECKOUT', status: 'EXPIRED' }), false)
})

test('merchant review can never settle subscriptions or bundles', () => {
  assert.equal(
    canMerchantResolveTransaction({ purpose: 'SUBSCRIPTION', status: 'UNDERPAID', subscriptionPlanName: 'PRO' }),
    false
  )
  assert.equal(
    canMerchantResolveTransaction({ purpose: 'CHECKOUT', status: 'OVERPAID', subscriptionPlanName: 'BUNDLE:GROWTH' }),
    false
  )
})
