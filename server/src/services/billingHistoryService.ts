import { db } from '../db.js'

export function hasUsedTrial(client: { trialRedeemedAt?: Date | null; subscriptionEndsAt?: Date | null; subscriptionPlan: string; isFreeTrial: boolean }) {
  return Boolean(client.trialRedeemedAt || client.subscriptionEndsAt || client.subscriptionPlan !== 'FREE_TRIAL' || !client.isFreeTrial)
}

export async function getBillingHistory(client: any, page: number, now = new Date()) {
  const where = { clientId: client.id, purpose: 'SUBSCRIPTION' }
  const [transactions, total] = await Promise.all([
    db.transaction.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * 25, take: 25,
      select: { id: true, sessionId: true, subscriptionPlanName: true, note: true, amountEgp: true, currency: true, status: true, createdAt: true, expiresAt: true, detectedAt: true } }),
    db.transaction.count({ where }),
  ])
  return {
    purchases: transactions.map(tx => ({
      ...tx,
      kind: tx.subscriptionPlanName?.startsWith('BUNDLE:') ? 'BUNDLE' : 'PLAN',
      status: tx.status === 'PENDING' && tx.expiresAt <= now ? 'EXPIRED' : tx.status,
    })),
    page, total, hasMore: page * 25 < total,
    trial: { used: hasUsedTrial(client), activatedAt: client.trialRedeemedAt ?? null },
  }
}
