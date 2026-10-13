-- Store a small, validated data URL so profile photos remain available on the
-- static hosting plan without exposing a public file-upload directory.
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "profileImageData" TEXT;
