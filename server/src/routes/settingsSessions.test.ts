import assert from 'node:assert/strict'
import { once } from 'node:events'
import test from 'node:test'
import express from 'express'
import { db } from '../db.js'
import { hashToken } from '../services/authService.js'
import { settingsRouter } from './settingsRoutes.js'
import { mobileRouter } from './mobileRoutes.js'

process.env.TOKEN_PEPPER = 'test-session-presentation-pepper-at-least-32-chars'

test('session list updates the current request, scopes device names, and hides rotated generations and credentials', async () => {
  const original = {
    sessionFind: db.authSession.findUnique,
    sessionList: db.authSession.findMany,
    sessionUpdate: db.authSession.updateMany,
    clientFind: db.client.findUnique,
    deviceList: db.detectorDevice.findMany,
  }
  const token = 'ims_test-current-browser'
  const current = { id: 'browser', tokenHash: hashToken(token), kind: 'MERCHANT', clientId: 'merchant', expiresAt: new Date(Date.now() + 60_000), revokedAt: null, lastSeenAt: new Date(Date.now() - 11 * 3600_000), createdAt: new Date(), userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Firefox/153.0', ipAddress: '156.164.36.133:9183', deviceId: null, refreshTokenHash: null }
  const mobile = { ...current, id: 'phone', tokenHash: 'hidden-mobile-hash', deviceId: 'hidden-device-uuid', refreshTokenHash: 'hidden-refresh-hash', userAgent: 'okhttp/4.12', ipAddress: '154.184.188.41:15152' }
  const sessionDelegate = db.authSession as any
  sessionDelegate.findUnique = async () => current
  sessionDelegate.updateMany = async ({ where, data }: any) => {
    if (where.id) {
      assert.equal(where.id, current.id)
      assert.equal(where.revokedAt, null)
      Object.assign(current, data)
      return { count: 1 }
    }
    assert.equal(where.clientId, 'merchant')
    assert.equal(where.tokenHash, current.tokenHash)
    assert.equal(where.revokedAt, null)
    Object.assign(current, data)
    return { count: 1 }
  }
  sessionDelegate.findMany = async ({ where }: any) => {
    assert.equal(where.clientId, 'merchant')
    assert.equal(where.rotatedAt, null)
    assert.equal(where.revokedAt, null)
    return [current, mobile]
  }
  ;(db.client as any).findUnique = async () => ({ id: 'merchant', approvalStatus: 'APPROVED', isActive: true, subscriptionPlan: 'BASIC', businessName: 'Store', email: 'store@example.com', profileImageData: 'data:image/png;base64,photo', apiKey: 'hidden-api-key' })
  ;(db.detectorDevice as any).findMany = async ({ where }: any) => {
    assert.equal(where.clientId, 'merchant')
    assert.deepEqual(where.deviceId.in, ['hidden-device-uuid'])
    return [{ deviceId: 'hidden-device-uuid', name: 'HUAWEI JNY-LX1', appVersion: '1.0.0' }]
  }
  const app = express()
  app.use('/settings', settingsRouter)
  app.use('/mobile', mobileRouter)
  const server = app.listen(0, '127.0.0.1')
  try {
    await once(server, 'listening')
    const address = server.address() as { port: number }
    const url = `http://127.0.0.1:${address.port}/settings/sessions`
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    const body = await response.json() as any
    assert.equal(body.sessions[0].current, true)
    assert.ok(Date.now() - Date.parse(body.sessions[0].lastSeenAt) < 5000)
    assert.equal(body.sessions[1].device, 'HUAWEI JNY-LX1')
    assert.equal(body.sessions[1].ipAddress, '154.184.188.41')
    assert.equal(body.sessions[1].location, null)
    assert.equal(JSON.stringify(body).includes('hidden-'), false)
    assert.equal((await fetch(url)).status, 401)
    const profileUrl = `http://127.0.0.1:${address.port}/mobile/profile`
    assert.equal((await fetch(profileUrl)).status, 401)
    const profileResponse = await fetch(profileUrl, { headers: { Authorization: `Bearer ${token}` } })
    assert.equal(profileResponse.headers.get('cache-control'), 'no-store')
    const profileBody = await profileResponse.json() as any
    assert.deepEqual(Object.keys(profileBody.profile).sort(), ['businessName', 'email', 'id', 'profileImageData'])
    assert.equal(profileBody.profile.profileImageData, 'data:image/png;base64,photo')
    assert.ok(!JSON.stringify(profileBody).includes('hidden-api-key'))
  } finally {
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    sessionDelegate.findUnique = original.sessionFind
    sessionDelegate.findMany = original.sessionList
    sessionDelegate.updateMany = original.sessionUpdate
    ;(db.client as any).findUnique = original.clientFind
    ;(db.detectorDevice as any).findMany = original.deviceList
  }
})
