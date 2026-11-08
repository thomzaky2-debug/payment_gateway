-- Short-lived re-authentication marker for sensitive actions (step-up auth).
ALTER TABLE "AuthSession" ADD COLUMN "stepUpExpiresAt" TIMESTAMP(3);
