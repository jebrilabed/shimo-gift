export type AdminDashboardPeriod = "24h" | "7d" | "30d" | "all";
export const ADMIN_DASHBOARD_PERIODS: readonly AdminDashboardPeriod[];
export function normalizeAdminDashboardPeriod(value: unknown): AdminDashboardPeriod;
export function getAdminDashboardPeriodWhere(period: AdminDashboardPeriod, now?: number | Date): { createdAt?: { gte: Date } };
export function buildAdminLowStockSkuWhere(threshold: number): { isActive: true; stockQuantity: { gt: 0; lt: number }; product: { status: "ACTIVE" } };
export function getAdminOrderDetailHref(orderId: string): string;
export function summarizeAdminOrderGroups(groups: Array<{ status: string; currency: string; _count: { _all: number }; _sum: { total: unknown } }>): {
  counts: Record<string, number>;
  orderCount: number;
  totals: Array<{ currency: string; orderValue: string; deliveredValue: string }>;
};
export function adminAuditActionMessageKey(action: string): string;
