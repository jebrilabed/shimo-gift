import assert from "node:assert/strict";
import test from "node:test";
import { buildAdminOrderWhere, parseAdminOrderFilters } from "../src/lib/admin/order-filters.mjs";
import { allowedOrderTransitions, canTransitionOrder } from "../src/lib/storefront/order-workflow.mjs";
import { parseInventoryInput } from "../src/lib/admin/catalog-validation.mjs";

const statuses = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];
const paymentStatuses = ["UNPAID", "PENDING", "PAID", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"];

test("order lifecycle permits only adjacent operational steps and eligible cancellations", () => {
  assert.equal(canTransitionOrder("PENDING", "CONFIRMED"), true);
  assert.equal(canTransitionOrder("CONFIRMED", "PROCESSING"), true);
  assert.equal(canTransitionOrder("PROCESSING", "SHIPPED"), true);
  assert.equal(canTransitionOrder("SHIPPED", "DELIVERED"), true);
  assert.equal(canTransitionOrder("PENDING", "DELIVERED"), false);
  assert.equal(canTransitionOrder("DELIVERED", "PROCESSING"), false);
  assert.equal(canTransitionOrder("PENDING", "CANCELLED"), true);
  assert.equal(canTransitionOrder("CONFIRMED", "CANCELLED"), true);
  assert.equal(canTransitionOrder("PROCESSING", "CANCELLED"), true);
  assert.equal(canTransitionOrder("SHIPPED", "CANCELLED"), false);
  assert.equal(canTransitionOrder("DELIVERED", "CANCELLED"), false);
  assert.deepEqual(allowedOrderTransitions("CANCELLED"), []);
});

test("admin order search and status/payment/date filters are bounded and server-ready", () => {
  const filters = parseAdminOrderFilters({
    q: "  FAR-123  ",
    status: "PROCESSING",
    paymentStatus: "UNPAID",
    from: "2026-10-01",
    to: "2026-10-02",
    page: "2",
  }, statuses, paymentStatuses);
  const where = buildAdminOrderWhere(filters);
  assert.equal(filters.query, "FAR-123");
  assert.equal(filters.page, 2);
  assert.equal(where.status, "PROCESSING");
  assert.equal(where.paymentStatus, "UNPAID");
  assert.equal(where.createdAt.gte.toISOString(), "2026-10-01T00:00:00.000Z");
  assert.equal(where.createdAt.lt.toISOString(), "2026-10-03T00:00:00.000Z");
  assert.deepEqual(where.OR.map((clause) => Object.keys(clause)[0]), ["orderNumber", "contactName", "contactPhone"]);
});

test("invalid order filters are ignored safely and malformed date ranges are reported", () => {
  const filters = parseAdminOrderFilters({
    q: "x".repeat(200),
    status: "DROP TABLE",
    paymentStatus: "UNKNOWN",
    from: "2026-02-30",
    to: "2026-01-01",
    page: "-1",
  }, statuses, paymentStatuses);
  const where = buildAdminOrderWhere(filters);
  assert.equal(filters.query.length, 120);
  assert.equal(filters.status, "");
  assert.equal(filters.paymentStatus, "");
  assert.equal(filters.dateError, true);
  assert.equal(filters.page, 1);
  assert.equal("createdAt" in where, false);
});

test("inventory quantity input accepts only bounded nonnegative integers and scoped IDs", () => {
  const valid = new FormData();
  valid.set("skuId", "sku-a");
  valid.set("productId", "product-a");
  valid.set("quantity", "12");
  assert.deepEqual(parseInventoryInput(valid), {
    ok: true,
    value: { skuId: "sku-a", productId: "product-a", quantity: 12 },
  });
  for (const quantity of ["-1", "1.5", "1000000000", " 2"]) {
    const form = new FormData();
    form.set("skuId", "sku-a");
    form.set("productId", "product-a");
    form.set("quantity", quantity);
    assert.equal(parseInventoryInput(form).ok, false);
  }
});
