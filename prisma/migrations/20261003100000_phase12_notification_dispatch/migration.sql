-- Add the minimum durable state needed to correlate order notifications,
-- schedule bounded retries, and surface ambiguous delivery outcomes safely.
ALTER TABLE "notification_outbox"
  ADD COLUMN "orderId" TEXT,
  ADD COLUMN "nextAttemptAt" TIMESTAMPTZ(3),
  ADD COLUMN "deliveryUnknown" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "notification_outbox"
  ADD CONSTRAINT "notification_outbox_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "orders"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "notification_outbox_status_nextAttemptAt_createdAt_idx"
  ON "notification_outbox"("status", "nextAttemptAt", "createdAt");
CREATE INDEX "notification_outbox_status_lastAttemptAt_idx"
  ON "notification_outbox"("status", "lastAttemptAt");
CREATE INDEX "notification_outbox_orderId_idx"
  ON "notification_outbox"("orderId");
