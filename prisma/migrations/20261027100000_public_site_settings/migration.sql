CREATE TABLE "PublicSiteSettings" (
    "id" TEXT NOT NULL DEFAULT 'public',
    "content" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PublicSiteSettings_pkey" PRIMARY KEY ("id")
);
