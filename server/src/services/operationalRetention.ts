// Payment records use the separate account retention policy. Never purge an
// unresolved delivery here: it may still require retry or manual review.
export const WEBHOOK_LOG_RETENTION_DAYS = 90
export const AUDIT_LOG_RETENTION_DAYS = 365

export function operationalRetentionFilters(now: Date) {
  return {
    webhook: {
      createdAt: { lt: new Date(now.getTime() - WEBHOOK_LOG_RETENTION_DAYS * 86400000) },
      isSuccess: true,
      outcomeKnown: true,
      nextAttemptAt: null,
      deliveryLockedUntil: null,
    },
    audit: { createdAt: { lt: new Date(now.getTime() - AUDIT_LOG_RETENTION_DAYS * 86400000) } },
  }
}
