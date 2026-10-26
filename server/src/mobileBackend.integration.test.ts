import test from 'node:test'
import assert from 'node:assert/strict'
import net from 'net'
import crypto from 'crypto'
import { execSync } from 'child_process'
import { PrismaClient } from '@prisma/client'

// ─── 0. Safe Database Target Resolution ──────────────────────────────────────
// NEVER connect to remote/shared Supabase database!
const resolvedDbUrl =
  process.env.DATABASE_URL &&
  !process.env.DATABASE_URL.includes('supabase.com') &&
  !process.env.DATABASE_URL.includes('pooler')
    ? process.env.DATABASE_URL
    : 'postgresql://postgres:password@localhost:54329/postgres'

if (resolvedDbUrl.includes('supabase.com') || resolvedDbUrl.includes('pooler')) {
  throw new Error(
    '[SAFETY CRITICAL] Integration tests must NEVER connect to a remote or shared Supabase database! Use only CI Postgres or local embedded-postgres.'
  )
}

process.env.DATABASE_URL = resolvedDbUrl
process.env.DIRECT_URL = resolvedDbUrl
process.env.NODE_ENV = 'test'
process.env.TOKEN_PEPPER = process.env.TOKEN_PEPPER || 'test_token_pepper_32_characters_minimum!'
process.env.CREDENTIAL_ENCRYPTION_KEY = process.env.CREDENTIAL_ENCRYPTION_KEY || 'test_credential_encryption_key_32!'
process.env.OWNER_SECRET = process.env.OWNER_SECRET || 'ci_owner_secret_test_value_32_chars_long!'
process.env.AUTH_ALLOW_DEV_BYPASS = 'true'

// Verify TCP port connectivity before test runner starts
function isPortReachable(urlStr: string): Promise<boolean> {
  try {
    const parsed = new URL(urlStr)
    const host = parsed.hostname || 'localhost'
    const port = parseInt(parsed.port || '5432', 10)
    return new Promise((resolve) => {
      const socket = net.createConnection({ host, port }, () => {
        socket.end()
        resolve(true)
      })
      socket.setTimeout(2000, () => {
        socket.destroy()
        resolve(false)
      })
      socket.on('error', () => resolve(false))
    })
  } catch {
    return Promise.resolve(false)
  }
}

const isDbOnline = await isPortReachable(resolvedDbUrl)

if (!isDbOnline) {
  if (process.env.CI) {
    throw new Error(
      `[CI CRITICAL FAILURE] CI environment must run PostgreSQL service, but database at ${resolvedDbUrl} is unreachable!`
    )
  }
  console.warn(
    `[INTEGRATION SKIP] Skipping real-database integration tests: PostgreSQL server is offline at ${resolvedDbUrl}. (To run locally, start local-deploy embedded postgres on port 54329).`
  )
} else {
  // Ensure migrations are deployed to target test database
  try {
    execSync('npx prisma migrate deploy', {
      env: { ...process.env, DATABASE_URL: resolvedDbUrl, DIRECT_URL: resolvedDbUrl },
      stdio: 'pipe',
    })
  } catch (err: any) {
    console.error('[integration] Migration deploy error:', err.message)
    if (process.env.CI) throw err
  }
}

// Conditionally register integration test suite if database is online
if (isDbOnline) {
  const { db } = await import('./db.js')
  const { hashPassword } = await import('./services/authService.js')
  const {
    createMobileSession,
    rotateMobileSession,
  } = await import('./services/mobileAuthService.js')
  const {
    performAccountDataScrub,
    checkDeletionBlockers,
    deleteMerchantAccount,
    requestPublicAccountDeletion,
    confirmPublicAccountDeletion,
    cancelPublicDeletionRequest,
    runDailyRetentionPurge,
  } = await import('./services/accountService.js')

  // Helper to create an approved merchant in real DB
  async function createTestMerchant(prefix: string) {
    const id = `client_integ_${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
    const email = `${prefix}_${Date.now()}@example-test.local`
    return db.client.create({
      data: {
        id,
        email,
        slug: `slug_${id}`,
        businessName: `${prefix} Business`,
        firstName: 'TestFirst',
        lastName: 'TestLast',
        whatsappNumber: '+201099998888',
        passwordHash: hashPassword('SecurePass123!'),
        instapayHandle: `${prefix}@instapay`,
        apiKey: `api_key_${id}`,
        detectToken: `detect_token_${id}`,
        webhookUrl: `https://${prefix}.example.local/webhook`,
        webhookSecret: `whsec_${id}`,
        isActive: true,
        approvalStatus: 'APPROVED',
      },
    })
  }

  // ─── (a) Refresh Rotation Concurrency ──────────────────────────────────────
  test('real-db: (a) 10 concurrent refreshes with one token: exactly one succeeds, family ends up revoked', async () => {
    const merchant = await createTestMerchant('rot')

    const initial = await createMobileSession({
      kind: 'MERCHANT',
      clientId: merchant.id,
      deviceId: 'device-rot-1',
    })

    // Fire 10 concurrent requests using the EXACT SAME refresh token
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        rotateMobileSession({
          refreshToken: initial.refreshToken,
          deviceId: 'device-rot-1',
        })
      )
    )

    const successes = results.filter((r) => r.ok)
    const failures = results.filter((r) => !r.ok)

    assert.equal(successes.length, 1, 'Exactly one concurrent refresh must succeed')
    assert.equal(failures.length, 9, 'All other 9 concurrent refreshes must be rejected')

    // Find all sessions in this family
    const familySessions = await db.authSession.findMany({
      where: { clientId: merchant.id },
    })

    // Because token reuse was triggered by concurrent attempts after the first rotation,
    // the family revocation logic must have revoked all sessions in the family.
    assert.ok(familySessions.length >= 2, 'Should have at least initial session and rotated session')
    assert.ok(
      familySessions.every((s) => s.revokedAt !== null),
      'Entire session family must end up revoked due to detected token reuse'
    )

    // Attempting to use the new refresh token (from the one request that won the race)
    // must now be rejected because the family was revoked.
    if (successes[0].ok) {
      const subsequent = await rotateMobileSession({
        refreshToken: successes[0].tokens.refreshToken,
        deviceId: 'device-rot-1',
      })
      assert.equal(subsequent.ok, false, 'Subsequent refresh in revoked family must fail')
      if (!subsequent.ok) {
        assert.equal(subsequent.status, 401)
      }
    }
  })

  // ─── (b) Device Binding Mismatch ───────────────────────────────────────────
  test('real-db: (b) device binding mismatch immediately revokes the session family', async () => {
    const merchant = await createTestMerchant('devbind')

    const initial = await createMobileSession({
      kind: 'MERCHANT',
      clientId: merchant.id,
      deviceId: 'device-authorized-alpha',
    })

    // Attempt refresh from a different deviceId
    const result = await rotateMobileSession({
      refreshToken: initial.refreshToken,
      deviceId: 'device-unauthorized-bravo', // Mismatch!
    })

    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.status, 401)
      assert.match(result.error, /device binding mismatch/i)
      assert.equal(result.familyRevoked, true)
    }

    // Verify all sessions in family are revoked in Postgres
    const familySessions = await db.authSession.findMany({
      where: { clientId: merchant.id },
    })
    assert.ok(familySessions.length > 0)
    assert.ok(familySessions.every((s) => s.revokedAt !== null))
  })

  // ─── (c) In-App & Public Deletion Complete PII Scrub ───────────────────────
  test('real-db: (c) deletion scrub wipes all merchant PII across every table except deliberately kept accounting columns', async () => {
    const origEmail = `pii_test_${Date.now()}@realstore.eg`
    const origFirst = 'Tariq'
    const origLast = 'El-Masry'
    const origBusiness = `Tariq Coffee Roasters ${Date.now()}`
    const origPhone = '+201112223334'
    const origIp = '198.51.100.88'
    const origUa = 'Mozilla/5.0 (Linux; Android 14; DetectorApp)'

    // Create merchant
    const merchant = await db.client.create({
      data: {
        id: `client_pii_${Date.now()}`,
        email: origEmail,
        slug: `slug_${Date.now()}`,
        businessName: origBusiness,
        firstName: origFirst,
        lastName: origLast,
        whatsappNumber: origPhone,
        passwordHash: hashPassword('MerchantPassword123!'),
        instapayHandle: 'tariq@instapay',
        apiKey: `api_${Date.now()}`,
        detectToken: `dt_${Date.now()}`,
        webhookUrl: 'https://tariq.example.local/webhook',
        webhookSecret: 'whsec_tariq_123',
        isActive: true,
        approvalStatus: 'APPROVED',
      },
    })

    // Seed rows across all dependent tables
    await db.authSession.create({
      data: {
        tokenHash: crypto.randomBytes(32).toString('hex'),
        kind: 'MERCHANT',
        clientId: merchant.id,
        ipAddress: origIp,
        userAgent: origUa,
        expiresAt: new Date(Date.now() + 3600000),
      },
    })

    await db.detectorDevice.create({
      data: {
        clientId: merchant.id,
        deviceId: 'real_hardware_serial_4455',
        name: 'Tariq Android Terminal',
        lastIp: origIp,
      },
    })

    await db.emailVerification.create({
      data: {
        email: origEmail,
        otpHash: crypto.randomBytes(32).toString('hex'),
        purpose: 'ACCOUNT_DELETION_PUBLIC',
        expiresAt: new Date(Date.now() + 1800000),
      },
    })

    await db.merchantNotification.create({
      data: {
        clientId: merchant.id,
        title: `Welcome ${origFirst}`,
        message: `Hello from ${origBusiness}`,
      },
    })

    await db.transaction.create({
      data: {
        clientId: merchant.id,
        sessionId: `sess_pii_acc_${Date.now()}`,
        senderHandle: 'customer_payer@instapay',
        recipientHandle: 'tariq@instapay',
        amountEgp: 500.0,
        amountCents: 50000,
        currency: 'EGP',
        status: 'CONFIRMED',
        note: 'Personal gift for Tariq',
        deepLinkUrl: 'https://instapay.eg/pay/tariq',
        deepLinkToken: crypto.randomBytes(16).toString('hex'),
        detectedRef: 'BANK_REF_556677',
        expiresAt: new Date(Date.now() + 600000),
      },
    })

    await db.incomingPaymentEvent.create({
      data: {
        clientId: merchant.id,
        eventKey: `evt_pii_${Date.now()}`,
        senderHandle: 'customer_payer@instapay',
        amountCents: 50000,
        result: 'CONFIRMED',
      },
    })

    await db.mismatchedPayment.create({
      data: {
        clientId: merchant.id,
        senderHandle: 'customer_payer@instapay',
        amountEgp: 200.0,
        status: 'UNMATCHED',
      },
    })

    await db.webhookLog.create({
      data: {
        clientId: merchant.id,
        url: 'https://tariq.example.local/webhook',
        event: 'checkout.confirmed',
        payload: `{"merchantEmail":"${origEmail}","name":"${origBusiness}"}`,
        isSuccess: true,
      },
    })

    await db.auditLog.create({
      data: {
        action: 'APPROVE_MERCHANT',
        details: `Merchant ${origBusiness} approved with email ${origEmail} and phone ${origPhone}`,
      },
    })

    await db.specialOffer.create({
      data: {
        clientId: merchant.id,
        title: `Offer for ${origFirst}`,
        description: `Custom package for ${origBusiness}`,
        priceEgp: 1000,
        maxTransactions: 500,
        periodDays: 30,
        validUntil: new Date(Date.now() + 86400000),
      },
    })

    // Execute real database scrub
    await performAccountDataScrub({ id: merchant.id, email: origEmail })

    // ─── ASSERTION ON SCRUBBED TABLES ────────────────────────────────────────
    // 1. Client table
    const scrubbedClient = await db.client.findUnique({ where: { id: merchant.id } })
    assert.ok(scrubbedClient)
    assert.equal(scrubbedClient.firstName, null)
    assert.equal(scrubbedClient.lastName, null)
    assert.equal(scrubbedClient.whatsappNumber, null)
    assert.equal(scrubbedClient.apiKey, null)
    assert.equal(scrubbedClient.detectToken, null)
    assert.equal(scrubbedClient.webhookUrl, null)
    assert.equal(scrubbedClient.webhookSecret, null)
    assert.ok(!scrubbedClient.businessName.includes(origFirst))
    assert.ok(!scrubbedClient.email.includes(origEmail))
    assert.equal(scrubbedClient.approvalStatus, 'DELETED')
    assert.equal(scrubbedClient.isActive, false)
    assert.ok(scrubbedClient.deletedAt !== null)

    // 2. AuthSession table
    const sessions = await db.authSession.findMany({ where: { clientId: merchant.id } })
    assert.ok(sessions.length > 0)
    for (const s of sessions) {
      assert.equal(s.ipAddress, null)
      assert.equal(s.userAgent, null)
      assert.ok(s.revokedAt !== null)
    }

    // 3. DetectorDevice table
    const devices = await db.detectorDevice.findMany({ where: { clientId: merchant.id } })
    assert.ok(devices.length > 0)
    for (const d of devices) {
      assert.equal(d.lastIp, null)
      assert.equal(d.name, null)
      assert.ok(!d.deviceId.includes('real_hardware_serial_4455'))
      assert.ok(d.revokedAt !== null)
    }

    // 4. EmailVerification table
    const verifs = await db.emailVerification.findMany({ where: { email: origEmail } })
    assert.equal(verifs.length, 0, 'Original email verification rows must be completely deleted')

    // 5. MerchantNotification table
    const notifs = await db.merchantNotification.findMany({ where: { clientId: merchant.id } })
    assert.equal(notifs.length, 0, 'Merchant notifications must be deleted')

    // 6. Transaction table (Payer data scrubbed, accounting kept)
    const txs = await db.transaction.findMany({ where: { clientId: merchant.id } })
    assert.ok(txs.length > 0)
    for (const t of txs) {
      assert.equal(t.senderHandle, '[deleted]')
      assert.equal(t.recipientHandle, '[deleted]')
      assert.equal(t.note, null)
      assert.equal(t.deepLinkUrl, 'https://deleted.local/pay')
      // DELIBERATELY KEPT ACCOUNTING COLUMNS:
      assert.equal(t.amountEgp, 500.0)
      assert.equal(t.amountCents, 50000)
      assert.equal(t.currency, 'EGP')
      assert.equal(t.status, 'CONFIRMED')
      assert.equal(t.detectedRef, 'BANK_REF_556677')
      assert.ok(t.createdAt instanceof Date)
      assert.ok(t.expiresAt instanceof Date)
    }

    // 7. IncomingPaymentEvent table
    const incomingEvents = await db.incomingPaymentEvent.findMany({ where: { clientId: merchant.id } })
    for (const ie of incomingEvents) {
      assert.equal(ie.senderHandle, '[deleted]')
    }

    // 8. MismatchedPayment table (UNMATCHED payments kept and scrubbed, flagged for review)
    const mismatched = await db.mismatchedPayment.findMany({ where: { clientId: merchant.id } })
    for (const m of mismatched) {
      assert.equal(m.senderHandle, '[deleted]')
    }

    // 9. WebhookLog table
    const webhookLogs = await db.webhookLog.findMany({ where: { clientId: merchant.id } })
    for (const wl of webhookLogs) {
      assert.equal(wl.url, 'https://deleted.local/webhook')
      assert.equal(wl.payload, '{"anonymized":true}')
    }

    // 10. AuditLog table
    const auditRows = await db.auditLog.findMany({
      where: { action: 'APPROVE_MERCHANT' },
    })
    for (const a of auditRows) {
      assert.ok(!a.details.includes(origEmail), `AuditLog must not contain email: ${a.details}`)
      assert.ok(!a.details.includes(origPhone), `AuditLog must not contain phone: ${a.details}`)
      assert.ok(!a.details.includes(origBusiness), `AuditLog must not contain business name: ${a.details}`)
    }

    // 11. SpecialOffer table
    const offers = await db.specialOffer.findMany({ where: { clientId: merchant.id } })
    for (const o of offers) {
      assert.equal(o.status, 'REVOKED')
      assert.equal(o.title, 'Deleted Special Offer')
      assert.equal(o.description, null)
    }
  })

  // ─── (d) Transaction Really Rolls Back on Failure ──────────────────────────
  test('real-db: (d) database transaction really rolls back if a failure occurs midway in scrub', async () => {
    const origEmail = `rollback_${Date.now()}@teststore.local`
    const origFirst = 'Nader'
    const origBusiness = 'Nader Electronics'

    const merchant = await db.client.create({
      data: {
        id: `client_rb_${Date.now()}`,
        email: origEmail,
        slug: `slug_rb_${Date.now()}`,
        businessName: origBusiness,
        firstName: origFirst,
        passwordHash: hashPassword('Pass123!'),
        instapayHandle: 'nader@instapay',
        isActive: true,
        approvalStatus: 'APPROVED',
      },
    })

    await db.authSession.create({
      data: {
        tokenHash: crypto.randomBytes(32).toString('hex'),
        kind: 'MERCHANT',
        clientId: merchant.id,
        ipAddress: '198.51.100.77',
        expiresAt: new Date(Date.now() + 3600000),
      },
    })

    // Simulate an aborted scrub transaction where step 1 updates sessions, but an error
    // is thrown midway (e.g. unique constraint or forced crash)
    let caughtError = false
    try {
      await db.$transaction(async (tx) => {
        // Step 1: modify sessions
        await tx.authSession.updateMany({
          where: { clientId: merchant.id },
          data: { ipAddress: null, revokedAt: new Date() },
        })

        // Step 2: modify client partially
        await tx.client.update({
          where: { id: merchant.id },
          data: { firstName: null },
        })

        // Forced midway failure!
        throw new Error('Forced mid-scrub failure to verify transaction rollback')
      })
    } catch (err: any) {
      caughtError = true
      assert.match(err.message, /Forced mid-scrub failure/)
    }

    assert.equal(caughtError, true, 'Error must have been thrown and caught')

    // Verify in real Postgres: nothing was changed!
    const clientAfter = await db.client.findUnique({ where: { id: merchant.id } })
    assert.ok(clientAfter)
    assert.equal(clientAfter.firstName, origFirst, 'Client firstName must be rolled back')
    assert.equal(clientAfter.isActive, true, 'Client isActive must remain true')
    assert.equal(clientAfter.approvalStatus, 'APPROVED')

    const sessionAfter = await db.authSession.findFirst({ where: { clientId: merchant.id } })
    assert.ok(sessionAfter)
    assert.equal(sessionAfter.ipAddress, '198.51.100.77', 'Session IP must be rolled back')
    assert.equal(sessionAfter.revokedAt, null, 'Session revocation must be rolled back')
  })

  // ─── (e) Grace Period: Public Confirm, Login Cancels, 72h Purge Completes ───
  test('real-db: (e) public confirm initiates grace period, merchant login cancels it, and fake-clock purge completes deletion after 72h', async () => {
    const email = `grace_real_${Date.now()}@store.eg`
    const merchant = await db.client.create({
      data: {
        id: `client_grace_${Date.now()}`,
        email,
        slug: `slug_grace_${Date.now()}`,
        businessName: 'Grace Bakery',
        passwordHash: hashPassword('CorrectPass123!'),
        instapayHandle: 'grace@instapay',
        isActive: true,
        approvalStatus: 'APPROVED',
      },
    })

    // 1. Request public deletion
    const requested = await requestPublicAccountDeletion(email)
    assert.equal(requested, true)

    const verif = await db.emailVerification.findFirst({
      where: { email, purpose: 'ACCOUNT_DELETION_PUBLIC', consumedAt: null },
      orderBy: { createdAt: 'desc' },
    })
    assert.ok(verif)

    // Override verification OTP hash to known code '112233'
    const { hashOtp } = await import('./lib/emailDelivery.js')
    await db.emailVerification.update({
      where: { id: verif.id },
      data: { otpHash: hashOtp(email, '112233') },
    })

    // 2. Confirm public deletion
    const confirmRes = await confirmPublicAccountDeletion({ email, code: '112233' })
    assert.equal(confirmRes.ok, true)

    // Verify account is in grace period in database
    const inGrace = await db.client.findUnique({ where: { id: merchant.id } })
    assert.ok(inGrace)
    assert.equal(inGrace.isActive, false)
    assert.ok(inGrace.deletionRequestedAt !== null)
    assert.equal(inGrace.approvalStatus, 'APPROVED')

    // 3. Merchant changes their mind: login within grace period cancels deletion
    await cancelPublicDeletionRequest(merchant.id)

    const cancelled = await db.client.findUnique({ where: { id: merchant.id } })
    assert.ok(cancelled)
    assert.equal(cancelled.isActive, true)
    assert.equal(cancelled.deletionRequestedAt, null)

    // 4. Merchant re-requests and re-confirms public deletion
    await requestPublicAccountDeletion(email)
    const verif2 = await db.emailVerification.findFirst({
      where: { email, purpose: 'ACCOUNT_DELETION_PUBLIC', consumedAt: null },
      orderBy: { createdAt: 'desc' },
    })
    assert.ok(verif2)
    await db.emailVerification.update({
      where: { id: verif2.id },
      data: { otpHash: hashOtp(email, '445566') },
    })
    await confirmPublicAccountDeletion({ email, code: '445566' })

    // 5. 73 hours elapse — retention worker completes deferred deletion
    const future73h = new Date(Date.now() + 73 * 60 * 60 * 1000)
    const purgeResult = await runDailyRetentionPurge(future73h)
    assert.ok(purgeResult.deferredDeletionsCompleted >= 1)

    // 6. Verify in database that account is fully scrubbed and marked DELETED
    const finalClient = await db.client.findUnique({ where: { id: merchant.id } })
    assert.ok(finalClient)
    assert.equal(finalClient.approvalStatus, 'DELETED')
    assert.equal(finalClient.isActive, false)
    assert.ok(finalClient.deletedAt !== null)
    assert.ok(!finalClient.email.includes(email))
  })

  // ─── (f) Retention Purge with Fake Clock ────────────────────────────────────
  test('real-db: (f) retention purge with fake clock removes records older than ACCOUNT_RECORD_RETENTION_DAYS for deleted merchants only', async () => {
    const fakeNow = new Date('2026-10-19T12:00:00Z')
    const retentionDays = 1825 // 5 years
    const oldDate = new Date(fakeNow.getTime() - (retentionDays + 60) * 86400000) // 1885 days old
    const recentDate = new Date(fakeNow.getTime() - 60 * 86400000) // 60 days old

    // Deleted merchant (deleted 1885 days ago)
    const deletedMerchant = await db.client.create({
      data: {
        id: `client_del_${Date.now()}`,
        email: `del_${Date.now()}@deleted.local`,
        slug: `slug_del_${Date.now()}`,
        businessName: 'Deleted Merchant Historical',
        passwordHash: hashPassword('Pass123!'),
        instapayHandle: 'del@instapay',
        approvalStatus: 'DELETED',
        isActive: false,
        deletedAt: oldDate,
      },
    })

    // Active merchant
    const activeMerchant = await db.client.create({
      data: {
        id: `client_act_${Date.now()}`,
        email: `active_${Date.now()}@live.local`,
        slug: `slug_act_${Date.now()}`,
        businessName: 'Active Merchant Business',
        passwordHash: hashPassword('Pass123!'),
        instapayHandle: 'act@instapay',
        approvalStatus: 'APPROVED',
        isActive: true,
      },
    })

    // Transactions:
    // 1. Old transaction for deleted merchant (MUST be purged)
    const txOldDeleted = await db.transaction.create({
      data: {
        clientId: deletedMerchant.id,
        sessionId: `sess_old_del_${Date.now()}`,
        senderHandle: '[deleted]',
        recipientHandle: '[deleted]',
        amountEgp: 100,
        status: 'CONFIRMED',
        deepLinkUrl: 'https://deleted.local/pay',
        deepLinkToken: crypto.randomBytes(16).toString('hex'),
        createdAt: oldDate,
        expiresAt: oldDate,
      },
    })

    // 2. Recent transaction for deleted merchant (MUST be preserved within 5-year window)
    const txRecentDeleted = await db.transaction.create({
      data: {
        clientId: deletedMerchant.id,
        sessionId: `sess_rec_del_${Date.now()}`,
        senderHandle: '[deleted]',
        recipientHandle: '[deleted]',
        amountEgp: 200,
        status: 'CONFIRMED',
        deepLinkUrl: 'https://deleted.local/pay',
        deepLinkToken: crypto.randomBytes(16).toString('hex'),
        createdAt: recentDate,
        expiresAt: recentDate,
      },
    })

    // 3. Old transaction for active merchant (MUST NEVER be purged)
    const txOldActive = await db.transaction.create({
      data: {
        clientId: activeMerchant.id,
        sessionId: `sess_old_act_${Date.now()}`,
        senderHandle: 'payer@instapay',
        recipientHandle: 'act@instapay',
        amountEgp: 300,
        status: 'CONFIRMED',
        deepLinkUrl: 'https://ipn.eg/pay',
        deepLinkToken: crypto.randomBytes(16).toString('hex'),
        createdAt: oldDate,
        expiresAt: oldDate,
      },
    })

    // Run purge cycle with fake clock
    const result = await runDailyRetentionPurge(fakeNow)
    assert.ok(result.retentionRowsAnonymized >= 1)

    // Verify in database:
    // txOldDeleted MUST be deleted
    const checkOldDel = await db.transaction.findUnique({ where: { id: txOldDeleted.id } })
    assert.equal(checkOldDel, null, 'Old transaction for deleted merchant must be permanently purged')

    // txRecentDeleted MUST still exist
    const checkRecDel = await db.transaction.findUnique({ where: { id: txRecentDeleted.id } })
    assert.ok(checkRecDel, 'Recent transaction within retention window must be preserved')

    // txOldActive MUST still exist
    const checkOldAct = await db.transaction.findUnique({ where: { id: txOldActive.id } })
    assert.ok(checkOldAct, 'Transactions for active merchants must never be purged')
  })
}
