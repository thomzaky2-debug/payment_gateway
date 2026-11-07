import assert from 'node:assert/strict'
import { once } from 'node:events'
import test from 'node:test'
import express from 'express'
import type { Client } from '@prisma/client'
import { db } from './db.js'
import { hashToken } from './services/authService.js'
import { processInstaPayNotification } from './services/matcherService.js'
import { cancelPublicDeletionRequest, isWithinDeletionGracePeriod, performAccountDataScrub } from './services/accountService.js'
import { authRouter } from './routes/authRoutes.js'
import { mobileAuthRouter } from './routes/mobileAuthRoutes.js'
import { settingsRouter } from './routes/settingsRoutes.js'

process.env.NODE_ENV = 'test'
process.env.TOKEN_PEPPER ||= 'security-hardening-test-pepper-at-least-32-chars'
process.env.OWNER_SECRET ||= 'security-hardening-owner-secret-at-least-32-chars'
process.env.ADMIN_PASSWORD ||= 'security-hardening-admin-password-123!'
process.env.ADMIN_EMAIL ||= 'owner@nilepay.internal'
process.env.ADMIN_TOTP_SECRET ||= 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'
// Local OTP fallback: nothing is mailed, codes are returned to the caller.
process.env.AUTH_EXPOSE_DEV_OTP = 'true'

function merchant(overrides: Partial<Client> = {}): Client {
  return {
    id: 'merchant_hardening',
    slug: 'merchant-hardening',
    businessName: 'Hardening Store',
    businessType: 'Retail',
    instapayHandle: 'store@instapay',
    instapayPaymentUrl: null,
    firstName: null,
    lastName: null,
    whatsappNumber: null,
    profileImageData: null,
    email: 'store@example.com',
    passwordHash: 'hash',
    apiKey: null,
    detectToken: null,
    apiKeyHash: null,
    detectTokenHash: null,
    apiKeyLastUsedAt: null,
    detectTokenLastUsedAt: null,
    approvalStatus: 'APPROVED',
    isActive: true,
    webhookUrl: null,
    webhookSecret: null,
    webhookSecretHash: null,
    checkoutTtlMin: 10,
    autoAcceptOverpaid: true,
    overpaidMaxExcessEgp: 100,
    underpaidToleranceEnabled: false,
    underpaidToleranceEgp: 5,
    subscriptionPlan: 'BASIC',
    subscriptionEndsAt: null,
    isFreeTrial: false,
    trialRedeemedAt: null,
    txLimit: 100,
    txCount: 0,
    deletionRequestedAt: null,
    deletedAt: null,
    suspendedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function checkout(overrides: Record<string, unknown>) {
  return {
    id: `tx_${String(overrides.sessionId)}`,
    clientId: 'merchant_hardening',
    purpose: 'CHECKOUT',
    subscriptionPlanName: null,
    amountEgp: 100,
    amountCents: 10000,
    senderHandle: 'pending@instapay',
    recipientHandle: 'store@instapay',
    status: 'PENDING',
    createdAt: new Date(Date.now() - 60_000),
    expiresAt: new Date(Date.now() + 300_000),
    detectedRef: null,
    detectedAmountCents: null,
    ...overrides,
  }
}

/**
 * Replaces the matcher's database surface with in-memory stubs and records
 * every state-changing call so tests can assert what was (not) written.
 */
function stubMatcherDb(t: test.TestContext, options: {
  senderCandidates?: any[]
  amountCandidates?: any[]
  existingEvent?: any
  settleCount?: number
  reviewCount?: number
}) {
  const saved = {
    transaction: (db as any).transaction,
    incomingPaymentEvent: (db as any).incomingPaymentEvent,
    mismatchedPayment: (db as any).mismatchedPayment,
    client: (db as any).client,
    webhookLog: (db as any).webhookLog,
    $transaction: (db as any).$transaction,
  }
  t.after(() => Object.assign(db as any, saved))

  const calls = { updateMany: [] as any[], mismatched: [] as any[], findManyWhere: [] as any[], eventResults: [] as string[] }
  const client = merchant()
  ;(db as any).$transaction = async (cb: any) => cb(db)
  ;(db as any).client = { update: async () => client, findUniqueOrThrow: async () => client }
  ;(db as any).webhookLog = { create: async (args: any) => ({ id: 'wh', ...args.data }), findMany: async () => [] }
  ;(db as any).transaction = {
    findFirst: async () => null,
    findMany: async (args: any) => {
      calls.findManyWhere.push(args.where)
      return args.where.senderHandle ? options.senderCandidates ?? [] : options.amountCandidates ?? []
    },
    updateMany: async (args: any) => {
      calls.updateMany.push(args)
      const isSettlement = args.data?.status === 'CONFIRMED'
      return { count: isSettlement ? options.settleCount ?? 1 : options.reviewCount ?? 1 }
    },
    findUniqueOrThrow: async ({ where }: any) => {
      const all = [...(options.senderCandidates ?? []), ...(options.amountCandidates ?? [])]
      const row = all.find((r) => r.id === where.id)
      const last = calls.updateMany[calls.updateMany.length - 1]
      return { ...row, ...last?.data }
    },
    findFirstOrThrow: async () => null,
  }
  ;(db as any).incomingPaymentEvent = {
    create: async () => {
      if (options.existingEvent) throw Object.assign(new Error('unique'), { code: 'P2002' })
      return { id: 'evt_new' }
    },
    findUnique: async () => options.existingEvent ?? null,
    update: async ({ data }: any) => {
      calls.eventResults.push(data.result)
      return { id: 'evt_new' }
    },
  }
  ;(db as any).mismatchedPayment = {
    create: async ({ data }: any) => {
      calls.mismatched.push(data)
      return { id: 'mm', ...data }
    },
  }
  return { client, calls }
}

test('matcher refuses to guess between two open checkouts for the same amount', async (t) => {
  const victim = checkout({ sessionId: 'victim', createdAt: new Date(Date.now() - 120_000) })
  const attacker = checkout({ sessionId: 'attacker' })
  const { client, calls } = stubMatcherDb(t, { amountCandidates: [victim, attacker] })

  const result = await processInstaPayNotification({ client, amountEgp: 100, senderHandle: 'payer@instapay', eventId: 'evt-1' })

  assert.equal(result.matched, false)
  assert.equal(result.reason, 'AMBIGUOUS_CANDIDATES')
  assert.equal(calls.updateMany.length, 0, 'no checkout may be confirmed')
  assert.equal(calls.mismatched.length, 1)
  assert.equal(calls.mismatched[0].status, 'UNMATCHED')
  assert.deepEqual(calls.eventResults, ['AMBIGUOUS'])
})

test('matcher never confirms a checkout whose declared payer is someone else', async (t) => {
  const alice = checkout({ sessionId: 'alice', senderHandle: 'alice@instapay' })
  const bob = checkout({ sessionId: 'bob', senderHandle: 'bob@instapay' })
  const { client, calls } = stubMatcherDb(t, { amountCandidates: [alice, bob] })

  const result = await processInstaPayNotification({ client, amountEgp: 100, senderHandle: 'carol@instapay', eventId: 'evt-2' })

  assert.equal(result.reason, 'AMBIGUOUS_CANDIDATES')
  assert.equal(calls.updateMany.length, 0)
})

test('matcher still confirms the only open checkout when the others name different payers', async (t) => {
  const alice = checkout({ sessionId: 'alice', senderHandle: 'alice@instapay' })
  const open = checkout({ sessionId: 'open' })
  const { client, calls } = stubMatcherDb(t, { amountCandidates: [alice, open] })

  const result = await processInstaPayNotification({ client, amountEgp: 100, senderHandle: 'carol@instapay', eventId: 'evt-3' })

  assert.equal(result.matched, true)
  assert.equal(result.sessionId, 'open')
  assert.equal(calls.updateMany[0].where.id, open.id)
  assert.equal(calls.updateMany[0].data.status, 'CONFIRMED')
})

test('matcher routes a payer with several open checkouts of other amounts to review', async (t) => {
  const first = checkout({ sessionId: 'first', senderHandle: 'payer@instapay', amountEgp: 200, amountCents: 20000 })
  const second = checkout({ sessionId: 'second', senderHandle: 'payer@instapay', amountEgp: 300, amountCents: 30000 })
  const { client, calls } = stubMatcherDb(t, { senderCandidates: [first, second] })

  const result = await processInstaPayNotification({ client, amountEgp: 150, senderHandle: 'payer@instapay', eventId: 'evt-4' })

  assert.equal(result.reason, 'AMBIGUOUS_CANDIDATES')
  assert.equal(calls.updateMany.length, 0)
  assert.equal(calls.findManyWhere.length, 1, 'the amount fallback must not run after an ambiguous payer match')
})

test('matcher rejects a concurrent delivery of an event that is still being processed', async (t) => {
  const { client, calls } = stubMatcherDb(t, {
    amountCandidates: [checkout({ sessionId: 'open' })],
    existingEvent: { id: 'evt_existing', result: 'PROCESSING', sessionId: null, createdAt: new Date() },
  })

  const result = await processInstaPayNotification({ client, amountEgp: 100, senderHandle: 'payer@instapay', eventId: 'evt-5' })

  assert.equal(result.duplicate, true)
  assert.equal(result.reason, 'DUPLICATE_IN_FLIGHT')
  assert.equal(calls.findManyWhere.length, 0)
  assert.equal(calls.updateMany.length, 0)
})

test('matcher re-evaluates a stale PROCESSING event left behind by a crash', async (t) => {
  const { client, calls } = stubMatcherDb(t, {
    amountCandidates: [checkout({ sessionId: 'open' })],
    existingEvent: { id: 'evt_stale', result: 'PROCESSING', sessionId: null, createdAt: new Date(Date.now() - 10 * 60_000) },
  })

  const result = await processInstaPayNotification({ client, amountEgp: 100, senderHandle: 'payer@instapay', eventId: 'evt-6' })

  assert.equal(result.matched, true)
  assert.equal(calls.updateMany[0].data.status, 'CONFIRMED')
})

test('underpayment review is status-conditional and a lost race keeps the payment in the review queue', async (t) => {
  const open = checkout({ sessionId: 'open', senderHandle: 'payer@instapay', amountEgp: 200, amountCents: 20000 })
  const flagged = stubMatcherDb(t, { senderCandidates: [open], reviewCount: 1 })

  const review = await processInstaPayNotification({ client: flagged.client, amountEgp: 150, senderHandle: 'payer@instapay', eventId: 'evt-7' })
  assert.equal(review.reason, 'UNDERPAID')
  const write = flagged.calls.updateMany[0]
  assert.equal(write.where.clientId, 'merchant_hardening')
  assert.deepEqual(write.where.status, { in: ['PENDING', 'EXPIRED'] })
  assert.equal(write.data.status, 'UNDERPAID')

  const lost = stubMatcherDb(t, { senderCandidates: [open], reviewCount: 0 })
  const result = await processInstaPayNotification({ client: lost.client, amountEgp: 150, senderHandle: 'payer@instapay', eventId: 'evt-8' })
  assert.equal(result.reason, 'CHECKOUT_ALREADY_SETTLED')
  assert.equal(lost.calls.mismatched.length, 1)
  assert.equal(lost.calls.mismatched[0].amountCents, 15000)
})

test('public OTP dispatcher refuses deletion purposes and malformed or multi-recipient addresses', async (t) => {
  const saved = { verification: (db as any).emailVerification, client: (db as any).client }
  t.after(() => Object.assign(db as any, saved))
  const issued: string[] = []
  ;(db as any).emailVerification = {
    updateMany: async () => ({ count: 0 }),
    create: async ({ data }: any) => {
      issued.push(data.email)
      return { id: 'ver_1', ...data }
    },
    delete: async () => ({}),
  }
  ;(db as any).client = { findFirst: async () => null, findUnique: async () => null }

  const app = express()
  app.use(express.json())
  app.use('/auth', authRouter)
  const server = app.listen(0, '127.0.0.1')
  t.after(() => server.close())
  await once(server, 'listening')
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  const post = (body: unknown) => fetch(`${base}/auth/email-otp`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })

  for (const purpose of ['ACCOUNT_DELETION', 'ACCOUNT_DELETION_PUBLIC', 'ANYTHING']) {
    const res = await post({ email: 'victim@example.com', purpose })
    assert.equal(res.status, 400, purpose)
    assert.equal(((await res.json()) as any).error, 'Invalid verification purpose')
  }
  for (const email of ['a@x.com,b@y.com', 'not-an-email', `${'x'.repeat(250)}@example.com`, 42]) {
    const res = await post({ email, purpose: 'MERCHANT_SIGNUP' })
    assert.equal(res.status, 400, String(email))
  }
  assert.deepEqual(issued, [], 'nothing may be mailed for rejected requests')

  const ok = await post({ email: 'new@example.com', purpose: 'MERCHANT_SIGNUP' })
  assert.equal(ok.status, 200)
  assert.deepEqual(issued, ['new@example.com'])
})

test('mobile admin login enforces the owner email and throttles by IP regardless of the email sent', async (t) => {
  const app = express()
  app.use(express.json())
  app.use('/auth/mobile', mobileAuthRouter)
  const server = app.listen(0, '127.0.0.1')
  t.after(() => server.close())
  await once(server, 'listening')
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  const login = (email: string) => fetch(`${base}/auth/mobile/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: process.env.ADMIN_PASSWORD, totp: '000000', appType: 'admin' }),
  })

  const wrongEmail = await login('someone-else@example.com')
  assert.equal(wrongEmail.status, 401)

  const statuses: number[] = []
  for (let i = 0; i < 12; i++) statuses.push((await login(`guess-${i}@example.com`)).status)
  assert.ok(statuses.includes(429), `rotating emails must not reset the limiter: ${statuses.join(',')}`)
  assert.equal(statuses[statuses.length - 1], 429)
})

test('merchant settings only accept a genuine InstaPay share link as the payment destination', async (t) => {
  const saved = { session: (db as any).authSession, client: (db as any).client, transaction: (db as any).transaction }
  t.after(() => Object.assign(db as any, saved))
  const token = 'ims_hardening-session'
  const stored = merchant()
  let lastUpdate: any = null
  ;(db as any).authSession = {
    findUnique: async () => ({ id: 's', kind: 'MERCHANT', clientId: stored.id, expiresAt: new Date(Date.now() + 60_000), revokedAt: null, lastSeenAt: new Date(), tokenHash: hashToken(token) }),
    updateMany: async () => ({ count: 1 }),
  }
  ;(db as any).client = {
    findUnique: async () => stored,
    findFirst: async () => null,
    update: async ({ data }: any) => { lastUpdate = data; return { ...stored, ...data } },
  }
  ;(db as any).transaction = { updateMany: async () => ({ count: 0 }) }

  const app = express()
  app.use(express.json())
  app.use('/settings', settingsRouter)
  const server = app.listen(0, '127.0.0.1')
  t.after(() => server.close())
  await once(server, 'listening')
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  const put = (body: unknown) => fetch(`${base}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })

  for (const instapayPaymentUrl of ['https://phish.example/S/store/instapay/TOKEN', 'http://ipn.eg/S/store/instapay/TOKEN', 'https://ipn.eg/other/path', 'https://ipn.eg/S/store/instapay/TOKEN?x=1']) {
    const res = await put({ instapayPaymentUrl })
    assert.equal(res.status, 400, instapayPaymentUrl)
    assert.equal(lastUpdate, null)
  }

  const ok = await put({ instapayPaymentUrl: 'https://ipn.eg/S/MyStore/instapay/TOK99' })
  assert.equal(ok.status, 200)
  assert.equal(lastUpdate.instapayPaymentUrl, 'https://ipn.eg/S/MyStore/instapay/TOK99')
  assert.equal(lastUpdate.instapayHandle, 'mystore@instapay')
})

test('a grace-period login cannot undo an admin suspension', async (t) => {
  const suspended = { approvalStatus: 'APPROVED', deletionRequestedAt: new Date(), deletedAt: null, suspendedAt: new Date() }
  assert.equal(isWithinDeletionGracePeriod(suspended), false)
  assert.equal(isWithinDeletionGracePeriod({ ...suspended, suspendedAt: null }), true)

  const saved = (db as any).client
  t.after(() => { (db as any).client = saved })
  let where: any = null
  ;(db as any).client = { updateMany: async (args: any) => { where = args.where; return { count: 0 } } }
  await cancelPublicDeletionRequest('merchant_hardening')
  assert.deepEqual(where, { id: 'merchant_hardening', suspendedAt: null })
})

test('account deletion scrubs only audit rows that reference the merchant, never by business name alone', async (t) => {
  const delegates = ['authSession', 'detectorDevice', 'webhookLog', 'emailVerification', 'merchantNotification', 'transaction', 'auditLog', 'incomingPaymentEvent', 'mismatchedPayment', 'specialOffer', 'client']
  const saved: Record<string, unknown> = { $transaction: (db as any).$transaction }
  for (const name of delegates) saved[name] = (db as any)[name]
  t.after(() => Object.assign(db as any, saved))

  const email = 'owner@reveal-store.com'
  const auditRows = [
    { id: 'own_email', details: `Approved merchant Revealed Credentials (${email})` },
    { id: 'own_id', details: 'Superadmin revealed plaintext integration credentials for merchant Revealed Credentials (client_scrub)' },
    { id: 'other', details: 'Superadmin revealed plaintext integration credentials for merchant Revealed Credentials Rival (client_other)' },
    { id: 'phrase', details: 'Revealed Credentials for merchant Someone Else (client_third)' },
  ]
  const noop = { updateMany: async () => ({ count: 0 }), deleteMany: async () => ({ count: 0 }), findMany: async () => [], update: async () => ({}), count: async () => 0, create: async () => ({}) }
  for (const name of delegates) (db as any)[name] = { ...noop }
  ;(db as any).$transaction = async (cb: any) => cb(db)
  ;(db as any).client = {
    findUnique: async () => ({ email, businessName: 'Revealed Credentials', whatsappNumber: null, firstName: null, lastName: null }),
    update: async () => ({}),
  }
  ;(db as any).auditLog = {
    ...noop,
    findMany: async ({ where }: any) => {
      const terms = where.OR.map((clause: any) => clause.details.contains)
      assert.ok(!terms.includes('Revealed Credentials'), 'the business name must not be a search term on its own')
      return auditRows.filter((row) => terms.some((term: string) => row.details.includes(term)))
    },
    update: async ({ where, data }: any) => {
      const row = auditRows.find((r) => r.id === where.id)!
      row.details = data.details
      return row
    },
  }

  await performAccountDataScrub({ id: 'client_scrub', email })

  assert.equal(auditRows[0].details, 'Approved merchant [deleted] ([deleted])')
  assert.equal(auditRows[1].details, 'Superadmin revealed plaintext integration credentials for merchant [deleted] (client_scrub)')
  assert.equal(auditRows[2].details, 'Superadmin revealed plaintext integration credentials for merchant Revealed Credentials Rival (client_other)')
  assert.equal(auditRows[3].details, 'Revealed Credentials for merchant Someone Else (client_third)')
})
