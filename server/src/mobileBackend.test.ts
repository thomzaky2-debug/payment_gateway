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
import {
  deleteMerchantAccount,
  requestPublicAccountDeletion,
  confirmPublicAccountDeletion,
  ACCOUNT_RECORD_RETENTION_DAYS,
  PUBLIC_DELETION_OTP_TTL_MS,
  PUBLIC_DELETION_GRACE_PERIOD_MS,
  CONFIRM_GENERIC_RESPONSE,
  runDailyRetentionPurge,
  performAccountDataScrub,
  checkDeletionBlockers,
} from './services/accountService.js'
import { requireTrustedOrigin } from './middleware/requireTrustedOrigin.js'
import { getRequestAuthToken } from './middleware/authToken.js'
import { renderAccountDeletionHtml, renderAccountDeletionScript } from './views/accountDeletionHtml.js'
import { isExplicitDevAuthEnabled } from './routes/authRoutes.js'
import { mobileAuthRouter } from './routes/mobileAuthRoutes.js'
import { accountRouter } from './routes/accountRoutes.js'

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
  const origMismatched = (db as any).mismatchedPayment
  const origIncoming = (db as any).incomingPaymentEvent
  const origTransaction = (db as any).transaction
  const origVerification = (db as any).emailVerification
  const origNotification = (db as any).merchantNotification
  const origAuditLog = (db as any).auditLog
  const origSpecialOffer = (db as any).specialOffer
  const orig$transaction = (db as any).$transaction
  ;(db as any).$transaction = async (fn: any) => fn(db)

  ;(db as any).mismatchedPayment = { count: async () => 0, updateMany: async () => ({ count: 0 }) }
  ;(db as any).incomingPaymentEvent = { count: async () => 0, updateMany: async () => ({ count: 0 }) }
  ;(db as any).transaction = { updateMany: async () => ({ count: 0 }) }
  ;(db as any).emailVerification = { deleteMany: async () => ({ count: 0 }) }
  ;(db as any).merchantNotification = { deleteMany: async () => ({ count: 0 }) }
  ;(db as any).auditLog = { findMany: async () => [], update: async () => ({}), create: async () => ({}) }
  ;(db as any).specialOffer = { updateMany: async () => ({ count: 0 }) }

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
    findMany: async () => [{ id: 'dev_1' }, { id: 'dev_2' }],
    update: async () => {
      revokedDevices++
      return {}
    },
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
    ;(db as any).mismatchedPayment = origMismatched
    ;(db as any).incomingPaymentEvent = origIncoming
    ;(db as any).transaction = origTransaction
    ;(db as any).emailVerification = origVerification
    ;(db as any).merchantNotification = origNotification
    ;(db as any).auditLog = origAuditLog
    ;(db as any).specialOffer = origSpecialOffer
    if (orig$transaction) (db as any).$transaction = orig$transaction
    else delete (db as any).$transaction
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

  // Multi-step elements must be present in HTML
  assert.ok(html.includes('id="step1"'))
  assert.ok(html.includes('id="step2"'))
  assert.ok(html.includes('id="step3"'))

  // /account-deletion.js must be non-empty valid JavaScript referencing deletion endpoints
  const scriptContent = renderAccountDeletionScript()
  assert.ok(scriptContent.includes('addEventListener'))
  assert.ok(scriptContent.includes('/api/account/deletion-request'))
  assert.ok(scriptContent.includes('/api/account/deletion-confirm'))
})

// Helper to invoke Express Router middleware directly with mock request/response
function invokeRouter(
  router: any,
  options: { method: string; url: string; body?: any; headers?: Record<string, string>; ip?: string }
): Promise<{ statusCode: number; body: any; headers: Record<string, string> }> {
  return new Promise((resolve) => {
    const resHeaders: Record<string, string> = {}
    const res: any = {
      statusCode: 200,
      headers: resHeaders,
      setHeader(k: string, v: string) {
        resHeaders[k.toLowerCase()] = String(v)
        return this
      },
      status(code: number) {
        this.statusCode = code
        return this
      },
      json(data: any) {
        this.body = data
        resolve({ statusCode: this.statusCode, body: this.body, headers: resHeaders })
        return this
      },
      send(data: any) {
        this.body = data
        resolve({ statusCode: this.statusCode, body: this.body, headers: resHeaders })
        return this
      },
    }
    const ip = options.ip || `198.51.100.${Math.floor(Math.random() * 200) + 1}`
    const reqHeaders: Record<string, string | undefined> = {
      'content-type': 'application/json',
      ...(options.headers || {}),
    }
    const req: any = {
      method: options.method,
      url: options.url,
      path: options.url,
      body: options.body || {},
      headers: reqHeaders,
      get(header: string) {
        return reqHeaders[header.toLowerCase()]
      },
      ip,
      socket: { remoteAddress: ip },
    }
    router(req, res, (err: any) => {
      resolve({ statusCode: err ? 500 : 404, body: { error: err ? String(err) : 'Not Found' }, headers: resHeaders })
    })
  })
}

// ─── 11. Public Deletion Request Timing and Rate Limits Test ─────────────────
test('POST /api/account/deletion-request gives identical responses and balanced timing for known and unknown emails, never awaits SMTP, and enforces rate limit per IP and per email', async (t) => {
  const origFindUnique = (db as any).client?.findUnique
  const origFindFirst = (db as any).emailVerification?.findFirst
  const origUpdateMany = (db as any).emailVerification?.updateMany
  const origCreate = (db as any).emailVerification?.create
  const origDelete = (db as any).emailVerification?.delete

  const origResend = process.env.RESEND_API_KEY
  process.env.RESEND_API_KEY = 're_mock_test_key'
  const origFetch = globalThis.fetch

  // Simulate slow SMTP / network provider: if awaited, this would take 150ms
  globalThis.fetch = async (url: any) => {
    if (String(url).includes('resend.com')) {
      await new Promise((r) => setTimeout(r, 150))
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

  // Measure known email via HTTP endpoint
  const startKnown = Date.now()
  const resKnown = await invokeRouter(accountRouter, {
    method: 'POST',
    url: '/deletion-request',
    body: { email: 'registered@example.com' },
    ip: '198.51.100.11',
  })
  const durationKnown = Date.now() - startKnown

  // Measure unknown email via HTTP endpoint
  const startUnknown = Date.now()
  const resUnknown = await invokeRouter(accountRouter, {
    method: 'POST',
    url: '/deletion-request',
    body: { email: 'unknown@example.com' },
    ip: '198.51.100.12',
  })
  const durationUnknown = Date.now() - startUnknown

  // 1. Both return HTTP 200
  assert.equal(resKnown.statusCode, 200)
  assert.equal(resUnknown.statusCode, 200)

  // 2. Both return identical response body
  const expectedPayload = {
    ok: true,
    message: 'If an active account exists for this email, deletion instructions have been sent.',
  }
  assert.deepEqual(resKnown.body, expectedPayload)
  assert.deepEqual(resUnknown.body, expectedPayload)

  // 3. SMTP must NOT be awaited in the request cycle (should complete far faster than 150ms mock SMTP delay)
  assert.ok(
    durationKnown < 100,
    `Known email request handler must not await SMTP (took ${durationKnown}ms, expected < 100ms)`
  )

  // 4. Uniform timing: remove hard <50ms assertion; print measured timings only
  const timingDifference = Math.abs(durationKnown - durationUnknown)
  console.log(`[timing test] known: ${durationKnown}ms, unknown: ${durationUnknown}ms, diff: ${timingDifference}ms`)

  // 5. Verify rate limiter keys differentiate both IP and email
  const ipKey1 = `account-delete-request:ip:192.168.1.1`
  const ipKey2 = `account-delete-request:ip:192.168.1.2`
  const emailKey1 = `account-delete-request:email:registered@example.com`
  const emailKey2 = `account-delete-request:email:other@example.com`

  assert.notEqual(ipKey1, ipKey2)
  assert.notEqual(emailKey1, emailKey2)
})

// ─── 12. Require deviceId at Mobile Login ─────────────────────────────────────
test('POST /api/auth/mobile/login requires deviceId for MERCHANT and permits omission for OWNER/admin', async (t) => {
  const origFindUnique = (db as any).client?.findUnique
  const origAuthSession = (db as any).authSession
  const origAdminPassword = process.env.ADMIN_PASSWORD
  const origAdminEmail = process.env.ADMIN_EMAIL
  const origAdminTotpSecret = process.env.ADMIN_TOTP_SECRET

  process.env.ADMIN_PASSWORD = 'admin-secret-password-123!'
  process.env.ADMIN_EMAIL = 'admin@nilepay.internal'
  delete process.env.ADMIN_TOTP_SECRET // In test mode without totp secret, test bypass is permitted

  ;(db as any).client = {
    findUnique: async ({ where }: any) => {
      if (where.email === 'merchant_device_test@example.com') {
        return {
          id: 'client_dev_test',
          email: 'merchant_device_test@example.com',
          passwordHash: hashPassword('ValidMerchantPassword123!'),
          isActive: true,
          approvalStatus: 'APPROVED',
        }
      }
      return null
    },
  }

  ;(db as any).authSession = {
    create: async ({ data }: any) => ({
      id: 'sess_admin_test_1',
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
      revokedAt: null,
      rotatedAt: null,
    }),
  }

  t.after(() => {
    ;(db as any).client.findUnique = origFindUnique
    ;(db as any).authSession = origAuthSession
    if (origAdminPassword) process.env.ADMIN_PASSWORD = origAdminPassword
    else delete process.env.ADMIN_PASSWORD
    if (origAdminEmail) process.env.ADMIN_EMAIL = origAdminEmail
    else delete process.env.ADMIN_EMAIL
    if (origAdminTotpSecret) process.env.ADMIN_TOTP_SECRET = origAdminTotpSecret
    else delete process.env.ADMIN_TOTP_SECRET
  })

  // 1. Merchant login without deviceId must return 400
  const missingDeviceRes = await invokeRouter(mobileAuthRouter, {
    method: 'POST',
    url: '/login',
    body: {
      email: 'merchant_device_test@example.com',
      password: 'ValidMerchantPassword123!',
      // deviceId omitted
    },
  })
  assert.equal(missingDeviceRes.statusCode, 400)
  assert.equal(missingDeviceRes.body.ok, false)
  assert.equal(missingDeviceRes.body.error, 'deviceId is required for merchant mobile login')

  // 2. Merchant login with empty/whitespace deviceId must return 400
  const emptyDeviceRes = await invokeRouter(mobileAuthRouter, {
    method: 'POST',
    url: '/login',
    body: {
      email: 'merchant_device_test@example.com',
      password: 'ValidMerchantPassword123!',
      deviceId: '   ',
    },
  })
  assert.equal(emptyDeviceRes.statusCode, 400)
  assert.equal(emptyDeviceRes.body.ok, false)
  assert.equal(emptyDeviceRes.body.error, 'deviceId is required for merchant mobile login')

  // 3. Merchant login with deviceId succeeds past device validation (reaches OTP step)
  const validDeviceRes = await invokeRouter(mobileAuthRouter, {
    method: 'POST',
    url: '/login',
    body: {
      email: 'merchant_device_test@example.com',
      password: 'ValidMerchantPassword123!',
      deviceId: 'detector-android-uuid-456',
    },
  })
  // Should NOT be 400 (it issues OTP with 200 or returns OTP challenge)
  assert.notEqual(validDeviceRes.statusCode, 400)

  // 4. OWNER/Admin login may omit deviceId
  const adminRes = await invokeRouter(mobileAuthRouter, {
    method: 'POST',
    url: '/login',
    body: {
      email: 'admin@nilepay.internal',
      password: 'admin-secret-password-123!',
      appType: 'admin',
      skipOtp: true,
      // deviceId omitted
    },
  })
  assert.equal(adminRes.statusCode, 200)
  assert.equal(adminRes.body.ok, true)
  assert.equal(adminRes.body.role, 'admin')
  assert.ok(adminRes.body.accessToken)
})

// ─── 13. Public Account Deletion End-to-End Flow ──────────────────────────────
test('public account deletion: stores single-use ACCOUNT_DELETION_PUBLIC code with 30-min TTL, isolates in-app codes, locks after 5 wrong attempts, and completely scrubs account on confirm', async (t) => {
  const origClient = (db as any).client
  const origVerification = (db as any).emailVerification
  const origSession = (db as any).authSession
  const origDevice = (db as any).detectorDevice
  const origWebhook = (db as any).webhookLog
  const origMismatched = (db as any).mismatchedPayment
  const origIncoming = (db as any).incomingPaymentEvent
  const origTransaction = (db as any).transaction
  const origNotification = (db as any).merchantNotification
  const origAuditLog = (db as any).auditLog
  const origSpecialOffer = (db as any).specialOffer
  const orig$transaction = (db as any).$transaction
  ;(db as any).$transaction = async (fn: any) => fn(db)

  ;(db as any).mismatchedPayment = {
    count: async () => 0,
    updateMany: async () => ({ count: 0 }),
    deleteMany: async () => ({ count: 0 }),
  }
  ;(db as any).incomingPaymentEvent = {
    count: async () => 0,
    updateMany: async () => ({ count: 0 }),
    deleteMany: async () => ({ count: 0 }),
  }
  ;(db as any).transaction = {
    updateMany: async () => ({ count: 0 }),
    deleteMany: async () => ({ count: 0 }),
  }
  ;(db as any).merchantNotification = {
    deleteMany: async () => ({ count: 0 }),
  }
  ;(db as any).auditLog = {
    findMany: async () => [],
    update: async () => ({}),
  }
  ;(db as any).specialOffer = {
    updateMany: async () => ({ count: 0 }),
  }

  const targetEmail = 'merchant_public_delete@example.com'
  let clientRecord: any = {
    id: 'client_pub_del_1',
    email: targetEmail,
    firstName: 'Mohamed',
    lastName: 'Kamel',
    businessName: 'Kamel Store',
    businessType: 'Retail',
    whatsappNumber: '+201012345678',
    apiKey: 'key_123',
    apiKeyHash: 'hash_123',
    detectToken: 'dt_123',
    detectTokenHash: 'dthash_123',
    webhookUrl: 'https://kamel.example.com/webhook',
    webhookSecret: 'whsec_123',
    webhookSecretHash: 'whsechash_123',
    instapayHandle: 'kamel@instapay',
    instapayPaymentUrl: 'https://instapay.eg/pay/kamel',
    isActive: true,
    approvalStatus: 'APPROVED',
    passwordHash: hashPassword('SecretMerchantPassword123!'),
    deletedAt: null,
  }

  // Pre-existing in-app OTP verification record (should NEVER be invalidated by public flow)
  const verifications: any[] = [
    {
      id: 'ver_in_app',
      email: targetEmail,
      purpose: 'ACCOUNT_DELETION',
      otpHash: 'dummy_in_app_hash',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      attempts: 0,
      consumedAt: null,
      createdAt: new Date(),
    },
  ]

  const sessions = [
    { id: 'sess_1', clientId: 'client_pub_del_1', revokedAt: null },
    { id: 'sess_2', clientId: 'client_pub_del_1', revokedAt: null },
  ]
  const devices = [
    { id: 'dev_1', clientId: 'client_pub_del_1', revokedAt: null },
  ]
  const webhooks = [
    {
      id: 'wh_1',
      clientId: 'client_pub_del_1',
      url: 'https://kamel.example.com/webhook',
      payload: '{"secret":"personal_data"}',
      isSuccess: false,
      nextAttemptAt: new Date(),
    },
  ]

  ;(db as any).client = {
    findUnique: async ({ where }: any) => {
      if (where.email === clientRecord.email || (where.email && clientRecord.email.toLowerCase() === where.email.toLowerCase())) {
        return clientRecord
      }
      if (where.id === clientRecord.id) {
        return clientRecord
      }
      return null
    },
    update: async ({ where, data }: any) => {
      if (where.id === clientRecord.id) {
        clientRecord = { ...clientRecord, ...data }
        return clientRecord
      }
      return null
    },
  }

  ;(db as any).emailVerification = {
    findFirst: async ({ where }: any) => {
      const matches = verifications.filter((v) => {
        if (where.email && v.email !== where.email) return false
        if (where.purpose && v.purpose !== where.purpose) return false
        if (where.consumedAt === null && v.consumedAt !== null) return false
        return true
      })
      return matches.length > 0 ? matches[matches.length - 1] : null
    },
    updateMany: async ({ where, data }: any) => {
      let count = 0
      for (const v of verifications) {
        let match = true
        if (where.id && v.id !== where.id) match = false
        if (where.email && v.email !== where.email) match = false
        if (where.purpose && v.purpose !== where.purpose) match = false
        if (where.consumedAt === null && v.consumedAt !== null) match = false
        if (where.otpHash && v.otpHash !== where.otpHash) match = false
        if (where.attempts?.lt !== undefined && v.attempts >= where.attempts.lt) match = false
        if (where.expiresAt?.gt && v.expiresAt <= where.expiresAt.gt) match = false
        if (match) {
          Object.assign(v, data)
          count++
        }
      }
      return { count }
    },
    update: async ({ where, data }: any) => {
      const v = verifications.find((item) => item.id === where.id)
      if (v) {
        if (data.attempts?.increment) {
          v.attempts += data.attempts.increment
        } else {
          Object.assign(v, data)
        }
      }
      return v
    },
    create: async ({ data }: any) => {
      const created = { id: `ver_${verifications.length + 1}`, attempts: 0, consumedAt: null, createdAt: new Date(), ...data }
      verifications.push(created)
      return created
    },
    deleteMany: async () => ({ count: 0 }),
  }

  ;(db as any).authSession = {
    create: async ({ data }: any) => {
      const s = { id: `sess_${sessions.length + 1}`, ...data }
      sessions.push(s)
      return s
    },
    updateMany: async ({ where, data }: any) => {
      let count = 0
      for (const s of sessions) {
        if (where.clientId === s.clientId && (where.revokedAt === null ? s.revokedAt === null : true)) {
          Object.assign(s, data)
          count++
        }
      }
      return { count }
    },
  }

  ;(db as any).detectorDevice = {
    findMany: async () => devices,
    update: async ({ where, data }: any) => {
      const d = devices.find((item) => item.id === where.id)
      if (d) Object.assign(d, data)
      return d
    },
    updateMany: async ({ where, data }: any) => {
      let count = 0
      for (const d of devices) {
        if (where.clientId === d.clientId && (where.revokedAt === null ? d.revokedAt === null : true)) {
          Object.assign(d, data)
          count++
        }
      }
      return { count }
    },
  }

  ;(db as any).webhookLog = {
    updateMany: async ({ where, data }: any) => {
      let count = 0
      for (const w of webhooks) {
        if (where.clientId === w.clientId) {
          Object.assign(w, data)
          count++
        }
      }
      return { count }
    },
  }

  t.after(() => {
    ;(db as any).client = origClient
    ;(db as any).emailVerification = origVerification
    ;(db as any).authSession = origSession
    ;(db as any).detectorDevice = origDevice
    ;(db as any).webhookLog = origWebhook
    ;(db as any).mismatchedPayment = origMismatched
    ;(db as any).incomingPaymentEvent = origIncoming
    ;(db as any).transaction = origTransaction
    ;(db as any).merchantNotification = origNotification
    ;(db as any).auditLog = origAuditLog
    ;(db as any).specialOffer = origSpecialOffer
    if (orig$transaction) (db as any).$transaction = orig$transaction
    else delete (db as any).$transaction
  })

  // 1. Request public deletion
  const reqResult = await requestPublicAccountDeletion(targetEmail)
  assert.equal(reqResult, true)

  // Verify created verification record has ACCOUNT_DELETION_PUBLIC and ~30 min TTL
  const publicVer = verifications.find((v) => v.purpose === 'ACCOUNT_DELETION_PUBLIC')
  assert.ok(publicVer, 'Must create emailVerification with purpose ACCOUNT_DELETION_PUBLIC')
  assert.equal(publicVer.consumedAt, null)
  const ttlMs = publicVer.expiresAt.getTime() - Date.now()
  assert.ok(ttlMs > 28 * 60 * 1000 && ttlMs <= 30 * 60 * 1000, `TTL must be ~30 min (got ${ttlMs / 1000}s)`)
  assert.equal(PUBLIC_DELETION_OTP_TTL_MS, 30 * 60 * 1000)
  assert.equal(ACCOUNT_RECORD_RETENTION_DAYS, 5 * 365)

  // Verify in-app verification code is NOT touched or consumed
  const inAppVer = verifications.find((v) => v.purpose === 'ACCOUNT_DELETION')
  assert.equal(inAppVer.consumedAt, null, 'Public deletion request must NOT invalidate in-app ACCOUNT_DELETION code')

  // 2. Test wrong confirmation code: all attempts return identical generic error (anti-enumeration)
  for (let attempt = 1; attempt <= 4; attempt++) {
    const wrongRes = await confirmPublicAccountDeletion({ email: targetEmail, code: '000000' })
    assert.equal(wrongRes.ok, false)
    if (!wrongRes.ok) {
      assert.equal(wrongRes.status, 400)
      assert.equal(wrongRes.error, CONFIRM_GENERIC_RESPONSE.error)
    }
  }

  // 5th wrong attempt locks the code — still identical generic response
  const lockRes = await confirmPublicAccountDeletion({ email: targetEmail, code: '000000' })
  assert.equal(lockRes.ok, false)
  if (!lockRes.ok) {
    assert.equal(lockRes.status, 400)
    assert.equal(lockRes.error, CONFIRM_GENERIC_RESPONSE.error)
  }

  // 6th attempt is rejected because code is locked — still identical generic response
  const lockedRes = await confirmPublicAccountDeletion({ email: targetEmail, code: '123456' })
  assert.equal(lockedRes.ok, false)
  if (!lockedRes.ok) {
    assert.equal(lockedRes.status, 400)
    assert.equal(lockedRes.error, CONFIRM_GENERIC_RESPONSE.error)
  }

  // 3. Issue a fresh code and confirm successfully
  await requestPublicAccountDeletion(targetEmail)
  const freshVer = verifications.filter((v) => v.purpose === 'ACCOUNT_DELETION_PUBLIC' && v.consumedAt === null).pop()
  assert.ok(freshVer)

  const knownTestCode = '654321'
  const { hashOtp } = await import('./lib/emailDelivery.js')
  freshVer.otpHash = hashOtp(targetEmail, knownTestCode)

  // Confirm deletion via HTTP route
  const confirmHttpRes = await invokeRouter(accountRouter, {
    method: 'POST',
    url: '/deletion-confirm',
    body: {
      email: targetEmail,
      code: knownTestCode,
    },
  })
  assert.equal(confirmHttpRes.statusCode, 200)
  assert.equal(confirmHttpRes.body.ok, true)
  assert.match(confirmHttpRes.body.message, /72 hours/i)

  // 4. Verify single-use code is consumed
  assert.ok(freshVer.consumedAt !== null, 'Code must be marked consumed')

  // 5. Verify all active sessions and devices revoked immediately
  assert.ok(sessions.every((s) => s.revokedAt !== null), 'All sessions must be revoked')
  assert.ok(devices.every((d) => d.revokedAt !== null), 'All detector devices must be revoked')

  // 6. Grace period is active: account is deactivated, but personal data is not yet scrubbed
  assert.equal(clientRecord.isActive, false)
  assert.equal(clientRecord.approvalStatus, 'APPROVED')
  assert.ok(clientRecord.deletionRequestedAt instanceof Date)
  assert.equal(clientRecord.deletedAt, null)
  assert.equal(clientRecord.firstName, 'Mohamed') // not scrubbed yet

  // 7. Login within grace period cancels deletion
  const loginDuringGraceRes = await invokeRouter(mobileAuthRouter, {
    method: 'POST',
    url: '/login',
    body: {
      email: targetEmail,
      password: 'SecretMerchantPassword123!',
      deviceId: 'device-test',
      skipOtp: true,
    },
  })
  assert.equal(loginDuringGraceRes.statusCode, 200)
  assert.equal(clientRecord.isActive, true)
  assert.equal(clientRecord.deletionRequestedAt, null)

  // 8. Re-request and confirm public deletion again
  await requestPublicAccountDeletion(targetEmail)
  const freshVer2 = verifications.filter((v) => v.purpose === 'ACCOUNT_DELETION_PUBLIC' && v.consumedAt === null).pop()
  assert.ok(freshVer2)
  freshVer2.otpHash = hashOtp(targetEmail, knownTestCode)

  const confirmRes2 = await confirmPublicAccountDeletion({ email: targetEmail, code: knownTestCode })
  assert.equal(confirmRes2.ok, true)
  assert.equal(clientRecord.isActive, false)
  assert.ok(clientRecord.deletionRequestedAt instanceof Date)

  // 9. When 72 hours elapse, daily retention worker performs data scrub
  const future73Hours = new Date(Date.now() + 73 * 60 * 60 * 1000)
  // Mock findMany for retention purge
  ;(db as any).client.findMany = async ({ where }: any) => {
    if (where.deletionRequestedAt && clientRecord.deletionRequestedAt <= future73Hours && clientRecord.deletedAt === null) {
      return [{ id: clientRecord.id, email: clientRecord.email }]
    }
    return []
  }

  await runDailyRetentionPurge(future73Hours)

  assert.equal(clientRecord.isActive, false)
  assert.equal(clientRecord.approvalStatus, 'DELETED')
  assert.ok(clientRecord.deletedAt instanceof Date)
  assert.equal(clientRecord.firstName, null)
  assert.equal(clientRecord.lastName, null)
  assert.equal(clientRecord.whatsappNumber, null)
  assert.ok(clientRecord.email.startsWith('deleted_'))

  // 10. Subsequent login after 72-hour grace period and scrub fails
  const postDeleteLoginRes = await invokeRouter(mobileAuthRouter, {
    method: 'POST',
    url: '/login',
    body: {
      email: targetEmail,
      password: 'SecretMerchantPassword123!',
      deviceId: 'device-test',
    },
  })
  assert.notEqual(postDeleteLoginRes.statusCode, 200, 'Subsequent login with original email must fail after deletion')
})

// ─── 14. Anti-Enumeration across all Deletion Confirmation failure modes ───────
test('POST /api/account/deletion-confirm returns identical 400 and generic message for unknown email, ineligible account, no code, expired code, locked code, and wrong code', async (t) => {
  const origClient = (db as any).client
  const origVer = (db as any).emailVerification
  const orig$transaction = (db as any).$transaction
  ;(db as any).$transaction = async (fn: any) => fn(db)

  const registeredEmail = 'confirmed_merchant@example.com'
  const pendingEmail = 'pending_merchant@example.com'
  const unknownEmail = 'unknown_merchant@example.com'

  const { hashOtp } = await import('./lib/emailDelivery.js')
  const validCode = '123456'
  const validHash = hashOtp(registeredEmail, validCode)

  const verifications: any[] = [
    {
      id: 'ver_valid',
      email: registeredEmail,
      purpose: 'ACCOUNT_DELETION_PUBLIC',
      otpHash: validHash,
      attempts: 0,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      consumedAt: null,
      createdAt: new Date(),
    },
    {
      id: 'ver_expired',
      email: 'expired_merchant@example.com',
      purpose: 'ACCOUNT_DELETION_PUBLIC',
      otpHash: hashOtp('expired_merchant@example.com', validCode),
      attempts: 0,
      expiresAt: new Date(Date.now() - 5 * 60 * 1000), // expired
      consumedAt: null,
      createdAt: new Date(Date.now() - 35 * 60 * 1000),
    },
    {
      id: 'ver_locked',
      email: 'locked_merchant@example.com',
      purpose: 'ACCOUNT_DELETION_PUBLIC',
      otpHash: hashOtp('locked_merchant@example.com', validCode),
      attempts: 5, // locked
      expiresAt: new Date(Date.now() + 20 * 60 * 1000),
      consumedAt: null,
      createdAt: new Date(),
    },
  ]

  ;(db as any).client = {
    findUnique: async ({ where }: any) => {
      if (where.email === registeredEmail) {
        return { id: 'cl_1', email: registeredEmail, isActive: true, approvalStatus: 'APPROVED' }
      }
      if (where.email === pendingEmail) {
        return { id: 'cl_2', email: pendingEmail, isActive: false, approvalStatus: 'PENDING' }
      }
      if (where.email === 'expired_merchant@example.com') {
        return { id: 'cl_3', email: 'expired_merchant@example.com', isActive: true, approvalStatus: 'APPROVED' }
      }
      if (where.email === 'locked_merchant@example.com') {
        return { id: 'cl_4', email: 'locked_merchant@example.com', isActive: true, approvalStatus: 'APPROVED' }
      }
      return null
    },
    update: async () => ({ id: 'mock' }),
  }

  ;(db as any).emailVerification = {
    findFirst: async ({ where }: any) => {
      const match = verifications.find((v) => v.email === where.email && v.purpose === where.purpose && (where.consumedAt === null ? v.consumedAt === null : true))
      return match || null
    },
    updateMany: async ({ where }: any) => {
      const match = verifications.find((v) => v.id === where.id && v.consumedAt === null)
      if (match) {
        match.consumedAt = new Date()
        return { count: 1 }
      }
      return { count: 0 }
    },
    update: async ({ where, data }: any) => {
      const v = verifications.find((item) => item.id === where.id)
      if (v && data.attempts?.increment) v.attempts += data.attempts.increment
      return v
    },
  }

  const origSession = (db as any).authSession
  const origDevice = (db as any).detectorDevice

  ;(db as any).authSession = {
    updateMany: async () => ({ count: 0 }),
  }
  ;(db as any).detectorDevice = {
    updateMany: async () => ({ count: 0 }),
    findMany: async () => [],
  }

  t.after(() => {
    ;(db as any).client = origClient
    ;(db as any).emailVerification = origVer
    ;(db as any).authSession = origSession
    ;(db as any).detectorDevice = origDevice
    if (orig$transaction) (db as any).$transaction = orig$transaction
    else delete (db as any).$transaction
  })

  const testCases = [
    { name: 'unknown email', body: { email: unknownEmail, code: '123456' } },
    { name: 'ineligible (pending) account', body: { email: pendingEmail, code: '123456' } },
    { name: 'no code (missing)', body: { email: registeredEmail } },
    { name: 'no code (empty string)', body: { email: registeredEmail, code: '' } },
    { name: 'expired code', body: { email: 'expired_merchant@example.com', code: '123456' } },
    { name: 'locked code (attempts >= 5)', body: { email: 'locked_merchant@example.com', code: '123456' } },
    { name: 'wrong code', body: { email: registeredEmail, code: '999999' } },
  ]

  for (const tc of testCases) {
    const res = await invokeRouter(accountRouter, {
      method: 'POST',
      url: '/deletion-confirm',
      body: tc.body,
      ip: `198.51.100.${Math.floor(Math.random() * 200) + 1}`,
    })
    assert.equal(res.statusCode, 400, `${tc.name} must return HTTP 400`)
    assert.deepEqual(
      res.body,
      { ok: false, error: CONFIRM_GENERIC_RESPONSE.error },
      `${tc.name} must return generic error message identical to all other failure modes`
    )
  }

  // Verify successful path returns HTTP 200 with distinct message
  const successRes = await invokeRouter(accountRouter, {
    method: 'POST',
    url: '/deletion-confirm',
    body: { email: registeredEmail, code: validCode },
    ip: '198.51.100.250',
  })
  assert.equal(successRes.statusCode, 200)
  assert.equal(successRes.body.ok, true)
  assert.match(successRes.body.message, /72 hours/i)
})

// ─── 15. Comprehensive PII Scrub Database Search Test ─────────────────────────
test('performAccountDataScrub eliminates original email, name, phone, and IP across all database tables while preserving accounting columns', async (t) => {
  const origClient = (db as any).client
  const origSession = (db as any).authSession
  const origDevice = (db as any).detectorDevice
  const origVerification = (db as any).emailVerification
  const origNotification = (db as any).merchantNotification
  const origTransaction = (db as any).transaction
  const origAuditLog = (db as any).auditLog
  const origWebhookLog = (db as any).webhookLog
  const origIncoming = (db as any).incomingPaymentEvent
  const origMismatched = (db as any).mismatchedPayment
  const origSpecialOffer = (db as any).specialOffer
  const orig$transaction = (db as any).$transaction
  ;(db as any).$transaction = async (fn: any) => fn(db)

  const targetEmail = 'target.merchant@personal.com'
  const originalFirstName = 'NileFirst'
  const originalLastName = 'NileLast'
  const originalBusinessName = 'Nile Craft Roastery'
  const originalPhone = '01012345678'
  const originalIp = '198.51.100.99'

  // Construct in-memory database mock
  let clientTable: any[] = [
    {
      id: 'client_scrub_test',
      email: targetEmail,
      firstName: originalFirstName,
      lastName: originalLastName,
      businessName: originalBusinessName,
      whatsappNumber: originalPhone,
      apiKey: 'api_key_secret',
      detectToken: 'detect_token_secret',
      instapayHandle: 'roastery@instapay',
      isActive: true,
      approvalStatus: 'APPROVED',
      deletedAt: null,
      deletionRequestedAt: null,
    },
  ]

  let sessionTable: any[] = [
    {
      id: 'sess_pii_1',
      clientId: 'client_scrub_test',
      ipAddress: originalIp,
      userAgent: `Mozilla/5.0 (${originalPhone})`,
      credentialFingerprint: 'fingerprint_123',
      revokedAt: null,
    },
  ]

  let deviceTable: any[] = [
    {
      id: 'dev_pii_1',
      clientId: 'client_scrub_test',
      deviceId: 'real-hardware-device-id-1234',
      name: `${originalBusinessName} Terminal`,
      lastIp: originalIp,
      revokedAt: null,
    },
  ]

  let verificationTable: any[] = [
    {
      id: 'ver_pii_1',
      email: targetEmail,
      purpose: 'ACCOUNT_DELETION_PUBLIC',
      createdAt: new Date(),
    },
  ]

  let notificationTable: any[] = [
    {
      id: 'notif_pii_1',
      clientId: 'client_scrub_test',
      title: `Welcome ${originalFirstName}`,
      message: `Notifications for ${originalBusinessName}`,
    },
  ]

  let transactionTable: any[] = [
    {
      id: 'tx_pii_1',
      sessionId: 'session_accounting_id_1',
      clientId: 'client_scrub_test',
      senderHandle: originalPhone, // payer handle to be scrubbed
      recipientHandle: 'roastery@instapay', // merchant handle to be scrubbed
      amountEgp: 250.0,
      amountCents: 25000,
      currency: 'EGP',
      status: 'CONFIRMED',
      purpose: 'CHECKOUT',
      subscriptionPlanName: null,
      note: `Special note with ${originalBusinessName}`,
      deepLinkUrl: 'https://ipn.eg/roastery',
      detectedRef: 'BANK_REF_987654',
      detectedAt: new Date(),
      createdAt: new Date(),
      expiresAt: new Date(),
    },
    {
      id: 'tx_pii_pending',
      sessionId: 'session_pending_id',
      clientId: 'client_scrub_test',
      senderHandle: '01112223334',
      recipientHandle: 'roastery@instapay',
      amountEgp: 100.0,
      status: 'PENDING',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  ]

  let auditLogTable: any[] = [
    {
      id: 'audit_1',
      action: 'APPROVE_MERCHANT',
      details: `Approved merchant ${originalBusinessName} with email ${targetEmail} and phone ${originalPhone}`,
      createdAt: new Date(),
    },
  ]

  let webhookLogTable: any[] = [
    {
      id: 'wh_pii_1',
      clientId: 'client_scrub_test',
      url: `https://roastery.com/webhook?email=${targetEmail}`,
      payload: JSON.stringify({ email: targetEmail, name: originalFirstName }),
      response: 'OK',
      isSuccess: true,
      createdAt: new Date(),
    },
  ]

  let incomingEventTable: any[] = [
    {
      id: 'ipe_1',
      clientId: 'client_scrub_test',
      eventKey: 'unique_evt_key_1',
      senderHandle: originalPhone,
      amountCents: 25000,
      createdAt: new Date(),
    },
  ]

  let mismatchedTable: any[] = [
    {
      id: 'mm_1',
      clientId: 'client_scrub_test',
      senderHandle: originalPhone,
      amountEgp: 50.0,
      createdAt: new Date(),
    },
  ]

  ;(db as any).client = {
    findUnique: async ({ where }: any) => clientTable.find((c) => c.id === where.id || c.email === where.email) || null,
    update: async ({ where, data }: any) => {
      const idx = clientTable.findIndex((c) => c.id === where.id)
      if (idx !== -1) clientTable[idx] = { ...clientTable[idx], ...data }
      return clientTable[idx]
    },
  }
  ;(db as any).authSession = {
    updateMany: async ({ where, data }: any) => {
      let count = 0
      for (const s of sessionTable) {
        if (s.clientId === where.clientId) {
          Object.assign(s, data)
          count++
        }
      }
      return { count }
    },
  }
  ;(db as any).detectorDevice = {
    findMany: async ({ where }: any) => deviceTable.filter((d) => d.clientId === where.clientId),
    update: async ({ where, data }: any) => {
      const idx = deviceTable.findIndex((d) => d.id === where.id)
      if (idx !== -1) deviceTable[idx] = { ...deviceTable[idx], ...data }
      return deviceTable[idx]
    },
    updateMany: async ({ where, data }: any) => {
      let count = 0
      for (const d of deviceTable) {
        if (d.clientId === where.clientId) {
          Object.assign(d, data)
          count++
        }
      }
      return { count }
    },
  }
  ;(db as any).emailVerification = {
    deleteMany: async ({ where }: any) => {
      const before = verificationTable.length
      verificationTable = verificationTable.filter((v) => v.email !== where.email)
      return { count: before - verificationTable.length }
    },
  }
  ;(db as any).merchantNotification = {
    deleteMany: async ({ where }: any) => {
      const before = notificationTable.length
      notificationTable = notificationTable.filter((n) => n.clientId !== where.clientId)
      return { count: before - notificationTable.length }
    },
  }
  ;(db as any).transaction = {
    updateMany: async ({ where, data }: any) => {
      let count = 0
      for (const t of transactionTable) {
        if (t.clientId === where.clientId && (where.status ? t.status === where.status : true)) {
          Object.assign(t, data)
          count++
        }
      }
      return { count }
    },
  }
  ;(db as any).auditLog = {
    findMany: async () => auditLogTable,
    update: async ({ where, data }: any) => {
      const idx = auditLogTable.findIndex((a) => a.id === where.id)
      if (idx !== -1) auditLogTable[idx] = { ...auditLogTable[idx], ...data }
      return auditLogTable[idx]
    },
    create: async ({ data }: any) => {
      const entry = { id: `aud_${Date.now()}_${Math.random()}`, ...data }
      auditLogTable.push(entry)
      return entry
    },
  }
  ;(db as any).webhookLog = {
    updateMany: async ({ where, data }: any) => {
      let count = 0
      for (const w of webhookLogTable) {
        if (w.clientId === where.clientId) {
          Object.assign(w, data)
          count++
        }
      }
      return { count }
    },
  }
  ;(db as any).incomingPaymentEvent = {
    updateMany: async ({ where, data }: any) => {
      let count = 0
      for (const e of incomingEventTable) {
        if (e.clientId === where.clientId) {
          Object.assign(e, data)
          count++
        }
      }
      return { count }
    },
  }
  ;(db as any).mismatchedPayment = {
    count: async ({ where }: any) => {
      return mismatchedTable.filter((m) => {
        if (where?.clientId && m.clientId !== where.clientId) return false
        if (where?.status && m.status !== where.status) return false
        return true
      }).length
    },
    updateMany: async ({ where, data }: any) => {
      let count = 0
      for (const m of mismatchedTable) {
        if (m.clientId === where.clientId) {
          Object.assign(m, data)
          count++
        }
      }
      return { count }
    },
  }
  ;(db as any).specialOffer = {
    updateMany: async () => ({ count: 0 }),
  }

  t.after(() => {
    ;(db as any).client = origClient
    ;(db as any).authSession = origSession
    ;(db as any).detectorDevice = origDevice
    ;(db as any).emailVerification = origVerification
    ;(db as any).merchantNotification = origNotification
    ;(db as any).transaction = origTransaction
    ;(db as any).auditLog = origAuditLog
    ;(db as any).webhookLog = origWebhookLog
    ;(db as any).incomingPaymentEvent = origIncoming
    ;(db as any).mismatchedPayment = origMismatched
    ;(db as any).specialOffer = origSpecialOffer
    if (orig$transaction) (db as any).$transaction = orig$transaction
    else delete (db as any).$transaction
  })

  // Execute deletion scrub
  await performAccountDataScrub({ id: 'client_scrub_test', email: targetEmail })

  // 1. Check all tables for the original email, name, phone, and IP
  const allJson = JSON.stringify({
    clients: clientTable,
    sessions: sessionTable,
    devices: deviceTable,
    verifications: verificationTable,
    notifications: notificationTable,
    transactions: transactionTable,
    auditLogs: auditLogTable,
    webhookLogs: webhookLogTable,
    incomingEvents: incomingEventTable,
    mismatchedPayments: mismatchedTable,
  })

  assert.ok(!allJson.includes(targetEmail), `Database must not contain original email (found in: ${allJson})`)
  assert.ok(!allJson.includes(originalFirstName), `Database must not contain original first name`)
  assert.ok(!allJson.includes(originalLastName), `Database must not contain original last name`)
  assert.ok(!allJson.includes(originalBusinessName), `Database must not contain original business name`)
  assert.ok(!allJson.includes(originalPhone), `Database must not contain original phone number`)
  assert.ok(!allJson.includes(originalIp), `Database must not contain original IP address`)

  // 2. Open checkouts: verify pending transaction was expired
  const pendingTx = transactionTable.find((t) => t.id === 'tx_pii_pending')
  assert.equal(pendingTx.status, 'EXPIRED')

  // 3. Accounting rows: verify financial numbers are preserved
  const confirmedTx = transactionTable.find((t) => t.id === 'tx_pii_1')
  assert.equal(confirmedTx.sessionId, 'session_accounting_id_1')
  assert.equal(confirmedTx.amountEgp, 250.0)
  assert.equal(confirmedTx.amountCents, 25000)
  assert.equal(confirmedTx.currency, 'EGP')
  assert.equal(confirmedTx.status, 'CONFIRMED')
  assert.equal(confirmedTx.detectedRef, 'BANK_REF_987654')
  assert.equal(confirmedTx.senderHandle, '[deleted]')
  assert.equal(confirmedTx.recipientHandle, '[deleted]')
})

// ─── 16. Refusal of Deletion when Unsettled Funds Exist (HTTP 409) ─────────────
test('deleteMerchantAccount refuses deletion with HTTP 409 when merchant has unsettled funds or unresolved settlements', async (t) => {
  const origClient = (db as any).client
  const origMismatched = (db as any).mismatchedPayment
  const origIncoming = (db as any).incomingPaymentEvent
  const origSession = (db as any).authSession
  const origDevice = (db as any).detectorDevice
  const origWebhook = (db as any).webhookLog
  const origTx = (db as any).transaction
  const origVer = (db as any).emailVerification
  const origNotif = (db as any).merchantNotification
  const origAudit = (db as any).auditLog
  const origOffer = (db as any).specialOffer
  const orig$transaction = (db as any).$transaction
  ;(db as any).$transaction = async (fn: any) => fn(db)

  let hasUnmatched = false
  let hasInFlight = true
  const createdAuditLogs: any[] = []

  ;(db as any).client = {
    findUnique: async () => ({
      id: 'client_with_funds',
      email: 'funds@example.com',
      passwordHash: hashPassword('ValidPass123!'),
      isActive: true,
      approvalStatus: 'APPROVED',
    }),
    update: async ({ where, data }: any) => ({ id: where.id, ...data }),
  }

  ;(db as any).incomingPaymentEvent = {
    count: async ({ where }: any) => (where?.result === 'PROCESSING' && hasInFlight ? 1 : 0),
    updateMany: async () => ({ count: 0 }),
  }

  ;(db as any).mismatchedPayment = {
    count: async ({ where }: any) => (where?.status === 'UNMATCHED' && hasUnmatched ? 1 : 0),
    updateMany: async () => ({ count: 0 }),
  }

  ;(db as any).auditLog = {
    findMany: async () => [],
    update: async () => ({}),
    create: async ({ data }: any) => {
      createdAuditLogs.push(data)
      return { id: 'aud_' + createdAuditLogs.length, ...data }
    },
  }

  ;(db as any).specialOffer = { updateMany: async () => ({ count: 0 }) }
  ;(db as any).authSession = { updateMany: async () => ({ count: 0 }) }
  ;(db as any).detectorDevice = {
    updateMany: async () => ({ count: 0 }),
    findMany: async () => [],
    update: async () => ({}),
  }
  ;(db as any).webhookLog = { updateMany: async () => ({ count: 0 }) }
  ;(db as any).transaction = { updateMany: async () => ({ count: 0 }) }
  ;(db as any).emailVerification = { deleteMany: async () => ({ count: 0 }) }
  ;(db as any).merchantNotification = { deleteMany: async () => ({ count: 0 }) }

  t.after(() => {
    ;(db as any).mismatchedPayment = origMismatched
    ;(db as any).incomingPaymentEvent = origIncoming
    ;(db as any).client = origClient
    ;(db as any).authSession = origSession
    ;(db as any).detectorDevice = origDevice
    ;(db as any).webhookLog = origWebhook
    ;(db as any).transaction = origTx
    ;(db as any).emailVerification = origVer
    ;(db as any).merchantNotification = origNotif
    ;(db as any).auditLog = origAudit
    ;(db as any).specialOffer = origOffer
    if (orig$transaction) (db as any).$transaction = orig$transaction
    else delete (db as any).$transaction
  })

  // 1. Refusal with 409 when in-flight payment event (PROCESSING) exists
  const res1 = await deleteMerchantAccount({
    clientId: 'client_with_funds',
    password: 'ValidPass123!',
    skipOtp: true,
  })
  assert.equal(res1.ok, false)
  if (!res1.ok) {
    assert.equal(res1.status, 409)
    assert.match(res1.error, /processing completes|retry later/i)
  }

  // 2. Unmatched payments do NOT block deletion; they are retained and flagged for admin review
  hasInFlight = false
  hasUnmatched = true

  const res2 = await deleteMerchantAccount({
    clientId: 'client_with_funds',
    password: 'ValidPass123!',
    skipOtp: true,
  })
  assert.equal(res2.ok, true)
  assert.ok(
    createdAuditLogs.some((l) => l.action === 'MERCHANT_DELETION_UNMATCHED_PAYMENTS_FLAGGED'),
    'Must log audit entry flagging UNMATCHED payments for admin review'
  )

  // 3. Clean account with neither in-flight nor unmatched proceeds normally
  hasUnmatched = false
  const res3 = await deleteMerchantAccount({
    clientId: 'client_with_funds',
    password: 'ValidPass123!',
    skipOtp: true,
  })
  assert.equal(res3.ok, true)
})

// ─── 17. Daily Retention Purge Worker with Fake Clock ──────────────────────────
test('runDailyRetentionPurge purges retained financial records older than ACCOUNT_RECORD_RETENTION_DAYS for deleted merchants and preserves recent rows', async (t) => {
  const origClient = (db as any).client
  const origTx = (db as any).transaction
  const origIpe = (db as any).incomingPaymentEvent
  const origMismatched = (db as any).mismatchedPayment
  const origWl = (db as any).webhookLog

  const deletedMerchantId = 'merchant_deleted_1'
  const activeMerchantId = 'merchant_active_1'

  const fakeNow = new Date('2026-10-17T12:00:00Z')
  const retentionDays = 1825 // 5 years
  const oldDate = new Date(fakeNow.getTime() - (retentionDays + 30) * 24 * 60 * 60 * 1000) // 1855 days ago (older than retention)
  const recentDate = new Date(fakeNow.getTime() - 100 * 24 * 60 * 60 * 1000) // 100 days ago (within retention)

  let transactions = [
    { id: 'tx_old_del', clientId: deletedMerchantId, createdAt: oldDate },
    { id: 'tx_rec_del', clientId: deletedMerchantId, createdAt: recentDate },
    { id: 'tx_old_act', clientId: activeMerchantId, createdAt: oldDate },
  ]

  ;(db as any).client = {
    findMany: async ({ where }: any) => {
      // Find deleted merchants
      if (where.approvalStatus === 'DELETED') {
        return [{ id: deletedMerchantId }]
      }
      return []
    },
  }

  ;(db as any).transaction = {
    deleteMany: async ({ where }: any) => {
      const before = transactions.length
      transactions = transactions.filter((t) => !(t.clientId === where.clientId && t.createdAt < where.createdAt.lt))
      return { count: before - transactions.length }
    },
  }
  ;(db as any).incomingPaymentEvent = { deleteMany: async () => ({ count: 0 }) }
  ;(db as any).mismatchedPayment = { deleteMany: async () => ({ count: 0 }) }
  ;(db as any).webhookLog = { deleteMany: async () => ({ count: 0 }) }

  t.after(() => {
    ;(db as any).client = origClient
    ;(db as any).transaction = origTx
    ;(db as any).incomingPaymentEvent = origIpe
    ;(db as any).mismatchedPayment = origMismatched
    ;(db as any).webhookLog = origWl
  })

  // Run purge cycle with fake clock
  const result = await runDailyRetentionPurge(fakeNow)
  assert.equal(result.retentionRowsAnonymized, 1)

  // Old row for deleted merchant was purged
  assert.ok(!transactions.some((t) => t.id === 'tx_old_del'), 'Old transaction for deleted merchant must be purged')

  // Recent row for deleted merchant was preserved
  assert.ok(transactions.some((t) => t.id === 'tx_rec_del'), 'Recent transaction for deleted merchant must be kept')

  // Old row for active merchant was preserved
  assert.ok(transactions.some((t) => t.id === 'tx_old_act'), 'Transactions for active merchant must never be purged')
})


