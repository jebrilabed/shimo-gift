-- Phase 7: configurable store identity and customer-owned addresses.
ALTER TABLE "store_settings"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "defaultLocale" "Locale" NOT NULL DEFAULT 'ar',
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "customer_addresses" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "addressLine" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "postalCode" TEXT,
  "notes" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "customer_addresses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customer_addresses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "customer_addresses_one_default_per_user"
  ON "customer_addresses"("userId") WHERE "isDefault" = true;
CREATE INDEX "customer_addresses_userId_createdAt_idx"
  ON "customer_addresses"("userId", "createdAt");
