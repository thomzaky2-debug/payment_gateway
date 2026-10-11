-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Owner" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "dstMode" TEXT NOT NULL DEFAULT 'AUTO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Owner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerification" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'MERCHANT_SIGNUP',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "businessType" TEXT,
    "instapayHandle" TEXT NOT NULL,
    "instapayPaymentUrl" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "whatsappNumber" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "apiKey" TEXT,
    "detectToken" TEXT,
    "apiKeyHash" TEXT,
    "detectTokenHash" TEXT,
    "apiKeyLastUsedAt" TIMESTAMP(3),
    "detectTokenLastUsedAt" TIMESTAMP(3),
    "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "webhookUrl" TEXT,
    "webhookSecret" TEXT,
    "webhookSecretHash" TEXT,
    "checkoutTtlMin" INTEGER NOT NULL DEFAULT 10,
    "autoAcceptOverpaid" BOOLEAN NOT NULL DEFAULT true,
    "overpaidMaxExcessEgp" DOUBLE PRECISION DEFAULT 100.0,
    "underpaidToleranceEnabled" BOOLEAN NOT NULL DEFAULT false,
    "underpaidToleranceEgp" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "subscriptionPlan" TEXT NOT NULL DEFAULT 'FREE_TRIAL',
    "subscriptionEndsAt" TIMESTAMP(3),
    "isFreeTrial" BOOLEAN NOT NULL DEFAULT true,
    "trialRedeemedAt" TIMESTAMP(3),
    "txLimit" INTEGER NOT NULL DEFAULT 5,
    "txCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecialOffer" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priceEgp" DOUBLE PRECISION NOT NULL,
    "maxTransactions" INTEGER NOT NULL,
    "periodDays" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "validUntil" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecialOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncomingPaymentEvent" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "reference" TEXT,
    "senderHandle" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3),
    "sessionId" TEXT,
    "result" TEXT NOT NULL DEFAULT 'PROCESSING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncomingPaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "clientId" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "credentialFingerprint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopUpBundle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "priceEgp" DOUBLE PRECISION NOT NULL,
    "extraTx" INTEGER NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TopUpBundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BundlePurchase" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "sessionId" TEXT,
    "extraTx" INTEGER NOT NULL,
    "priceEgp" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BundlePurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerchantNotification" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MerchantNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "senderHandle" TEXT NOT NULL,
    "recipientHandle" TEXT NOT NULL,
    "amountEgp" DOUBLE PRECISION NOT NULL,
    "amountCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'EGP',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "purpose" TEXT NOT NULL DEFAULT 'CHECKOUT',
    "subscriptionPlanName" TEXT,
    "note" TEXT,
    "deepLinkUrl" TEXT NOT NULL,
    "deepLinkToken" TEXT NOT NULL,
    "detectedRef" TEXT,
    "detectedAt" TIMESTAMP(3),
    "detectedAmountEgp" DOUBLE PRECISION,
    "detectedAmountCents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookLog" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "eventId" TEXT,
    "payload" TEXT NOT NULL,
    "statusCode" INTEGER,
    "response" TEXT,
    "isSuccess" BOOLEAN NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "nextAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MismatchedPayment" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "senderHandle" TEXT NOT NULL,
    "amountEgp" DOUBLE PRECISION NOT NULL,
    "amountCents" INTEGER,
    "reference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UNMATCHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MismatchedPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetectorDevice" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "appVersion" TEXT,
    "androidVersion" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DetectorDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceEgp" DOUBLE PRECISION NOT NULL,
    "maxTransactions" INTEGER NOT NULL,
    "periodDays" INTEGER NOT NULL DEFAULT 30,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "offerPriceEgp" DOUBLE PRECISION,
    "offerLabel" TEXT,
    "offerEndsAt" TIMESTAMP(3),

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Owner_email_key" ON "Owner"("email");

-- CreateIndex
CREATE INDEX "EmailVerification_email_purpose_createdAt_idx" ON "EmailVerification"("email", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "EmailVerification_expiresAt_idx" ON "EmailVerification"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Client_slug_key" ON "Client"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Client_email_key" ON "Client"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Client_apiKey_key" ON "Client"("apiKey");

-- CreateIndex
CREATE UNIQUE INDEX "Client_detectToken_key" ON "Client"("detectToken");

-- CreateIndex
CREATE UNIQUE INDEX "Client_apiKeyHash_key" ON "Client"("apiKeyHash");

-- CreateIndex
CREATE UNIQUE INDEX "Client_detectTokenHash_key" ON "Client"("detectTokenHash");

-- CreateIndex
CREATE INDEX "Client_instapayHandle_idx" ON "Client"("instapayHandle");

-- CreateIndex
CREATE INDEX "Client_instapayPaymentUrl_idx" ON "Client"("instapayPaymentUrl");

-- CreateIndex
CREATE INDEX "Client_apiKey_idx" ON "Client"("apiKey");

-- CreateIndex
CREATE INDEX "Client_detectToken_idx" ON "Client"("detectToken");

-- CreateIndex
CREATE INDEX "Client_apiKeyHash_idx" ON "Client"("apiKeyHash");

-- CreateIndex
CREATE INDEX "Client_detectTokenHash_idx" ON "Client"("detectTokenHash");

-- CreateIndex
CREATE INDEX "SpecialOffer_clientId_status_validUntil_idx" ON "SpecialOffer"("clientId", "status", "validUntil");

-- CreateIndex
CREATE INDEX "SpecialOffer_status_validUntil_idx" ON "SpecialOffer"("status", "validUntil");

-- CreateIndex
CREATE UNIQUE INDEX "IncomingPaymentEvent_eventKey_key" ON "IncomingPaymentEvent"("eventKey");

-- CreateIndex
CREATE INDEX "IncomingPaymentEvent_clientId_createdAt_idx" ON "IncomingPaymentEvent"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "IncomingPaymentEvent_clientId_reference_idx" ON "IncomingPaymentEvent"("clientId", "reference");

-- CreateIndex
CREATE INDEX "IncomingPaymentEvent_sessionId_idx" ON "IncomingPaymentEvent"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_clientId_kind_revokedAt_expiresAt_idx" ON "AuthSession"("clientId", "kind", "revokedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "AuthSession_kind_revokedAt_expiresAt_idx" ON "AuthSession"("kind", "revokedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "TopUpBundle_name_key" ON "TopUpBundle"("name");

-- CreateIndex
CREATE INDEX "BundlePurchase_clientId_createdAt_idx" ON "BundlePurchase"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "BundlePurchase_sessionId_idx" ON "BundlePurchase"("sessionId");

-- CreateIndex
CREATE INDEX "BundlePurchase_status_idx" ON "BundlePurchase"("status");

-- CreateIndex
CREATE INDEX "MerchantNotification_clientId_createdAt_idx" ON "MerchantNotification"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "MerchantNotification_clientId_readAt_idx" ON "MerchantNotification"("clientId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_sessionId_key" ON "Transaction"("sessionId");

-- CreateIndex
CREATE INDEX "Transaction_clientId_status_createdAt_idx" ON "Transaction"("clientId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_clientId_purpose_status_idx" ON "Transaction"("clientId", "purpose", "status");

-- CreateIndex
CREATE INDEX "Transaction_clientId_senderHandle_amountEgp_status_idx" ON "Transaction"("clientId", "senderHandle", "amountEgp", "status");

-- CreateIndex
CREATE INDEX "Transaction_clientId_senderHandle_amountCents_status_idx" ON "Transaction"("clientId", "senderHandle", "amountCents", "status");

-- CreateIndex
CREATE INDEX "Transaction_status_expiresAt_idx" ON "Transaction"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "Transaction_deepLinkToken_idx" ON "Transaction"("deepLinkToken");

-- CreateIndex
CREATE INDEX "Transaction_createdAt_idx" ON "Transaction"("createdAt");

-- CreateIndex
CREATE INDEX "WebhookLog_clientId_createdAt_idx" ON "WebhookLog"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "WebhookLog_eventId_idx" ON "WebhookLog"("eventId");

-- CreateIndex
CREATE INDEX "WebhookLog_isSuccess_nextAttemptAt_idx" ON "WebhookLog"("isSuccess", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "MismatchedPayment_clientId_createdAt_idx" ON "MismatchedPayment"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "DetectorDevice_clientId_lastSeenAt_idx" ON "DetectorDevice"("clientId", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "DetectorDevice_clientId_deviceId_key" ON "DetectorDevice"("clientId", "deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_name_key" ON "Plan"("name");

-- AddForeignKey
ALTER TABLE "SpecialOffer" ADD CONSTRAINT "SpecialOffer_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomingPaymentEvent" ADD CONSTRAINT "IncomingPaymentEvent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundlePurchase" ADD CONSTRAINT "BundlePurchase_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundlePurchase" ADD CONSTRAINT "BundlePurchase_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "TopUpBundle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerchantNotification" ADD CONSTRAINT "MerchantNotification_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookLog" ADD CONSTRAINT "WebhookLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MismatchedPayment" ADD CONSTRAINT "MismatchedPayment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetectorDevice" ADD CONSTRAINT "DetectorDevice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

