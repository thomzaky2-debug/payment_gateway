import assert from 'node:assert/strict'
import test from 'node:test'
import { describeSessionUserAgent, normalizeIpAddress, presentSession } from './sessionPresentation.js'

test('proxy port suffixes are stripped while IPv6 addresses are preserved', () => {
  assert.equal(normalizeIpAddress('154.184.188.41:15152'), '154.184.188.41')
  assert.equal(normalizeIpAddress('::ffff:156.164.36.133'), '156.164.36.133')
  assert.equal(normalizeIpAddress('::ffff:156.164.36.133:9183'), '156.164.36.133')
  assert.equal(normalizeIpAddress('[2001:db8::1]:443'), '2001:db8::1')
  assert.equal(normalizeIpAddress('2001:db8::1:443'), '2001:db8::1:443')
  assert.equal(normalizeIpAddress('999.1.2.3:443'), null)
  assert.equal(normalizeIpAddress('1.2.3.4, 5.6.7.8'), null)
  assert.equal(normalizeIpAddress(null), null)
})

test('browser labels distinguish mobile Safari, Chrome and Firefox', () => {
  assert.deepEqual(describeSessionUserAgent('Mozilla/5.0 (X11; Linux x86_64) Firefox/153.0'), { device: 'Linux device', browser: 'Firefox 153.0' })
  assert.deepEqual(describeSessionUserAgent('Mozilla/5.0 (iPhone) CriOS/138.0 Mobile Safari/604.1'), { device: 'iPhone', browser: 'Chrome 138.0' })
  assert.deepEqual(describeSessionUserAgent('Mozilla/5.0 (iPhone) Version/18.0 Mobile Safari/604.1'), { device: 'iPhone', browser: 'Safari 18.0' })
})

const row = { id: 'session-1', tokenHash: 'private-hash', userAgent: 'okhttp/4.12', deviceId: 'private-device-uuid', refreshTokenHash: 'private-refresh', ipAddress: '154.184.188.41:15152', createdAt: new Date(), lastSeenAt: new Date() }

test('mobile sessions use enrolled device names and never expose credentials or invent locations', () => {
  const result = presentSession(row, 'private-hash', { deviceId: row.deviceId, name: 'HUAWEI JNY-LX1', appVersion: '1.0.0' })
  assert.equal(result.device, 'HUAWEI JNY-LX1')
  assert.equal(result.browser, 'NilePay Merchant 1.0.0')
  assert.equal(result.ipAddress, '154.184.188.41')
  assert.equal(result.location, null)
  assert.equal(result.current, true)
  assert.equal(JSON.stringify(result).includes('private-'), false)
  assert.equal(presentSession(row, null).device, 'Android device')
  assert.equal(presentSession(row, null).current, false)
})
