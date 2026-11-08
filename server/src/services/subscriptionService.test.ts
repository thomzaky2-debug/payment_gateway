import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateNextBillingDate,
  createCustomerSubscriptionPlan,
  createCustomerSubscription,
  generateInvoiceForSubscription,
  sendInvoiceReminder,
  processScheduledInvoices,
  processUpcomingInvoiceReminders,
  processOverdueInvoices,
  processPlatformSubscriptionRenewals,
  getSubscriptionStats,
} from './subscriptionService.js'
import { db } from '../db.js'
import { runSubscriptionSchedulerCycle } from '../workers/subscriptionSchedulerWorker.js'

test('calculateNextBillingDate computes correct dates for all intervals', () => {
  const base = new Date('2026-05-10T12:00:00Z')

  const daily = calculateNextBillingDate(base, 'DAILY')
  assert.equal(daily.toISOString().slice(0, 10), '2026-05-11')

  const weekly = calculateNextBillingDate(base, 'WEEKLY')
  assert.equal(weekly.toISOString().slice(0, 10), '2026-05-17')

  const monthly = calculateNextBillingDate(base, 'MONTHLY')
  assert.equal(monthly.getMonth(), 5) // June (0-indexed 5)

  const yearly = calculateNextBillingDate(base, 'YEARLY')
  assert.equal(yearly.getFullYear(), 2027)

  const custom = calculateNextBillingDate(base, 'CUSTOM_DAYS', 14)
  assert.equal(custom.toISOString().slice(0, 10), '2026-05-24')
})

test('subscription plans and customer subscriptions validate inputs and generate invoices', async () => {
  const clientId = `cl_test_${Date.now()}`
  const plans: any[] = []
  const subs: any[] = []
  const invoices: any[] = []
  const transactions: any[] = []
  const webhooks: any[] = []

  const origClientFindUnique = (db.client as any).findUniqueOrThrow
  ;(db.client as any).findUniqueOrThrow = async () => ({
    id: clientId,
    businessName: 'Acme SaaS',
    instapayHandle: 'acme@instapay',
    instapayPaymentUrl: 'https://ipn.eg/S/acme/instapay/TOKEN123',
    webhookUrl: 'https://acme.example/webhook',
  })

  const origPlanCreate = (db.customerSubscriptionPlan as any).create
  ;(db.customerSubscriptionPlan as any).create = async ({ data }: any) => {
    const plan = { id: `plan_${Date.now()}`, ...data }
    plans.push(plan)
    return plan
  }

  const origPlanFindFirst = (db.customerSubscriptionPlan as any).findFirst
  ;(db.customerSubscriptionPlan as any).findFirst = async ({ where }: any) => {
    return plans.find((p) => p.id === where.id) || null
  }

  const origSubCreate = (db.customerSubscription as any).create
  ;(db.customerSubscription as any).create = async ({ data }: any) => {
    const sub = { id: `sub_${Date.now()}`, invoices: [], ...data }
    subs.push(sub)
    return sub
  }

  const origSubFindUnique = (db.customerSubscription as any).findUniqueOrThrow
  ;(db.customerSubscription as any).findUniqueOrThrow = async ({ where }: any) => {
    const sub = subs.find((s) => s.id === where.id)
    if (!sub) throw new Error('Subscription not found')
    return {
      ...sub,
      client: {
        id: clientId,
        businessName: 'Acme SaaS',
        instapayHandle: 'acme@instapay',
        instapayPaymentUrl: 'https://ipn.eg/S/acme/instapay/TOKEN123',
        webhookUrl: 'https://acme.example/webhook',
      },
      plan: plans.find((p) => p.id === sub.planId) || null,
    }
  }

  const origSubUpdate = (db.customerSubscription as any).update
  ;(db.customerSubscription as any).update = async ({ where, data }: any) => {
    const sub = subs.find((s) => s.id === where.id)
    if (sub) Object.assign(sub, data)
    return sub
  }

  const origTxCreate = (db.transaction as any).create
  ;(db.transaction as any).create = async ({ data }: any) => {
    const tx = { id: `tx_${Date.now()}`, sessionId: `sess_${Date.now()}`, ...data }
    transactions.push(tx)
    return tx
  }

  const origInvCreate = (db.customerInvoice as any).create
  ;(db.customerInvoice as any).create = async ({ data }: any) => {
    const inv = { id: `inv_${Date.now()}`, ...data }
    invoices.push(inv)
    return inv
  }

  const origWebhookCreate = (db.webhookLog as any).create
  ;(db.webhookLog as any).create = async ({ data }: any) => {
    webhooks.push(data)
    return data
  }

  const origTransaction = db.$transaction
  ;(db as any).$transaction = async (cb: any) => cb(db)

  try {
    // 1. Create a subscription plan
    const plan = await createCustomerSubscriptionPlan(clientId, {
      name: 'Pro Membership',
      description: 'Monthly gym & fitness pass',
      amountEgp: 350.0,
      billingInterval: 'MONTHLY',
    })
    assert.equal(plan.name, 'Pro Membership')
    assert.equal(plan.amountEgp, 350.0)
    assert.equal(plan.amountCents, 35000)

    // 2. Reject invalid plan amounts
    await assert.rejects(
      createCustomerSubscriptionPlan(clientId, { name: 'Bad', amountEgp: -10 }),
      /positive number/
    )

    // 3. Create a customer subscription linked to the plan
    const { subscription } = await createCustomerSubscription(clientId, {
      customerName: 'Kareem Ahmed',
      customerEmail: 'kareem@example.com',
      senderHandle: 'kareem@instapay',
      planId: plan.id,
    })
    assert.equal(subscription.customerName, 'Kareem Ahmed')
    assert.equal(subscription.amountEgp, 350.0)
    assert.equal(subscription.status, 'ACTIVE')
    assert.ok(subscription.nextBillingAt instanceof Date)

    // 4. Generate invoice for this subscription
    const { invoice, transaction, checkoutUrl } = await generateInvoiceForSubscription(subscription.id)
    assert.ok(invoice.invoiceNumber.startsWith('INV-'))
    assert.equal(invoice.amountEgp, 350.0)
    assert.equal(invoice.status, 'PENDING')
    assert.equal(transaction.amountEgp, 350.0)
    assert.match(checkoutUrl, /\/pay\/sess_/)

    // 5. Verify webhook outbox was enqueued with subscription.invoice_created
    const createdWebhook = webhooks.find((w) => w.event === 'subscription.invoice_created')
    assert.ok(createdWebhook, 'Invoice created webhook must be enqueued')
    const payload = JSON.parse(createdWebhook.payload)
    assert.equal(payload.event, 'subscription.invoice_created')
    assert.equal(payload.data.customerEmail, 'kareem@example.com')
    assert.equal(payload.data.amountEgp, 350.0)
  } finally {
    ;(db.client as any).findUniqueOrThrow = origClientFindUnique
    ;(db.customerSubscriptionPlan as any).create = origPlanCreate
    ;(db.customerSubscriptionPlan as any).findFirst = origPlanFindFirst
    ;(db.customerSubscription as any).create = origSubCreate
    ;(db.customerSubscription as any).findUniqueOrThrow = origSubFindUnique
    ;(db.customerSubscription as any).update = origSubUpdate
    ;(db.transaction as any).create = origTxCreate
    ;(db.customerInvoice as any).create = origInvCreate
    ;(db.webhookLog as any).create = origWebhookCreate
    ;(db as any).$transaction = origTransaction
  }
})

test('scheduler transitions overdue invoices and sends reminders', async () => {
  const now = new Date('2026-11-09T12:00:00Z')
  const invoices: any[] = [
    {
      id: 'inv_overdue',
      invoiceNumber: 'INV-OVERDUE-1',
      clientId: 'cl_1',
      subscriptionId: 'sub_1',
      status: 'PENDING',
      amountEgp: 200,
      customerEmail: 'overdue@test.com',
      dueDate: new Date('2026-11-08T12:00:00Z'), // Past due
      client: { id: 'cl_1', webhookUrl: 'https://merchant.example/webhook' },
    },
    {
      id: 'inv_due_soon',
      invoiceNumber: 'INV-DUE-SOON-1',
      clientId: 'cl_1',
      subscriptionId: 'sub_2',
      status: 'PENDING',
      amountEgp: 150,
      customerName: 'Soon User',
      customerEmail: 'soon@test.com',
      dueDate: new Date('2026-11-10T12:00:00Z'), // Due in 24h
      reminderSentAt: null,
      subscription: { reminderDaysBefore: 2 },
      client: { id: 'cl_1', businessName: 'Test Biz', webhookUrl: 'https://merchant.example/webhook' },
    },
  ]
  const subs: any[] = [
    { id: 'sub_1', status: 'ACTIVE' },
    { id: 'sub_2', status: 'ACTIVE' },
  ]
  const webhooks: any[] = []

  const origInvFindMany = (db.customerInvoice as any).findMany
  ;(db.customerInvoice as any).findMany = async ({ where }: any) => {
    return invoices.filter((inv) => {
      if (where.status && inv.status !== where.status) return false
      if (where.dueDate?.lt && inv.dueDate >= where.dueDate.lt) return false
      if (where.dueDate?.gt && inv.dueDate <= where.dueDate.gt) return false
      if (where.reminderSentAt === null && inv.reminderSentAt !== null) return false
      return true
    })
  }

  const origInvFindUnique = (db.customerInvoice as any).findUnique
  ;(db.customerInvoice as any).findUnique = async ({ where }: any) => {
    return invoices.find((i) => i.id === where.id) || null
  }

  const origInvUpdate = (db.customerInvoice as any).update
  ;(db.customerInvoice as any).update = async ({ where, data }: any) => {
    const inv = invoices.find((i) => i.id === where.id)
    if (inv) Object.assign(inv, data)
    return inv
  }

  const origSubUpdate = (db.customerSubscription as any).update
  ;(db.customerSubscription as any).update = async ({ where, data }: any) => {
    const sub = subs.find((s) => s.id === where.id)
    if (sub) Object.assign(sub, data)
    return sub
  }

  const origWebhookCreate = (db.webhookLog as any).create
  ;(db.webhookLog as any).create = async ({ data }: any) => {
    webhooks.push(data)
    return data
  }

  const origTransaction = db.$transaction
  ;(db as any).$transaction = async (cb: any) => cb(db)

  try {
    // 1. Process overdue invoices
    const overdueCount = await processOverdueInvoices(now)
    assert.equal(overdueCount, 1)
    const overdueInv = invoices.find((i) => i.id === 'inv_overdue')
    assert.equal(overdueInv.status, 'OVERDUE')
    const overdueSub = subs.find((s) => s.id === 'sub_1')
    assert.equal(overdueSub.status, 'PAST_DUE')

    // Verify overdue webhook was enqueued
    const overdueWebhook = webhooks.find((w) => w.event === 'subscription.past_due')
    assert.ok(overdueWebhook)

    // 2. Process upcoming reminders
    const remindersSent = await processUpcomingInvoiceReminders(now)
    assert.equal(remindersSent, 1)
    const dueSoonInv = invoices.find((i) => i.id === 'inv_due_soon')
    assert.ok(dueSoonInv.reminderSentAt instanceof Date)

    // Verify reminder webhook was enqueued
    const reminderWebhook = webhooks.find((w) => w.event === 'subscription.invoice_reminder')
    assert.ok(reminderWebhook)
  } finally {
    ;(db.customerInvoice as any).findMany = origInvFindMany
    ;(db.customerInvoice as any).findUnique = origInvFindUnique
    ;(db.customerInvoice as any).update = origInvUpdate
    ;(db.customerSubscription as any).update = origSubUpdate
    ;(db.webhookLog as any).create = origWebhookCreate
    ;(db as any).$transaction = origTransaction
  }
})


test('manual scheduler queries use the merchant scope and background queries cover all merchants', async () => {
  const subscriptions = db.customerSubscription as any
  const invoices = db.customerInvoice as any
  const merchants = db.client as any
  const original = [subscriptions.findMany, invoices.findMany, merchants.findMany]
  const scopes: Array<string | undefined> = []
  const recordScope = (key: string) => async ({ where }: any) => {
    scopes.push(where[key])
    return []
  }

  try {
    subscriptions.findMany = recordScope('clientId')
    invoices.findMany = recordScope('clientId')
    merchants.findMany = recordScope('id')
    await runSubscriptionSchedulerCycle(new Date(), 'merchant-a')
    assert.deepEqual(scopes, Array(4).fill('merchant-a'))
    scopes.length = 0
    await runSubscriptionSchedulerCycle()
    assert.deepEqual(scopes, Array(4).fill(undefined))
  } finally {
    ;[subscriptions.findMany, invoices.findMany, merchants.findMany] = original
  }
})
