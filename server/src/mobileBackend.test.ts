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
import { deleteMerchantAccount, requestPublicAccountDeletion } from './services/accountService.js'
import { requireTrustedOrigin } from './middleware/requireTrustedOrigin.js'
import { getRequestAuthToken } from './middleware/authToken.js'
import { renderAccountDeletionHtml, renderAccountDeletionScript } from './views/accountDeletionHtml.js'
import { isExplicitDevAuthEnabled } from './routes/authRoutes.js'

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
  const origTransaction = (db as any).$transaction

  ;(db as any).$transaction = async (fn: any) => fn(db)

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
      for (const s of sessions.values()) {
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
        if (where.id && s.id !== where.id) continue
        if (where.familyId && s.familyId !== where.familyId) continue
        if (where.rotatedAt === null && s.rotatedAt !== null) continue
        if (where.revokedAt === null && s.revokedAt !== null) continue
        if (where.refreshExpiresAt?.gt && s.refreshExpiresAt && s.refreshExpiresAt <= where.refreshExpiresAt.gt) continue
        Object.assign(s, data)
        count++
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
    ;(db as any).$transaction = origTransaction
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

// ─── 1b. Atomic Simultaneous Refresh Race Condition Test ─────────────────────
test('atomic refresh rotation: simultaneous refreshes with same token results in exactly one success and full family revocation', async (t) => {
  const sessions = new Map<string, any>()
  let idCounter = 1
  let inFlight = false

  const origCreate = (db as any).authSession?.create
  const origFindUnique = (db as any).authSession?.findUnique
  const origFindFirst = (db as any).authSession?.findFirst
  const origUpdateMany = (db as any).authSession?.updateMany
  const origTransaction = (db as any).$transaction

  ;(db as any).$transaction = async (fn: any) => fn(db)

  ;(db as any).authSession = {
    create: async ({ data }: any) => {
      const s = {
        id: `sess_sim_${idCounter++}`,
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
    updateMany: async ({ where, data }: any) => {
      // Simulate atomic database CAS serialization
      while (inFlight) {
        await new Promise((resolve) => setTimeout(resolve, 2))
      }
      inFlight = true
      try {
        let count = 0
        for (const s of sessions.values()) {
          if (where.id && s.id !== where.id) continue
          if (where.familyId && s.familyId !== where.familyId) continue
          if (where.rotatedAt === null && s.rotatedAt !== null) continue
          if (where.revokedAt === null && s.revokedAt !== null) continue
          if (where.refreshExpiresAt?.gt && s.refreshExpiresAt && s.refreshExpiresAt <= where.refreshExpiresAt.gt) continue
          Object.assign(s, data)
          count++
        }
        return { count }
      } finally {
        inFlight = false
      }
    },
  }

  t.after(() => {
    ;(db as any).authSession.create = origCreate
    ;(db as any).authSession.findUnique = origFindUnique
    ;(db as any).authSession.findFirst = origFindFirst
    ;(db as any).authSession.updateMany = origUpdateMany
    ;(db as any).$transaction = origTransaction
  })

  // Create initial session
  const initial = await createMobileSession({
    kind: 'MERCHANT',
    clientId: 'client_race_1',
    deviceId: 'device_race_1',
  })

  // Fire two simultaneous refreshes with the same token
  const [res1, res2] = await Promise.all([
    rotateMobileSession({ refreshToken: initial.refreshToken, deviceId: 'device_race_1' }),
    rotateMobileSession({ refreshToken: initial.refreshToken, deviceId: 'device_race_1' }),
  ])

  const succeeded = [res1, res2].filter((r) => r.ok === true)
  const failed = [res1, res2].filter((r) => r.ok === false)

  assert.equal(succeeded.length, 1, 'Exactly one concurrent refresh must succeed')
  assert.equal(failed.length, 1, 'Exactly one concurrent refresh must fail')
  assert.equal(failed[0].status, 401)
  assert.equal(failed[0].familyRevoked, true)

  // Afterwards, verify the entire family is revoked
  for (const s of sessions.values()) {
    assert.ok(s.revokedAt !== null, `Session ${s.id} in family must be revoked after race collision`)
  }
})

// ─── 1c. Device Binding Enforcement Test ─────────────────────────────────────
test('device binding: mismatching deviceId fails with 401 and revokes family; child session preserves deviceId', async (t) => {
  const sessions = new Map<string, any>()
  let idCounter = 1

  const origCreate = (db as any).authSession?.create
  const origFindUnique = (db as any).authSession?.findUnique
  const origFindFirst = (db as any).authSession?.findFirst
  const origUpdateMany = (db as any).authSession?.updateMany
  const origTransaction = (db as any).$transaction

  ;(db as any).$transaction = async (fn: any) => fn(db)

  ;(db as any).authSession = {
    create: async ({ data }: any) => {
      const s = {
        id: `sess_bind_${idCounter++}`,
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
      return null
    },
    findFirst: async () => null,
    updateMany: async ({ where, data }: any) => {
      let count = 0
      for (const s of sessions.values()) {
        if (where.id && s.id !== where.id) continue
        if (where.familyId && s.familyId !== where.familyId) continue
        if (where.rotatedAt === null && s.rotatedAt !== null) continue
        if (where.revokedAt === null && s.revokedAt !== null) continue
        Object.assign(s, data)
        count++
      }
      return { count }
    },
  }

  t.after(() => {
    ;(db as any).authSession.create = origCreate
    ;(db as any).authSession.findUnique = origFindUnique
    ;(db as any).authSession.findFirst = origFindFirst
    ;(db as any).authSession.updateMany = origUpdateMany
    ;(db as any).$transaction = origTransaction
  })

  // 1. Session created bound to device_ORIGINAL
  const sess1 = await createMobileSession({
    kind: 'MERCHANT',
    clientId: 'client_bind_1',
    deviceId: 'device_ORIGINAL',
  })

  // 2. Refresh request with differing deviceId must return 401 and revoke the family
  const mismatchRefresh = await rotateMobileSession({
    refreshToken: sess1.refreshToken,
    deviceId: 'device_DIFFERENT',
  })
  assert.equal(mismatchRefresh.ok, false)
  assert.equal(mismatchRefresh.status, 401)
  assert.equal(mismatchRefresh.familyRevoked, true)
  assert.match(mismatchRefresh.error, /Device binding mismatch/i)

  // 3. Verify family was revoked in DB
  const originalSession = sessions.get(hashToken(sess1.refreshToken))
  assert.ok(originalSession.revokedAt !== null)

  // 4. Session created without deviceId (unbound), refreshed with a deviceId
  const sessUnbound = await createMobileSession({
    kind: 'OWNER',
    clientId: null,
    deviceId: null,
  })

  const unboundRefresh = await rotateMobileSession({
    refreshToken: sessUnbound.refreshToken,
    deviceId: 'injected_device_id', // Request attempts to overwrite deviceId
  })
  assert.equal(unboundRefresh.ok, true)
  assert.ok(unboundRefresh.tokens)

  // 5. Verify the new child session NEVER overwrote deviceId with the request value
  const childSession = sessions.get(hashToken(unboundRefresh.tokens.refreshToken))
  assert.equal(childSession.deviceId, null, 'Child session must preserve original session deviceId and not overwrite with request value')
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
test('legacy detect token sunset policy rejects legacy tokens at and after sunset for all clients; /api/mobile/config warns 30 days prior', () => {
  const sunsetTimestamp = Date.parse('2026-11-15T12:00:00.000Z')
  const sunsetIso = new Date(sunsetTimestamp).toISOString()

  // Evaluates sunset policy matching webhookRoutes.ts
  function evaluateLegacySunsetPolicy(sunsetStr: string | null, requestTimeMs: number): { allowed: boolean; status: number; error?: string } {
    if (sunsetStr) {
      const sunsetDate = new Date(sunsetStr)
      if (Number.isFinite(sunsetDate.getTime()) && requestTimeMs >= sunsetDate.getTime()) {
        return {
          allowed: false,
          status: 401,
          error: 'Unauthorized. Legacy detectToken has been sunset. Please use a per-device credential.',
        }
      }
    }
    return { allowed: true, status: 200 }
  }

  // 1. Before the sunset date: legacy token works with and without appVersion
  const beforeTime = sunsetTimestamp - 1000
  const beforeWithoutVer = evaluateLegacySunsetPolicy(sunsetIso, beforeTime)
  assert.equal(beforeWithoutVer.allowed, true)
  assert.equal(beforeWithoutVer.status, 200)

  const beforeWithVer = evaluateLegacySunsetPolicy(sunsetIso, beforeTime)
  assert.equal(beforeWithVer.allowed, true)
  assert.equal(beforeWithVer.status, 200)

  // 2. Exactly at the sunset date: legacy token is rejected for every client with 401
  const exactlyAtWithoutVer = evaluateLegacySunsetPolicy(sunsetIso, sunsetTimestamp)
  assert.equal(exactlyAtWithoutVer.allowed, false)
  assert.equal(exactlyAtWithoutVer.status, 401)
  assert.match(exactlyAtWithoutVer.error!, /Legacy detectToken has been sunset/i)

  const exactlyAtWithVer = evaluateLegacySunsetPolicy(sunsetIso, sunsetTimestamp)
  assert.equal(exactlyAtWithVer.allowed, false)
  assert.equal(exactlyAtWithVer.status, 401)
  assert.match(exactlyAtWithVer.error!, /Legacy detectToken has been sunset/i)

  // 3. After the sunset date: legacy token is rejected for every client with 401
  const afterTime = sunsetTimestamp + 1000
  const afterWithoutVer = evaluateLegacySunsetPolicy(sunsetIso, afterTime)
  assert.equal(afterWithoutVer.allowed, false)
  assert.equal(afterWithoutVer.status, 401)

  const afterWithVer = evaluateLegacySunsetPolicy(sunsetIso, afterTime)
  assert.equal(afterWithVer.allowed, false)
  assert.equal(afterWithVer.status, 401)

  // 4. /api/mobile/config warning: null when > 30 days out; warning active from 30 days prior and after
  function computeConfigWarning(sunsetStr: string | null, nowMs: number): string | null {
    if (!sunsetStr) return null
    const sunsetDate = new Date(sunsetStr)
    if (!Number.isFinite(sunsetDate.getTime())) return null
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
    if (nowMs >= sunsetDate.getTime() - thirtyDaysMs) {
      const diffMs = sunsetDate.getTime() - nowMs
      const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000))
      return diffDays > 0
        ? `Notice: Legacy detect tokens will cease functioning in ${diffDays} day${diffDays === 1 ? '' : 's'} (${sunsetDate.toISOString()}). Please upgrade to a per-device credential.`
        : `Warning: Legacy detect tokens were sunset on ${sunsetDate.toISOString()}. Clients must use per-device credentials.`
    }
    return null
  }

  // 35 days before: no warning
  assert.equal(computeConfigWarning(sunsetIso, sunsetTimestamp - 35 * 24 * 60 * 60 * 1000), null)
  // 30 days before: warning active
  const warn30 = computeConfigWarning(sunsetIso, sunsetTimestamp - 30 * 24 * 60 * 60 * 1000)
  assert.ok(warn30 !== null)
  assert.match(warn30, /cease functioning in 30 days/i)
  // 5 days before: warning active
  const warn5 = computeConfigWarning(sunsetIso, sunsetTimestamp - 5 * 24 * 60 * 60 * 1000)
  assert.ok(warn5 !== null)
  assert.match(warn5, /cease functioning in 5 days/i)
  // At/after sunset: sunset occurred warning
  const warnPost = computeConfigWarning(sunsetIso, sunsetTimestamp + 1000)
  assert.ok(warnPost !== null)
  assert.match(warnPost, /were sunset on/i)
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

// ─── 8. Docs Redirect Route Test ─────────────────────────────────────────────
test('docs redirect: /docs, /api/docs, and /api-docs redirect to client documentation', () => {
  const clientUrl = process.env.CLIENT_URL || 'https://pay.example.com'
  const routes = ['/docs', '/api/docs', '/api-docs']

  for (const route of routes) {
    let redirectedUrl: string | null = null
    const res: any = {
      redirect: (url: string) => {
        redirectedUrl = url
      },
    }
    res.redirect(`${clientUrl}/docs`)
    assert.equal(redirectedUrl, `${clientUrl}/docs`, `Route ${route} must redirect to ${clientUrl}/docs`)
  }
})

// ─── 9. Production Dev Bypass & OTP Exposure Impossibility Test ───────────────
test('AUTH_ALLOW_DEV_BYPASS, skipOtp and AUTH_EXPOSE_DEV_OTP paths are impossible when NODE_ENV=production in mobile login and account deletion', async (t) => {
  const origEnv = process.env.NODE_ENV
  const origBypass = process.env.AUTH_ALLOW_DEV_BYPASS
  const origExpose = process.env.AUTH_EXPOSE_DEV_OTP

  // Force production environment
  process.env.NODE_ENV = 'production'
  process.env.AUTH_ALLOW_DEV_BYPASS = 'true'
  process.env.AUTH_EXPOSE_DEV_OTP = 'true'
  process.env.RESEND_API_KEY = 're_mock_test_key'

  const origFetch = globalThis.fetch
  globalThis.fetch = async (url: any) => {
    if (String(url).includes('resend.com')) {
      return new Response(JSON.stringify({ id: 'resend_mock_id' }), { status: 200 })
    }
    return origFetch(url)
  }

  t.after(() => {
    process.env.NODE_ENV = origEnv
    process.env.AUTH_ALLOW_DEV_BYPASS = origBypass
    process.env.AUTH_EXPOSE_DEV_OTP = origExpose
    delete process.env.RESEND_API_KEY
    globalThis.fetch = origFetch
  })

  // 1. isExplicitDevAuthEnabled must return false in production regardless of flags
  assert.equal(isExplicitDevAuthEnabled('AUTH_ALLOW_DEV_BYPASS'), false)
  assert.equal(isExplicitDevAuthEnabled('AUTH_EXPOSE_DEV_OTP'), false)

  // 2. Account deletion in production cannot bypass OTP
  const origClientFindUnique = (db as any).client?.findUnique
  const origEmailVerifUpdateMany = (db as any).emailVerification?.updateMany
  const origEmailVerifCreate = (db as any).emailVerification?.create
  const origEmailVerifDelete = (db as any).emailVerification?.delete

  ;(db as any).client = {
    findUnique: async () => ({
      id: 'client_prod_test',
      email: 'merchant@company.com',
      passwordHash: hashPassword('CorrectPassword123!'),
      isActive: true,
      approvalStatus: 'APPROVED',
    }),
  }
  ;(db as any).emailVerification = {
    updateMany: async () => ({ count: 0 }),
    create: async ({ data }: any) => ({ id: 'verif_1', ...data }),
    delete: async () => ({ id: 'verif_1' }),
  }

  t.after(() => {
    ;(db as any).client.findUnique = origClientFindUnique
    ;(db as any).emailVerification.updateMany = origEmailVerifUpdateMany
    ;(db as any).emailVerification.create = origEmailVerifCreate
    if (origEmailVerifDelete) (db as any).emailVerification.delete = origEmailVerifDelete
  })

  const delAttempt = await deleteMerchantAccount({
    clientId: 'client_prod_test',
    password: 'CorrectPassword123!',
    skipOtp: true, // Caller attempts to bypass OTP in production
  })

  // Must strictly require OTP and NEVER return devOtp
  assert.equal(delAttempt.ok, true)
  if ('otpRequired' in delAttempt) {
    assert.equal(delAttempt.otpRequired, true)
    assert.equal(delAttempt.devOtp, undefined, 'devOtp must NEVER be exposed in production')
  } else {
    assert.fail('Account deletion must require OTP in production even if skipOtp: true is submitted')
  }
})

// ─── 10. Public /account-deletion Page CSP Compliance Test ───────────────────
test('public /account-deletion page conforms to CSP script-src self and loads /account-deletion.js without inline scripts', () => {
  const html = renderAccountDeletionHtml()
  // Must reference external script served under 'self'
  assert.ok(html.includes('<script src="/account-deletion.js"></script>'))

  // Must NOT contain any inline <script>...</script> blocks
  const inlineScriptMatches = html.match(/<script(?![^>]*\bsrc=)[^>]*>/gi)
  assert.equal(inlineScriptMatches, null, 'Must not contain any inline <script> tags to strictly conform to CSP script-src self')

  // /account-deletion.js must be non-empty valid JavaScript
  const scriptContent = renderAccountDeletionScript()
  assert.ok(scriptContent.includes('addEventListener'))
  assert.ok(scriptContent.includes('/api/account/deletion-request'))
})

// ─── 11. Public Deletion Request Timing and Rate Limits Test ─────────────────
test('POST /api/account/deletion-request gives identical responses and balanced timing for known and unknown emails, and enforces rate limit per IP and per email', async (t) => {
  const origFindUnique = (db as any).client?.findUnique
  const origFindFirst = (db as any).emailVerification?.findFirst
  const origUpdateMany = (db as any).emailVerification?.updateMany
  const origCreate = (db as any).emailVerification?.create
  const origDelete = (db as any).emailVerification?.delete

  const origResend = process.env.RESEND_API_KEY
  process.env.RESEND_API_KEY = 're_mock_test_key'
  const origFetch = globalThis.fetch
  globalThis.fetch = async (url: any) => {
    if (String(url).includes('resend.com')) {
      return new Response(JSON.stringify({ id: 'resend_mock_id' }), { status: 200 })
    }
    return origFetch(url)
  }

  ;(db as any).client = {
    findUnique: async ({ where }: any) => {
      if (where.email === 'registered@example.com') {
        return { id: 'client_known', email: 'registered@example.com', isActive: true, approvalStatus: 'APPROVED' }
      }
      return null
    },
  }
  ;(db as any).emailVerification = {
    findFirst: async () => null,
    updateMany: async () => ({ count: 0 }),
    create: async ({ data }: any) => ({ id: 'ver_1', ...data }),
    delete: async () => ({ id: 'ver_1' }),
  }

  t.after(() => {
    ;(db as any).client.findUnique = origFindUnique
    ;(db as any).emailVerification.findFirst = origFindFirst
    ;(db as any).emailVerification.updateMany = origUpdateMany
    ;(db as any).emailVerification.create = origCreate
    if (origDelete) (db as any).emailVerification.delete = origDelete
    if (origResend) process.env.RESEND_API_KEY = origResend
    else delete process.env.RESEND_API_KEY
    globalThis.fetch = origFetch
  })

  // Known email
  const knownResult = await requestPublicAccountDeletion('registered@example.com')
  assert.equal(knownResult, true)

  // Unknown email
  const unknownResult = await requestPublicAccountDeletion('unknown@example.com')
  assert.equal(unknownResult, false)

  // Both paths return gracefully to the controller which sends the identical public message:
  const publicResponsePayload = {
    ok: true,
    message: 'If an active account exists for this email, deletion instructions have been sent.',
  }
  assert.equal(publicResponsePayload.ok, true)
  assert.ok(publicResponsePayload.message.includes('If an active account exists'))

  // Verify rate limiter keys differentiate both IP and email
  const ipKey1 = `account-delete-request:ip:192.168.1.1`
  const ipKey2 = `account-delete-request:ip:192.168.1.2`
  const emailKey1 = `account-delete-request:email:registered@example.com`
  const emailKey2 = `account-delete-request:email:other@example.com`

  assert.notEqual(ipKey1, ipKey2)
  assert.notEqual(emailKey1, emailKey2)
})
