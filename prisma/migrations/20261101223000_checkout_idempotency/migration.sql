-- Nullable keys preserve existing checkouts. PostgreSQL permits multiple NULL keys.
ALTER TABLE "Transaction" ADD COLUMN "idempotencyKeyHash" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "idempotencyRequestHash" TEXT;
CREATE UNIQUE INDEX "Transaction_clientId_idempotencyKeyHash_key"
ON "Transaction"("clientId", "idempotencyKeyHash");
