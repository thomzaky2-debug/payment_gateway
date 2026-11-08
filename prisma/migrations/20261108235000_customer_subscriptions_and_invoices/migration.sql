-- CreateTable
CREATE TABLE "CustomerSubscriptionPlan" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "amountEgp" DOUBLE PRECISION NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EGP',
    "billingInterval" TEXT NOT NULL DEFAULT 'MONTHLY',
    "intervalDays" INTEGER NOT NULL DEFAULT 30,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerSubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerSubscription" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "planId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT,
    "senderHandle" TEXT,
    "amountEgp" DOUBLE PRECISION NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EGP',
    "billingInterval" TEXT NOT NULL DEFAULT 'MONTHLY',
    "intervalDays" INTEGER NOT NULL DEFAULT 30,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "currentPeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "nextBillingAt" TIMESTAMP(3) NOT NULL,
    "reminderDaysBefore" INTEGER NOT NULL DEFAULT 2,
    "lastInvoiceAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerInvoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "transactionId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT,
    "senderHandle" TEXT,
    "amountEgp" DOUBLE PRECISION NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EGP',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "billingPeriodStart" TIMESTAMP(3) NOT NULL,
    "billingPeriodEnd" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "sessionId" TEXT,
    "checkoutUrl" TEXT,
    "paidAt" TIMESTAMP(3),
    "reminderSentAt" TIMESTAMP(3),
    "overdueNotifiedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerSubscriptionPlan_clientId_isActive_idx" ON "CustomerSubscriptionPlan"("clientId", "isActive");
CREATE INDEX "CustomerSubscriptionPlan_clientId_createdAt_idx" ON "CustomerSubscriptionPlan"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerSubscription_clientId_status_nextBillingAt_idx" ON "CustomerSubscription"("clientId", "status", "nextBillingAt");
CREATE INDEX "CustomerSubscription_status_nextBillingAt_idx" ON "CustomerSubscription"("status", "nextBillingAt");
CREATE INDEX "CustomerSubscription_customerEmail_idx" ON "CustomerSubscription"("customerEmail");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerInvoice_invoiceNumber_key" ON "CustomerInvoice"("invoiceNumber");
CREATE UNIQUE INDEX "CustomerInvoice_transactionId_key" ON "CustomerInvoice"("transactionId");
CREATE UNIQUE INDEX "CustomerInvoice_sessionId_key" ON "CustomerInvoice"("sessionId");
CREATE INDEX "CustomerInvoice_clientId_status_createdAt_idx" ON "CustomerInvoice"("clientId", "status", "createdAt");
CREATE INDEX "CustomerInvoice_subscriptionId_status_idx" ON "CustomerInvoice"("subscriptionId", "status");
CREATE INDEX "CustomerInvoice_status_dueDate_idx" ON "CustomerInvoice"("status", "dueDate");
CREATE INDEX "CustomerInvoice_sessionId_idx" ON "CustomerInvoice"("sessionId");

-- AddForeignKey
ALTER TABLE "CustomerSubscriptionPlan" ADD CONSTRAINT "CustomerSubscriptionPlan_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerSubscription" ADD CONSTRAINT "CustomerSubscription_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerSubscription" ADD CONSTRAINT "CustomerSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "CustomerSubscriptionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInvoice" ADD CONSTRAINT "CustomerInvoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerInvoice" ADD CONSTRAINT "CustomerInvoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "CustomerSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerInvoice" ADD CONSTRAINT "CustomerInvoice_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

