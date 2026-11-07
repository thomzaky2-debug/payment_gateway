-- Persist the merchant-supplied, server-validated return URL so the hosted
-- checkout no longer trusts a query parameter for post-payment navigation.
ALTER TABLE "Transaction" ADD COLUMN "returnUrl" TEXT;

-- Track admin suspension separately from the deletion grace-period flag.
ALTER TABLE "Client" ADD COLUMN "suspendedAt" TIMESTAMP(3);
