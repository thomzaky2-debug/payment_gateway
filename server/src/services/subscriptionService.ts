import crypto from 'crypto'
import { db } from '../db.js'
import { toEgpCents } from '../lib/money.js'
import { parseInstaPayPaymentLink } from '../lib/instapayPaymentLink.js'
import { sendApplicationEmail } from '../lib/emailDelivery.js'
import {
  renderInvoiceEmail,
  renderReminderEmail,
  renderPlatformRenewalEmail,
} from '../views/subscriptionEmail.js'
import { enqueueSubscriptionWebhookOutbox } from './settlementService.js'
import { emitMerchantNotification } from './notificationService.js'

export function calculateNextBillingDate(fromDate: Date, interval = 'MONTHLY', intervalDays = 30): Date {
  const next = new Date(fromDate.getTime())
  const normalized = (interval || 'MONTHLY').toUpperCase()

  switch (normalized) {
    case 'DAILY':
      next.setDate(next.getDate() + 1)
      break
    case 'WEEKLY':
      next.setDate(next.getDate() + 7)
      break
    case 'YEARLY':
      next.setFullYear(next.getFullYear() + 1)
      break
    case 'CUSTOM_DAYS':
      next.setDate(next.getDate() + Math.max(1, intervalDays))
      break
    case 'MONTHLY':
    default: {
      const targetMonth = next.getMonth() + 1
      next.setMonth(targetMonth)
      break
    }
  }
  return next
}

function generateInvoiceNumber(): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const randomPart = crypto.randomBytes(3).toString('hex').toUpperCase()
  return `INV-${datePart}-${randomPart}`
}

function resolveCheckoutUrl(sessionId: string): string {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000'
  const checkoutSubdomainBase =
    process.env.CHECKOUT_SUBDOMAIN_URL ||
    clientUrl.replace('://', '://checkout.')
  return `${checkoutSubdomainBase}/pay/${sessionId}`
}

export async function createCustomerSubscriptionPlan(
  clientId: string,
  data: {
    name: string
    description?: string
    amountEgp: number
    billingInterval?: string
    intervalDays?: number
  }
) {
  const cleanAmountEgp = Math.round(Number(data.amountEgp) * 100) / 100
  if (!Number.isFinite(cleanAmountEgp) || cleanAmountEgp <= 0) {
    throw new Error('Plan amount must be a positive number of EGP')
  }

  const interval = (data.billingInterval || 'MONTHLY').toUpperCase()
  const intervalDays = interval === 'CUSTOM_DAYS' ? Math.max(1, Number(data.intervalDays) || 30) : 30
  const amountCents = toEgpCents(cleanAmountEgp)

  return db.customerSubscriptionPlan.create({
    data: {
      clientId,
      name: String(data.name || '').trim(),
      description: data.description ? String(data.description).trim() : null,
      amountEgp: cleanAmountEgp,
      amountCents,
      billingInterval: interval,
      intervalDays,
      isActive: true,
    },
  })
}

export async function createCustomerSubscription(
  clientId: string,
  data: {
    customerName: string
    customerEmail: string
    customerPhone?: string
    senderHandle?: string
    planId?: string
    amountEgp?: number
    billingInterval?: string
    intervalDays?: number
    description?: string
    firstBillingDate?: Date | string
    generateFirstInvoiceNow?: boolean
    metadata?: any
  }
) {
  const client = await db.client.findUniqueOrThrow({ where: { id: clientId } })
  const cleanEmail = String(data.customerEmail || '').toLowerCase().trim()
  const cleanName = String(data.customerName || '').trim()

  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Valid customer email address is required')
  }
  if (!cleanName) {
    throw new Error('Customer name is required')
  }

  let finalAmountEgp = 0
  let finalBillingInterval = (data.billingInterval || 'MONTHLY').toUpperCase()
  let finalIntervalDays = Number(data.intervalDays) || 30
  let finalPlanId: string | null = null

  if (data.planId) {
    const plan = await db.customerSubscriptionPlan.findFirst({
      where: { id: data.planId, clientId, isActive: true },
    })
    if (!plan) throw new Error('Selected subscription plan not found or inactive')
    finalAmountEgp = plan.amountEgp
    finalBillingInterval = plan.billingInterval
    finalIntervalDays = plan.intervalDays
    finalPlanId = plan.id
  } else {
    finalAmountEgp = Math.round(Number(data.amountEgp) * 100) / 100
    if (!Number.isFinite(finalAmountEgp) || finalAmountEgp <= 0) {
      throw new Error('Valid subscription amount is required')
    }
  }

  const amountCents = toEgpCents(finalAmountEgp)
  const now = new Date()
  const startDate = data.firstBillingDate ? new Date(data.firstBillingDate) : now
  const nextBillingAt = data.generateFirstInvoiceNow ? now : startDate
  const periodEnd = calculateNextBillingDate(startDate, finalBillingInterval, finalIntervalDays)

  const subscription = await db.customerSubscription.create({
    data: {
      clientId,
      planId: finalPlanId,
      customerName: cleanName,
      customerEmail: cleanEmail,
      customerPhone: data.customerPhone ? String(data.customerPhone).trim() : null,
      senderHandle: data.senderHandle ? String(data.senderHandle).trim() : null,
      amountEgp: finalAmountEgp,
      amountCents,
      currency: 'EGP',
      billingInterval: finalBillingInterval,
      intervalDays: finalIntervalDays,
      status: 'ACTIVE',
      currentPeriodStart: startDate,
      currentPeriodEnd: periodEnd,
      nextBillingAt,
      description: data.description ? String(data.description).trim() : null,
      metadata: data.metadata || null,
    },
    include: { plan: true },
  })

  // If immediate invoice generation is requested, create it now
  let firstInvoice = null
  if (data.generateFirstInvoiceNow) {
    firstInvoice = await generateInvoiceForSubscription(subscription.id, now)
  }

  return { subscription, firstInvoice }
}

export async function generateInvoiceForSubscription(
  subscriptionId: string,
  now = new Date()
) {
  return db.$transaction(async (tx) => {
    const sub = await tx.customerSubscription.findUniqueOrThrow({
      where: { id: subscriptionId },
      include: { client: true, plan: true },
    })

    if (sub.status !== 'ACTIVE' && sub.status !== 'PAST_DUE') {
      throw new Error(`Cannot generate invoice for subscription with status: ${sub.status}`)
    }

    const client = sub.client
    const invoiceNumber = generateInvoiceNumber()
    const amountEgp = sub.amountEgp
    const amountCents = sub.amountCents || toEgpCents(amountEgp)
    const dueDate = new Date(now.getTime() + Math.max(1, sub.intervalDays) * 24 * 60 * 60 * 1000)

    // Build InstaPay deep link for this merchant
    let deepLinkUrl = `https://ipn.eg/S/${encodeURIComponent(client.instapayHandle || 'merchant')}/instapay`
    if (client.instapayPaymentUrl) {
      const parsed = parseInstaPayPaymentLink(client.instapayPaymentUrl)
      if (parsed) {
        deepLinkUrl = client.instapayPaymentUrl
      }
    }

    // 1. Create checkout Transaction for this invoice
    const transaction = await tx.transaction.create({
      data: {
        clientId: client.id,
        senderHandle: sub.senderHandle || 'customer@instapay',
        recipientHandle: client.instapayHandle || 'merchant@instapay',
        amountEgp,
        amountCents,
        currency: 'EGP',
        status: 'PENDING',
        purpose: 'CHECKOUT',
        note: `Invoice ${invoiceNumber} - ${sub.description || sub.plan?.name || 'Recurring Subscription'}`,
        deepLinkUrl,
        deepLinkToken: crypto.randomBytes(16).toString('hex'),
        expiresAt: dueDate,
      },
    })

    const checkoutUrl = resolveCheckoutUrl(transaction.sessionId)

    // 2. Create CustomerInvoice
    const invoice = await tx.customerInvoice.create({
      data: {
        invoiceNumber,
        clientId: client.id,
        subscriptionId: sub.id,
        transactionId: transaction.id,
        customerName: sub.customerName,
        customerEmail: sub.customerEmail,
        customerPhone: sub.customerPhone,
        senderHandle: sub.senderHandle,
        amountEgp,
        amountCents,
        currency: 'EGP',
        status: 'PENDING',
        billingPeriodStart: sub.nextBillingAt,
        billingPeriodEnd: calculateNextBillingDate(sub.nextBillingAt, sub.billingInterval, sub.intervalDays),
        dueDate,
        sessionId: transaction.sessionId,
        checkoutUrl,
      },
    })

    // 3. Advance subscription schedule
    const newPeriodStart = sub.nextBillingAt
    const newPeriodEnd = calculateNextBillingDate(newPeriodStart, sub.billingInterval, sub.intervalDays)
    const nextBillingAt = newPeriodEnd

    await tx.customerSubscription.update({
      where: { id: sub.id },
      data: {
        currentPeriodStart: newPeriodStart,
        currentPeriodEnd: newPeriodEnd,
        nextBillingAt,
        lastInvoiceAt: now,
      },
    })

    // 4. Enqueue webhook outbox
    await enqueueSubscriptionWebhookOutbox(tx, client, 'subscription.invoice_created', {
      subscriptionId: sub.id,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customerName,
      customerEmail: invoice.customerEmail,
      amountEgp: invoice.amountEgp,
      currency: invoice.currency,
      dueDate: invoice.dueDate.toISOString(),
      checkoutUrl: invoice.checkoutUrl,
      sessionId: transaction.sessionId,
    })

    // 5. Send customer invoice email asynchronously
    const emailContent = renderInvoiceEmail({
      businessName: client.businessName,
      customerName: sub.customerName,
      invoiceNumber: invoice.invoiceNumber,
      amountEgp: invoice.amountEgp,
      dueDate: invoice.dueDate,
      checkoutUrl,
      note: sub.description || sub.plan?.name || undefined,
    })

    sendApplicationEmail({
      to: sub.customerEmail,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    }).catch((err) => console.warn(`[subscription] Email send failure for invoice ${invoice.id}:`, err))

    return { invoice, transaction, checkoutUrl }
  })
}

export async function sendInvoiceReminder(invoiceId: string, now = new Date()) {
  const invoice = await db.customerInvoice.findUnique({
    where: { id: invoiceId },
    include: { client: true, subscription: true },
  })

  if (!invoice || invoice.status !== 'PENDING') {
    return false
  }

  const client = invoice.client
  const emailContent = renderReminderEmail({
    businessName: client.businessName,
    customerName: invoice.customerName,
    invoiceNumber: invoice.invoiceNumber,
    amountEgp: invoice.amountEgp,
    dueDate: invoice.dueDate,
    checkoutUrl: invoice.checkoutUrl || resolveCheckoutUrl(invoice.sessionId || ''),
  })

  await sendApplicationEmail({
    to: invoice.customerEmail,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text,
  }).catch((err) => console.warn(`[subscription] Reminder email failure for invoice ${invoice.id}:`, err))

  await db.customerInvoice.update({
    where: { id: invoice.id },
    data: { reminderSentAt: now },
  })

  await enqueueSubscriptionWebhookOutbox(db, client, 'subscription.invoice_reminder', {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    subscriptionId: invoice.subscriptionId,
    customerEmail: invoice.customerEmail,
    amountEgp: invoice.amountEgp,
    dueDate: invoice.dueDate.toISOString(),
    reminderSentAt: now.toISOString(),
  })

  return true
}

export async function processScheduledInvoices(now = new Date()): Promise<{ generated: number; errors: number }> {
  // Find all active subscriptions where nextBillingAt <= now
  const dueSubscriptions = await db.customerSubscription.findMany({
    where: {
      status: 'ACTIVE',
      nextBillingAt: { lte: now },
    },
    take: 100,
  })

  let generated = 0
  let errors = 0

  for (const sub of dueSubscriptions) {
    try {
      await generateInvoiceForSubscription(sub.id, now)
      generated++
    } catch (err) {
      errors++
      console.error(`[subscription-scheduler] Failed to generate invoice for subscription ${sub.id}:`, err)
    }
  }

  return { generated, errors }
}

export async function processUpcomingInvoiceReminders(now = new Date()): Promise<number> {
  const pendingInvoices = await db.customerInvoice.findMany({
    where: {
      status: 'PENDING',
      reminderSentAt: null,
      dueDate: { gt: now },
    },
    include: { subscription: true, client: true },
    take: 100,
  })

  let count = 0
  for (const inv of pendingInvoices) {
    const reminderDays = inv.subscription?.reminderDaysBefore ?? 2
    const reminderThresholdMs = reminderDays * 24 * 60 * 60 * 1000
    if (now.getTime() >= inv.dueDate.getTime() - reminderThresholdMs) {
      try {
        await sendInvoiceReminder(inv.id, now)
        count++
      } catch (err) {
        console.warn(`[subscription-scheduler] Failed sending reminder for invoice ${inv.id}:`, err)
      }
    }
  }
  return count
}

export async function processOverdueInvoices(now = new Date()): Promise<number> {
  const overdueInvoices = await db.customerInvoice.findMany({
    where: {
      status: 'PENDING',
      dueDate: { lt: now },
    },
    include: { client: true },
    take: 100,
  })

  let count = 0
  for (const inv of overdueInvoices) {
    try {
      await db.$transaction(async (tx) => {
        await tx.customerInvoice.update({
          where: { id: inv.id },
          data: { status: 'OVERDUE', overdueNotifiedAt: now },
        })
        if (inv.subscriptionId) {
          await tx.customerSubscription.update({
            where: { id: inv.subscriptionId },
            data: { status: 'PAST_DUE' },
          })
        }
        await enqueueSubscriptionWebhookOutbox(tx, inv.client, 'subscription.past_due', {
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          subscriptionId: inv.subscriptionId,
          customerEmail: inv.customerEmail,
          amountEgp: inv.amountEgp,
          dueDate: inv.dueDate.toISOString(),
          overdueAt: now.toISOString(),
        })
      })
      count++
    } catch (err) {
      console.warn(`[subscription-scheduler] Failed marking invoice overdue ${inv.id}:`, err)
    }
  }
  return count
}

export async function processPlatformSubscriptionRenewals(now = new Date()): Promise<number> {
  // Find approved active merchants whose paid subscription ends within 3 days or is overdue
  const threeDaysFuture = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
  const expiringMerchants = await db.client.findMany({
    where: {
      approvalStatus: 'APPROVED',
      isActive: true,
      subscriptionPlan: { not: 'FREE_TRIAL' },
      subscriptionEndsAt: { lte: threeDaysFuture },
    },
    take: 50,
  })

  let count = 0
  const platformHandle = process.env.PLATFORM_INSTAPAY_HANDLE || 'platform@instapay'
  const platformPaymentUrl =
    process.env.PLATFORM_INSTAPAY_PAYMENT_URL ||
    `https://ipn.eg/S/platform/instapay/SUBSCRIPTION`

  for (const merchant of expiringMerchants) {
    try {
      // Check if a pending renewal checkout already exists from the last 24 hours
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const existingPending = await db.transaction.findFirst({
        where: {
          clientId: merchant.id,
          purpose: 'SUBSCRIPTION',
          status: 'PENDING',
          createdAt: { gte: oneDayAgo },
        },
      })

      if (existingPending) {
        continue
      }

      const plan = await db.plan.findUnique({ where: { name: merchant.subscriptionPlan } })
      if (!plan || !plan.isActive || plan.priceEgp <= 0) continue

      const amountEgp = plan.offerPriceEgp && plan.offerEndsAt && plan.offerEndsAt > now
        ? plan.offerPriceEgp
        : plan.priceEgp
      const amountCents = toEgpCents(amountEgp)
      const expiresAt = new Date(now.getTime() + 72 * 60 * 60 * 1000) // 72h renewal grace

      const transaction = await db.transaction.create({
        data: {
          clientId: merchant.id,
          senderHandle: merchant.instapayHandle || 'merchant@instapay',
          recipientHandle: platformHandle,
          amountEgp,
          amountCents,
          currency: 'EGP',
          status: 'PENDING',
          purpose: 'SUBSCRIPTION',
          subscriptionPlanName: plan.name,
          note: `Automated Platform Subscription Renewal (${plan.name} Tier)`,
          deepLinkUrl: platformPaymentUrl,
          deepLinkToken: 'platform_renewal',
          expiresAt,
        },
      })

      const checkoutUrl = resolveCheckoutUrl(transaction.sessionId)

      // 1. In-app merchant notification & realtime socket notification
      const notif = await db.merchantNotification.create({
        data: {
          clientId: merchant.id,
          title: `Subscription Renewal Due: ${plan.name} Tier`,
          message: `Your NilePay gateway subscription is expiring soon. Click here to renew your plan for ${amountEgp.toFixed(2)} EGP via InstaPay.`,
          severity: 'WARNING',
        },
      })

      emitMerchantNotification(merchant.id, {
        id: notif.id,
        title: notif.title,
        message: notif.message,
        severity: notif.severity,
        createdAt: notif.createdAt.toISOString(),
      })

      // 3. Email reminder
      if (merchant.email) {
        const email = renderPlatformRenewalEmail({
          businessName: merchant.businessName,
          planName: plan.name,
          amountEgp,
          expiryDate: merchant.subscriptionEndsAt || now,
          checkoutUrl,
          platformHandle,
        })

        sendApplicationEmail({
          to: merchant.email,
          subject: email.subject,
          html: email.html,
          text: email.text,
        }).catch((err) => console.warn(`[subscription-renewal] Email send error for merchant ${merchant.id}:`, err))
      }

      count++
    } catch (err) {
      console.warn(`[subscription-renewal] Failed processing renewal for merchant ${merchant.id}:`, err)
    }
  }

  return count
}

export async function getSubscriptionStats(clientId: string) {
  const [activeSubscribers, plansCount, invoicesStats, overdueCount] = await Promise.all([
    db.customerSubscription.count({
      where: { clientId, status: 'ACTIVE' },
    }),
    db.customerSubscriptionPlan.count({
      where: { clientId, isActive: true },
    }),
    db.customerInvoice.aggregate({
      where: { clientId, status: 'PENDING' },
      _sum: { amountEgp: true },
      _count: { _all: true },
    }),
    db.customerInvoice.count({
      where: { clientId, status: 'OVERDUE' },
    }),
  ])

  // Calculate monthly recurring revenue (MRR) from active subscriptions
  const activeSubs = await db.customerSubscription.findMany({
    where: { clientId, status: 'ACTIVE' },
    select: { amountEgp: true, billingInterval: true, intervalDays: true },
  })

  let mrrEgp = 0
  for (const s of activeSubs) {
    const interval = s.billingInterval || 'MONTHLY'
    if (interval === 'MONTHLY') mrrEgp += s.amountEgp
    else if (interval === 'WEEKLY') mrrEgp += s.amountEgp * (30 / 7)
    else if (interval === 'DAILY') mrrEgp += s.amountEgp * 30
    else if (interval === 'YEARLY') mrrEgp += s.amountEgp / 12
    else if (interval === 'CUSTOM_DAYS') mrrEgp += s.amountEgp * (30 / Math.max(1, s.intervalDays))
  }

  return {
    activeSubscribers,
    plansCount,
    monthlyRecurringRevenueEgp: Math.round(mrrEgp * 100) / 100,
    pendingInvoicesCount: invoicesStats._count._all || 0,
    pendingInvoicesTotalEgp: invoicesStats._sum.amountEgp || 0,
    overdueInvoicesCount: overdueCount,
  }
}
