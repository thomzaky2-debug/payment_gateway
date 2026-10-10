import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  isCloudMetadata,
  isPrivateIp,
  validateWebhookUrl,
  validateWebhookUrlDns,
} from './urlValidator.js'

test('SSRF validator unconditionally blocks cloud metadata in any environment', () => {
  // Test both with flags true and false
  const oldHttp = process.env.ALLOW_HTTP_WEBHOOKS
  const oldPriv = process.env.ALLOW_PRIVATE_WEBHOOKS
  try {
    process.env.ALLOW_HTTP_WEBHOOKS = 'true'
    process.env.ALLOW_PRIVATE_WEBHOOKS = 'true'

    assert.equal(isCloudMetadata('169.254.169.254'), true)
    assert.equal(isCloudMetadata('metadata.google.internal'), true)
    assert.equal(isCloudMetadata('169.254.1.1'), true)

    // Unconditional block even if ALLOW_PRIVATE_WEBHOOKS=true
    const res = validateWebhookUrl('https://169.254.169.254/latest/meta-data')
    assert.equal(res.valid, false)
  } finally {
    process.env.ALLOW_HTTP_WEBHOOKS = oldHttp
    process.env.ALLOW_PRIVATE_WEBHOOKS = oldPriv
  }
})

test('SSRF validator blocks private IPs with default configuration', () => {
  const oldHttp = process.env.ALLOW_HTTP_WEBHOOKS
  const oldPriv = process.env.ALLOW_PRIVATE_WEBHOOKS
  try {
    process.env.ALLOW_HTTP_WEBHOOKS = 'false'
    process.env.ALLOW_PRIVATE_WEBHOOKS = 'false'

    assert.equal(isPrivateIp('127.0.0.1'), true)
    assert.equal(isPrivateIp('10.0.0.1'), true)
    assert.equal(isPrivateIp('172.16.0.1'), true)
    assert.equal(isPrivateIp('192.168.1.1'), true)
    assert.equal(isPrivateIp('100.64.0.1'), true) // CGNAT
    assert.equal(isPrivateIp('::1'), true)
    assert.equal(isPrivateIp('[::1]'), true)
    assert.equal(isPrivateIp('fc00::1'), true)
    assert.equal(isPrivateIp('fe80::1'), true)
    assert.equal(isPrivateIp('::ffff:127.0.0.1'), true)

    assert.equal(validateWebhookUrl('https://127.0.0.1/webhook').valid, false)
    assert.equal(validateWebhookUrl('https://localhost/webhook').valid, false)
    assert.equal(validateWebhookUrl('https://[::1]/webhook').valid, false)
    assert.equal(validateWebhookUrl('http://example.com/webhook').valid, false) // HTTP forbidden
    assert.equal(validateWebhookUrl('https://sub.localhost/webhook').valid, false)
  } finally {
    process.env.ALLOW_HTTP_WEBHOOKS = oldHttp
    process.env.ALLOW_PRIVATE_WEBHOOKS = oldPriv
  }
})

test('SSRF validator accepts valid public HTTPS destination and resolves IP', async () => {
  const res = await validateWebhookUrlDns('https://1.1.1.1/webhook')
  assert.equal(res.valid, true)
  assert.equal(res.pinnedIp, '1.1.1.1')
})
