import test from 'node:test'
import assert from 'node:assert/strict'
import { operationalRetentionFilters } from './operationalRetention.js'

test('routine log cleanup excludes pending, unknown, failed and locked deliveries', () => {
  const now = new Date('2026-10-27T00:00:00Z')
  const filters = operationalRetentionFilters(now)
  assert.deepEqual(filters.webhook, {
    createdAt: { lt: new Date(now.getTime() - 90 * 86400000) },
    isSuccess: true, outcomeKnown: true, nextAttemptAt: null, deliveryLockedUntil: null,
  })
  assert.deepEqual(filters.audit, { createdAt: { lt: new Date(now.getTime() - 365 * 86400000) } })
})
