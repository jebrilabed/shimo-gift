import assert from "node:assert/strict";
import test from "node:test";
import {
  adminAuditActionMessageKey,
  buildAdminLowStockSkuWhere,
  getAdminDashboardPeriodWhere,
  getAdminOrderDetailHref,
  normalizeAdminDashboardPeriod,
  summarizeAdminOrderGroups,
} from "../src/lib/admin/dashboard-data.mjs";

test("dashboard periods normalize safely and build consistent rolling date filters", () => {
  const now = new Date("2026-10-03T12:00:00.000Z");
  assert.equal(normalizeAdminDashboardPeriod("30d"), "30d");
  assert.equal(normalizeAdminDashboardPeriod("invalid"), "7d");
  assert.equal(getAdminDashboardPeriodWhere("24h", now).createdAt.gte.toISOString(), "2026-10-02T12:00:00.000Z");
  assert.equal(getAdminDashboardPeriodWhere("7d", now).createdAt.gte.toISOString(), "2026-09-26T12:00:00.000Z");
  assert.equal(getAdminDashboardPeriodWhere("30d", now).createdAt.gte.toISOString(), "2026-09-03T12:00:00.000Z");
  assert.deepEqual(getAdminDashboardPeriodWhere("all", now), {});
});

test("status groups count all statuses and keep order values separate by currency", () => {
  const summary = summarizeAdminOrderGroups([
    { status: "PENDING", currency: "SAR", _count: { _all: 2 }, _sum: { total: "125.25" } },
    { status: "DELIVERED", currency: "SAR", _count: { _all: 1 }, _sum: { total: "100.50" } },
    { status: "CANCELLED", currency: "SAR", _count: { _all: 3 }, _sum: { total: "900.00" } },
    { status: "DELIVERED", currency: "USD", _count: { _all: 1 }, _sum: { total: "123456789012.34" } },
  ]);
  assert.equal(summary.orderCount, 7);
  assert.equal(summary.counts.PENDING, 2);
  assert.equal(summary.counts.PROCESSING, 0);
  assert.equal(summary.counts.CANCELLED, 3);
  assert.deepEqual(summary.totals, [
    { currency: "SAR", orderValue: "225.75", deliveredValue: "100.50" },
    { currency: "USD", orderValue: "123456789012.34", deliveredValue: "123456789012.34" },
  ]);
});

test("low stock query is SKU based, threshold-bound, and excludes inactive catalog records", () => {
  assert.deepEqual(buildAdminLowStockSkuWhere(12), {
    isActive: true,
    stockQuantity: { gt: 0, lt: 12 },
    product: { status: "ACTIVE" },
  });
});

test("activity uses known audit actions with a safe generic fallback", () => {
  assert.equal(adminAuditActionMessageKey("orders.cancel"), "activityOrderCancelled");
  assert.equal(adminAuditActionMessageKey("catalog.inventory.update"), "activityInventoryUpdated");
  assert.equal(adminAuditActionMessageKey("unknown.secret"), "activityGeneric");
});

test("dashboard order links target the existing admin detail route and encode IDs", () => {
  assert.equal(getAdminOrderDetailHref("order-123"), "/admin/orders/order-123");
  assert.equal(getAdminOrderDetailHref("order/id?x=1"), "/admin/orders/order%2Fid%3Fx%3D1");
});
