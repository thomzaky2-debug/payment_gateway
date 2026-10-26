-- Mobile backend contract: refresh tokens, detector device credentials, account deletion

-- 1. Extend AuthSession for rotating refresh tokens and device linking
ALTER TABLE "AuthSession" ADD COLUMN IF NOT EXISTS "refreshTokenHash" TEXT;
ALTER TABLE "AuthSession" ADD COLUMN IF NOT EXISTS "refreshExpiresAt" TIMESTAMP(3);
ALTER TABLE "AuthSession" ADD COLUMN IF NOT EXISTS "familyId" TEXT;
ALTER TABLE "AuthSession" ADD COLUMN IF NOT EXISTS "rotatedAt" TIMESTAMP(3);
ALTER TABLE "AuthSession" ADD COLUMN IF NOT EXISTS "deviceId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "AuthSession_refreshTokenHash_key" ON "AuthSession"("refreshTokenHash");
CREATE INDEX IF NOT EXISTS "AuthSession_familyId_idx" ON "AuthSession"("familyId");
CREATE INDEX IF NOT EXISTS "AuthSession_deviceId_idx" ON "AuthSession"("deviceId");

-- 2. Extend DetectorDevice with individual device credentials and revocation
ALTER TABLE "DetectorDevice" ADD COLUMN IF NOT EXISTS "name" TEXT;
ALTER TABLE "DetectorDevice" ADD COLUMN IF NOT EXISTS "credentialHash" TEXT;
ALTER TABLE "DetectorDevice" ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "DetectorDevice_credentialHash_key" ON "DetectorDevice"("credentialHash");
CREATE INDEX IF NOT EXISTS "DetectorDevice_clientId_revokedAt_idx" ON "DetectorDevice"("clientId", "revokedAt");

-- 3. Extend Client for account deletion tracking
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "deletionRequestedAt" TIMESTAMP(3);
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Client_deletedAt_idx" ON "Client"("deletedAt");
