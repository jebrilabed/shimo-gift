-- Supports bounded chronological listing and optional createdAt range filters.
CREATE INDEX "orders_createdAt_idx" ON "orders"("createdAt");
