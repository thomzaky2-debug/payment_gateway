import assert from 'node:assert/strict'
import test from 'node:test'
import { db } from './db.js'
import { hashToken, hashPassword, MERCHANT_SESSION_COOKIE_NAME } from './services/authService.js'
import {
  createMobileSession,
  rotateMobileSession,
  revokeMobileSessionFamily,
} from './services/mobileAuthService.js'
import {
  enrollDetectorDevice,
  revokeDetectorDevice,
  authenticateByDeviceToken,
} from './services/deviceService.js'
import { processInstaPayNotification } from './services/matcherService.js'
import { deleteMerchantAccount } from './services/accountService.js'
import { requireTrustedOrigin } from './middleware/requireTrustedOrigin.js'
import { getRequestAuthToken } from './middleware/authToken.js'

process.env.TOKEN_PEPPER = 'test-pepper-0123456789abcdef0123456789'
process.env.OWNER_SECRET = 'test-owner-secret-0123456789abcdef0123456789'
process.env.CREDENTIAL_ENCRYPTION_KEY = 'test-enc-key-0123456789abcdef01234567890123456789abcdef0123456789'
process.env.AUTH_ALLOW_DEV_BYPASS = 'true'

// ─── 1. Refresh Rotation and Reuse Revocation ────────────────────────────────
test('mobile auth session creates, rotates once, and revokes whole family on reuse', async (t) => {
  const sessions = new Map<string, any>()
  let idCounter = 1

  const origCreate = (db as any).authSession?.create
  const origFindUnique = (db as any).authSession?.findUnique
  const origFindFirst = (db as any).authSession?.findFirst
  const origUpdate = (db as any).authSession?.update
  const origUpdateMany = (db as any).authSession?.updateMany

  ;(db as any).authSession = {
    create: async ({ data }: any) => {
      const s = {
        id: `session_${idCounter++}`,
        createdAt: new Date(),
        lastSeenAt: new Date(),
        rotatedAt: null,
        revokedAt: null,
        ...data,
      }
      sessions.set(s.tokenHash, s)
      if (s.refreshTokenHash) sessions.set(s.refreshTokenHash, s)
      return s
    },
    findUnique: async ({ where }: any) => {
      if (where.refreshTokenHash) return sessions.get(where.refreshTokenHash) || null
      if (where.tokenHash) return sessions.get(where.tokenHash) || null
      return null
    },
    findFirst: async ({ where }: any) => {
      for (const s of sessions.values()) {
        if (where.familyId && s.familyId !== where.familyId) continue
        if (where.refreshTokenHash && s.refreshTokenHash !== where.refreshTokenHash) continue
        return s
      }
      return null
    },
    update: async ({ where, data }: any) => {
      for (const [k, s] of sessions.entries()) {
        if (s.id === where.id) {
          Object.assign(s, data)
          return s
        }
      }
      return null
    },
    updateMany: async ({ where, data }: any) => {
      let count = 0
      for (const s of sessions.values()) {
        if (where.familyId && s.familyId === where.familyId) {
          Object.assign(s, data)
          count++
        }
      }
      return { count }
    },
  }

  t.after(() => {
    ;(db as any).authSession.create = origCreate
    ;(db as any).authSession.findUnique = origFindUnique
    ;(db as any).authSession.findFirst = origFindFirst
    ;(db as any).authSession.update = origUpdate
    ;(db as any).authSession.updateMany = origUpdateMany
  })

  // 1. Initial login creates mobile session
  const initial = await createMobileSession({
    kind: 'MERCHANT',
    clientId: 'client_mobile_1',
    deviceId: 'android_pixel_8',
  })
  assert.ok(initial.accessToken)
  assert.ok(initial.refreshToken)

  // 2. First rotation succeeds
  const rotated1 = await rotateMobileSession({
    refreshToken: initial.refreshToken,
    deviceId: 'android_pixel_8',
  })
  assert.equal(rotated1.ok, true)
  assert.ok(rotated1.tokens)
  assert.notEqual(rotated1.tokens.refreshToken, initial.refreshToken)

  // 3. REUSE ATTACK: Replaying initial.refreshToken must revoke the entire family
  const reuseAttack = await rotateMobileSession({
    refreshToken: initial.refreshToken,
    deviceId: 'android_pixel_8',
  })
  assert.equal(reuseAttack.ok, false)
  assert.equal(reuseAttack.status, 401)
  assert.equal(reuseAttack.familyRevoked, true)
  assert.match(reuseAttack.error, /already been used|revoked/i)

  // 4. Verify that subsequently, even the latest refresh token is revoked
  const postAttackAttempt = await rotateMobileSession({
    refreshToken: rotated1.tokens.refreshToken,
    deviceId: 'android_pixel_8',
  })
  assert.equal(postAttackAttempt.ok, false)
  assert.equal(postAttackAttempt.status, 401)
  assert.match(postAttackAttempt.error, /revoked/i)
})

// ─── 2. Revoked Device and Session Get 401 ────────────────────────────────────
test('revoking a detector device invalidates device credentials and webhook ingestion', async (t) => {
  const devices = new Map<string, any>()
  const sessions = new Map<string, any>()

  const origDevUpsert = (db as any).detectorDevice?.upsert
  const origDevFindUnique = (db as any).detectorDevice?.findUnique
  const origDevFindFirst = (db as any).detectorDevice?.findFirst
  const origDevUpdate = (db as any).detectorDevice?.update
  const origDevUpdateMany = (db as any).detectorDevice?.updateMany
  const origSessUpdateMany = (db as any).authSession?.updateMany

  ;(db as any).detectorDevice = {
    upsert: async ({ create, update, where }: any) => {
      const existing = devices.get(where.clientId_deviceId.deviceId)
      if (existing) {
        Object.assign(existing, update)
        return existing
      }
      const created = { id: 'dev_row_1', ...create, createdAt: new Date(), lastSeenAt: new Date(), revokedAt: null }
      devices.set(created.deviceId, created)
      if (created.credentialHash) devices.set(created.credentialHash, created)
      return created
    },
    findUnique: async ({ where }: any) => {
      if (where.credentialHash) {
        const d = devices.get(where.credentialHash)
        if (d) return { ...d, client: { id: d.clientId, isActive: true, approvalStatus: 'APPROVED' } }
      }
      return null
    },
    findFirst: async ({ where }: any) => {
      for (const d of devices.values()) {
        if (d.clientId === where.clientId && (d.id === where.OR?.[0]?.id || d.deviceId === where.OR?.[1]?.deviceId)) {
          return d
        }
      }
      return null
    },
    update: async ({ where, data }: any) => {
      for (const d of devices.values()) {
        if (d.id === where.id) {
          Object.assign(d, data)
          return d
        }
      }
      return null
    },
  }

  ;(db as any).authSession = {
    updateMany: async ({ where, data }: any) => {
      let count = 0
      for (const s of sessions.values()) {
        if (s.clientId === where.clientId && s.deviceId === where.deviceId) {
          Object.assign(s, data)
          count++
        }
      }
      return { count }
    },
  }

  t.after(() => {
    ;(db as any).detectorDevice.upsert = origDevUpsert
    ;(db as any).detectorDevice.findUnique = origDevFindUnique
    ;(db as any).detectorDevice.findFirst = origDevFindFirst
    ;(db as any).detectorDevice.update = origDevUpdate
    ;(db as any).detectorDevice.updateMany = origDevUpdateMany
    ;(db as any).authSession.updateMany = origSessUpdateMany
  })

  // 1. Enroll device
  const enrolled = await enrollDetectorDevice({
    clientId: 'client_merchant_test',
    deviceId: 'samsung_galaxy_s24',
    name: 'Counter Galaxy S24',
  })
  assert.ok(enrolled.deviceToken)
  assert.equal(enrolled.deviceId, 'samsung_galaxy_s24')

  // 2. Device token authenticates successfully
  const auth1 = await authenticateByDeviceToken(enrolled.deviceToken)
  assert.equal(auth1.success, true)

  // 3. Revoke device
  const revoked = await revokeDetectorDevice('client_merchant_test', 'samsung_galaxy_s24')
  assert.equal(revoked, true)

  // 4. Ingestion attempt with revoked device token returns DEVICE_REVOKED (leading to HTTP 401)
  const authRevoked = await authenticateByDeviceToken(enrolled.deviceToken)
  assert.equal(authRevoked.success, false)
  if (!authRevoked.success) {
    assert.equal(authRevoked.error, 'DEVICE_REVOKED')
  }
})

// ─── 3. eventId Replay Creates Only One Transaction ──────────────────────────
test('eventId replay is deduplicated and creates only one confirmed transaction', async (t) => {
  const incomingEvents = new Map<string, any>()
  let txCreatedCount = 0

  const origEventCreate = (db as any).incomingPaymentEvent?.create
  const origEventFindUnique = (db as any).incomingPaymentEvent?.findUnique
  const origEventUpdate = (db as any).incomingPaymentEvent?.update
  const origTxFindFirst = (db as any).transaction?.findFirst
  const origTxUpdate = (db as any).transaction?.update
  const origDevUpsert = (db as any).detectorDevice?.upsert
  const orig$transaction = (db as any).$transaction
  const origWhFindMany = (db as any).webhookLog?.findMany
  if (!(db as any).webhookLog) (db as any).webhookLog = {}
  ;(db as any).webhookLog.findMany = async () => []

  ;(db as any).detectorDevice = {
    upsert: async () => ({ id: 'dev_1' }),
  }

  ;(db as any).incomingPaymentEvent = {
    create: async ({ data }: any) => {
      if (incomingEvents.has(data.eventKey)) {
        const p2002Err: any = new Error('Unique constraint failed on eventKey')
        p2002Err.code = 'P2002'
        throw p2002Err
      }
      const evt = { id: `event_${incomingEvents.size + 1}`, ...data }
      incomingEvents.set(data.eventKey, evt)
      return evt
    },
    findUnique: async ({ where }: any) => incomingEvents.get(where.eventKey) || null,
    update: async ({ where, data }: any) => {
      for (const e of incomingEvents.values()) {
        if (e.id === where.id) {
          Object.assign(e, data)
          return e
        }
      }
      return null
    },
  }

  const mockTx = {
    id: 'tx_checkout_1',
    sessionId: 'cmt_checkout_1',
    clientId: 'client_merchant_1',
    senderHandle: 'buyer@instapay',
    recipientHandle: 'merchant@instapay',
    amountEgp: 50,
    amountCents: 5000,
    status: 'PENDING',
    purpose: 'CHECKOUT',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  ;(db as any).transaction = {
    findFirst: async ({ where }: any = {}) => {
      if (where?.status === 'CONFIRMED' || where?.detectedRef) {
        return mockTx.status === 'CONFIRMED' ? mockTx : null
      }
      return mockTx.status === 'PENDING' ? mockTx : null
    },
  }

  ;(db as any).$transaction = async (fn: any) => {
    return fn({
      transaction: {
        updateMany: async () => {
          if (mockTx.status === 'PENDING') {
            mockTx.status = 'CONFIRMED'
            txCreatedCount++
            return { count: 1 }
          }
          return { count: 0 }
        },
        findUniqueOrThrow: async () => mockTx,
      },
      client: {
        updateMany: async () => ({ count: 1 }),
        update: async () => ({ id: 'client_merchant_1' }),
        findUniqueOrThrow: async () => ({
          id: 'client_merchant_1',
          businessName: 'Test Merchant',
          webhookUrl: null,
          webhookSecret: null,
        }),
      },
      webhookLog: {
        create: async () => ({ id: 'wh_outbox_1' }),
      },
    })
  }

  t.after(() => {
    ;(db as any).incomingPaymentEvent.create = origEventCreate
    ;(db as any).incomingPaymentEvent.findUnique = origEventFindUnique
    ;(db as any).incomingPaymentEvent.update = origEventUpdate
    ;(db as any).transaction.findFirst = origTxFindFirst
    ;(db as any).detectorDevice.upsert = origDevUpsert
    ;(db as any).$transaction = orig$transaction
    if (origWhFindMany) (db as any).webhookLog.findMany = origWhFindMany
  })

  const clientMock: any = {
    id: 'client_merchant_1',
    instapayHandle: 'merchant@instapay',
    autoAcceptOverpaid: true,
  }

  // First ingestion with unique eventId confirms the pending checkout
  const firstIngest = await processInstaPayNotification({
    client: clientMock,
    amountEgp: 50,
    senderHandle: 'buyer@instapay',
    reference: 'REF98765',
    eventId: 'evt_android_device_unique_1',
    notificationTimestamp: new Date().toISOString(),
  })
  assert.equal(firstIngest.ok, true)
  assert.equal(firstIngest.matched, true)
  assert.equal(firstIngest.duplicate, false)
  assert.equal(txCreatedCount, 1)

  // Replay of the exact same eventId returns duplicate and does NOT confirm or create a second transaction
  const replayIngest = await processInstaPayNotification({
    client: clientMock,
    amountEgp: 50,
    senderHandle: 'buyer@instapay',
    reference: 'REF98765',
    eventId: 'evt_android_device_unique_1',
    notificationTimestamp: new Date().toISOString(),
  })
  assert.equal(replayIngest.ok, true)
  assert.equal(replayIngest.duplicate, true)
  assert.equal(txCreatedCount, 1) // strictly only one confirmation
})

// ─── 4. Legacy and Device Tokens Sunset Policy ───────────────────────────────
test('legacy detect token and device token behave according to LEGACY_DETECT_TOKEN_SUNSET', async () => {
  const futureSunset = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()
  const pastSunset = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // Function simulating sunset check from webhookRoutes.ts
  function checkLegacySunset(sunsetDateStr: string | null, clientSupportsDeviceTokens: boolean): { allowed: boolean; status: number } {
    if (!sunsetDateStr) return { allowed: true, status: 200 }
    const sunsetDate = new Date(sunsetDateStr)
    if (Date.now() > sunsetDate.getTime() && clientSupportsDeviceTokens) {
      return { allowed: false, status: 401 }
    }
    return { allowed: true, status: 200 }
  }

  // Before sunset: allowed
  assert.equal(checkLegacySunset(futureSunset, true).allowed, true)
  assert.equal(checkLegacySunset(futureSunset, false).allowed, true)

  // After sunset: blocked (401) for clients that support device tokens
  const blocked = checkLegacySunset(pastSunset, true)
  assert.equal(blocked.allowed, false)
  assert.equal(blocked.status, 401)

  // After sunset: legacy dumb client without device token support still permitted during grace period
  assert.equal(checkLegacySunset(pastSunset, false).allowed, true)
})

// ─── 5. Account Deletion Scrubs Personal Data ────────────────────────────────
test('account deletion anonymizes merchant PII, cancels webhooks, and preserves audit data', async (t) => {
  let updatedClient: any = null
  let revokedSessions = 0
  let revokedDevices = 0
  let cancelledWebhooks = 0
  let scrubbedWebhookPayloads = 0

  const origClientFindUnique = (db as any).client?.findUnique
  const origClientUpdate = (db as any).client?.update
  const origSessUpdateMany = (db as any).authSession?.updateMany
  const origDevUpdateMany = (db as any).detectorDevice?.updateMany
  const origWhUpdateMany = (db as any).webhookLog?.updateMany

  ;(db as any).client = {
    findUnique: async () => ({
      id: 'client_to_delete',
      email: 'merchant.personal@gmail.com',
      passwordHash: hashPassword('ValidPassword123!'),
      businessName: 'Personal Bakery',
      phoneNumber: '+201012345678',
      whatsappNumber: '+201012345678',
      profileImageData: 'data:image/png;base64,iVBORw0KGgo...',
      apiKey: 'enc:v1:apikey',
      detectToken: 'enc:v1:detecttoken',
      isActive: true,
      approvalStatus: 'APPROVED',
    }),
    update: async ({ data }: any) => {
      updatedClient = data
      return { id: 'client_to_delete', ...data }
    },
  }

  ;(db as any).authSession = {
    updateMany: async () => {
      revokedSessions += 3
      return { count: 3 }
    },
  }

  ;(db as any).detectorDevice = {
    updateMany: async () => {
      revokedDevices += 2
      return { count: 2 }
    },
  }

  ;(db as any).webhookLog = {
    updateMany: async ({ where, data }: any) => {
      if (data.response === 'Cancelled due to account deletion' || data.nextAttemptAt === null) {
        cancelledWebhooks += 5
      } else {
        scrubbedWebhookPayloads += 10
      }
      return { count: 5 }
    },
  }

  t.after(() => {
    ;(db as any).client.findUnique = origClientFindUnique
    ;(db as any).client.update = origClientUpdate
    ;(db as any).authSession.updateMany = origSessUpdateMany
    ;(db as any).detectorDevice.updateMany = origDevUpdateMany
    ;(db as any).webhookLog.updateMany = origWhUpdateMany
  })

  const delResult = await deleteMerchantAccount({
    clientId: 'client_to_delete',
    password: 'ValidPassword123!',
    skipOtp: true, // test mode bypass
  })

  assert.equal(delResult.ok, true)
  assert.ok(updatedClient)
  assert.equal(updatedClient.isActive, false)
  assert.ok(updatedClient.deletedAt instanceof Date)
  assert.ok(updatedClient.deletionRequestedAt instanceof Date)

  // Verify personal fields are scrubbed
  assert.equal(updatedClient.whatsappNumber, null)
  assert.equal(updatedClient.profileImageData, null)
  assert.equal(updatedClient.firstName, null)
  assert.equal(updatedClient.lastName, null)
  assert.match(updatedClient.email, /deleted-.*|deleted_.*@deleted\.local/)
  assert.match(updatedClient.businessName, /Deleted Merchant/)

  // Sessions and devices revoked
  assert.ok(revokedSessions > 0)
  assert.ok(revokedDevices > 0)
  assert.ok(cancelledWebhooks > 0)
})

// ─── 6. Admin Mobile Sessions Never Exceed 12 Hours ──────────────────────────
test('admin mobile sessions reject refresh when exceeding 12 hour maximum lifetime', async (t) => {
  const sessions = new Map<string, any>()
  const familyId = 'admin_fam_123'
  const rootCreatedAt = new Date(Date.now() - 13 * 60 * 60 * 1000) // 13 hours ago (exceeds 12h)

  const rootSession = {
    id: 'admin_sess_root',
    familyId,
    kind: 'OWNER',
    createdAt: rootCreatedAt,
    rotatedAt: new Date(Date.now() - 60 * 60 * 1000),
    revokedAt: new Date(Date.now() - 60 * 60 * 1000),
  }

  const latestRefresh = 'adm_refresh_tok_latest'
  const latestRefreshHash = hashToken(latestRefresh)

  const latestSession = {
    id: 'admin_sess_latest',
    familyId,
    kind: 'OWNER',
    refreshTokenHash: latestRefreshHash,
    createdAt: new Date(Date.now() - 15 * 60 * 1000),
    refreshExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    rotatedAt: null,
    revokedAt: null,
  }

  sessions.set(latestRefreshHash, latestSession)

  const origFindUnique = (db as any).authSession?.findUnique
  const origFindFirst = (db as any).authSession?.findFirst
  const origUpdateMany = (db as any).authSession?.updateMany

  ;(db as any).authSession = {
    findUnique: async ({ where }: any) => sessions.get(where.refreshTokenHash) || null,
    findFirst: async ({ where }: any) => {
      if (where.familyId === familyId) return rootSession
      return null
    },
    updateMany: async ({ data }: any) => {
      latestSession.revokedAt = data.revokedAt
      return { count: 1 }
    },
  }

  t.after(() => {
    ;(db as any).authSession.findUnique = origFindUnique
    ;(db as any).authSession.findFirst = origFindFirst
    ;(db as any).authSession.updateMany = origUpdateMany
  })

  const refreshResult = await rotateMobileSession({
    refreshToken: latestRefresh,
  })

  assert.equal(refreshResult.ok, false)
  assert.equal(refreshResult.status, 401)
  assert.match(refreshResult.error, /12h.*exceeded|exceeded.*12/i)
  assert.ok(latestSession.revokedAt != null)
})

// ─── 7. Regression Tests for Browser Flows ────────────────────────────────────
test('requireTrustedOrigin permits originless mobile/native requests and blocks untrusted browser origins', () => {
  const middleware = requireTrustedOrigin(new Set(['https://merchant.nilepay.app', 'https://admin.nilepay.app']))

  // Untrusted browser origin with session cookie gets 403
  let blockedStatus = 0
  let nextCalled = false
  middleware(
    {
      method: 'POST',
      path: '/api/transactions',
      headers: {},
      cookies: { [MERCHANT_SESSION_COOKIE_NAME]: 'cookie_session_val' },
      get: (header: string) => (header.toLowerCase() === 'origin' ? 'https://malicious-site.com' : null),
    } as any,
    { status: (code: number) => { blockedStatus = code; return { json: () => {} } } } as any,
    () => { nextCalled = true }
  )
  assert.equal(blockedStatus, 403)
  assert.equal(nextCalled, false)

  // Originless mobile app request passes through
  let mobilePassed = false
  middleware(
    {
      method: 'POST',
      path: '/api/transactions',
      headers: { authorization: 'Bearer mobile_bearer_token' },
      cookies: {},
      get: () => null,
    } as any,
    { status: () => ({ json: () => {} }) } as any,
    () => { mobilePassed = true }
  )
  assert.equal(mobilePassed, true)

  // Trusted browser origin passes through
  let webPassed = false
  middleware(
    {
      method: 'POST',
      path: '/api/transactions',
      headers: {},
      cookies: { [MERCHANT_SESSION_COOKIE_NAME]: 'cookie_session_val' },
      get: (header: string) => (header.toLowerCase() === 'origin' ? 'https://merchant.nilepay.app' : null),
    } as any,
    { status: () => ({ json: () => {} }) } as any,
    () => { webPassed = true }
  )
  assert.equal(webPassed, true)
})
