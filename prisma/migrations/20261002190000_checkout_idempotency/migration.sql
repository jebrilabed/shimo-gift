-- Phase 9: one durable result per signed checkout attempt.
ALTER TABLE "orders" ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "orders_idempotencyKey_key" ON "orders"("idempotencyKey");
