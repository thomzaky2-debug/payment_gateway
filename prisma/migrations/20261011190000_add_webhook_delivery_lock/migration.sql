-- Protect manual resend and retry-worker deliveries from concurrent dispatch.
-- IF NOT EXISTS keeps this additive migration safe for databases provisioned
-- previously with `prisma db push`.
ALTER TABLE "WebhookLog" ADD COLUMN IF NOT EXISTS "deliveryLockedUntil" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "WebhookLog_deliveryLockedUntil_idx"
  ON "WebhookLog"("deliveryLockedUntil");
