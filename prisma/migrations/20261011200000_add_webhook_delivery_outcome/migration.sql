-- Write a durable marker before network delivery. Unknown outcomes are never
-- retried automatically, preventing duplicate merchant-side processing.
ALTER TABLE "WebhookLog" ADD COLUMN IF NOT EXISTS "deliveryStartedAt" TIMESTAMP(3);
ALTER TABLE "WebhookLog" ADD COLUMN IF NOT EXISTS "outcomeKnown" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS "WebhookLog_outcomeKnown_nextAttemptAt_idx"
  ON "WebhookLog"("outcomeKnown", "nextAttemptAt");
