export const ADMIN_DASHBOARD_PERIODS = ["24h", "7d", "30d", "all"];

const periodDurations = { "24h": 24 * 60 * 60 * 1000, "7d": 7 * 24 * 60 * 60 * 1000, "30d": 30 * 24 * 60 * 60 * 1000 };
const orderStatuses = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];

function toCents(value) {
  const [whole = "0", fraction = ""] = String(value ?? "0").split(".");
  return BigInt(whole) * 100n + BigInt(`${fraction}00`.slice(0, 2));
}

function fromCents(cents) {
  const sign = cents < 0n ? "-" : "";
  const absolute = cents < 0n ? -cents : cents;
  return `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}

export function normalizeAdminDashboardPeriod(value) {
  return ADMIN_DASHBOARD_PERIODS.includes(value) ? value : "7d";
}

export function getAdminDashboardPeriodWhere(period, now = Date.now()) {
  const duration = periodDurations[period];
  const timestamp = now instanceof Date ? now.getTime() : now;
  return duration ? { createdAt: { gte: new Date(timestamp - duration) } } : {};
}

export function buildAdminLowStockSkuWhere(threshold) {
  return { isActive: true, stockQuantity: { gt: 0, lt: threshold }, product: { status: "ACTIVE" } };
}

export function getAdminOrderDetailHref(orderId) {
  return `/admin/orders/${encodeURIComponent(orderId)}`;
}

export function summarizeAdminOrderGroups(groups) {
  const counts = Object.fromEntries(orderStatuses.map((status) => [status, 0]));
  const totals = new Map();
  for (const group of groups) {
    counts[group.status] = (counts[group.status] ?? 0) + group._count._all;
    const currency = group.currency;
    const current = totals.get(currency) ?? { orderValue: 0n, deliveredValue: 0n };
    const amount = toCents(group._sum.total);
    if (group.status !== "CANCELLED") current.orderValue += amount;
    if (group.status === "DELIVERED") current.deliveredValue += amount;
    totals.set(currency, current);
  }
  return { counts, orderCount: Object.values(counts).reduce((sum, count) => sum + count, 0), totals: [...totals].map(([currency, values]) => ({ currency, orderValue: fromCents(values.orderValue), deliveredValue: fromCents(values.deliveredValue) })) };
}

export function adminAuditActionMessageKey(action) {
  const actionKeys = {
    "catalog.product.create": "activityProductCreated",
    "catalog.product.update": "activityProductUpdated",
    "catalog.product.archive": "activityProductArchived",
    "catalog.product.status": "activityProductUpdated",
    "catalog.sku.create": "activitySkuUpdated",
    "catalog.sku.update": "activitySkuUpdated",
    "catalog.inventory.update": "activityInventoryUpdated",
    "catalog.category.create": "activityCategoryUpdated",
    "catalog.category.update": "activityCategoryUpdated",
    "catalog.category.delete": "activityCategoryUpdated",
    "orders.status.update": "activityOrderUpdated",
    "orders.cancel": "activityOrderCancelled",
    "settings.store.update": "activitySettingsUpdated",
    "catalog.image.delete": "activityProductUpdated",
    "catalog.image.primary": "activityProductUpdated",
    "catalog.image.reorder": "activityProductUpdated",
  };
  return actionKeys[action] ?? "activityGeneric";
}
