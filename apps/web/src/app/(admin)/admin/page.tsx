import Link from "next/link";
import { Badge, Card, EmptyState, Select } from "@/components/ui";
import { adminMessages as messages } from "@/lib/admin/messages";
import { getLowStockThreshold } from "@/lib/admin/inventory";
import { adminAuditActionMessageKey, buildAdminLowStockSkuWhere, getAdminDashboardPeriodWhere, getAdminOrderDetailHref, normalizeAdminDashboardPeriod, summarizeAdminOrderGroups } from "@/lib/admin/dashboard-data.mjs";
import { requireAdminPage } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { OrderStatus } from "@/generated/prisma/enums";
import { displayVariantOptions, formatMoney } from "@/lib/storefront/format";
import { orderStatusLabel } from "@/lib/storefront/order-labels";

const periodOptions = ["24h", "7d", "30d", "all"] as const;
const orderStatuses = [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PROCESSING, OrderStatus.SHIPPED, OrderStatus.DELIVERED, OrderStatus.CANCELLED];

export default async function AdminDashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminPage();
  const params = await searchParams;
  const requestedPeriod = Array.isArray(params.period) ? params.period[0] : params.period;
  const period = normalizeAdminDashboardPeriod(requestedPeriod);
  const periodWhere = getAdminDashboardPeriodWhere(period);
  const lowStockWhere = buildAdminLowStockSkuWhere(await getLowStockThreshold());
  const threshold = lowStockWhere.stockQuantity.lt;

  const [orderGroups, totalCustomers, lowStockCount, outOfStockCount, lowStockSkus, recentOrders, activity, recentProducts, settings] = await Promise.all([
    prisma.order.groupBy({
      by: ["status", "currency"],
      where: periodWhere,
      _count: { _all: true },
      _sum: { total: true },
    }),
    prisma.customer.count(),
    prisma.productSku.count({
      where: lowStockWhere,
    }),
    prisma.productSku.count({
      where: { isActive: true, stockQuantity: 0, product: { status: "ACTIVE" } },
    }),
    prisma.productSku.findMany({
      where: lowStockWhere,
      orderBy: [{ stockQuantity: "asc" }, { updatedAt: "desc" }],
      take: 6,
      select: { id: true, stockQuantity: true, variantOptions: true, product: { select: { id: true, slug: true, translations: { where: { locale: "AR" }, take: 1, select: { name: true } } } } },
    }),
    prisma.order.findMany({
      where: periodWhere,
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, orderNumber: true, contactName: true, status: true, total: true, currency: true, createdAt: true },
    }),
    prisma.adminAuditLog.findMany({
      where: periodWhere,
      orderBy: { createdAt: "desc" },
      take: 7,
      select: { action: true, createdAt: true, actor: { select: { name: true } } },
    }),
    prisma.product.findMany({
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        slug: true,
        status: true,
        translations: { where: { locale: "AR" }, take: 1, select: { name: true } },
        skus: { where: { isDefault: true }, take: 1, select: { price: true, stockQuantity: true } },
        category: { select: { translations: { where: { locale: "AR" }, take: 1, select: { name: true } } } },
      },
    }),
    prisma.storeSettings.findUnique({ where: { id: "singleton" }, select: { storeName: true } }),
  ]);

  const summary = summarizeAdminOrderGroups(orderGroups);
  const orderValue = summary.totals.filter((entry) => entry.orderValue !== "0.00");
  const deliveredValue = summary.totals.filter((entry) => entry.deliveredValue !== "0.00");
  const periodLabels = { "24h": messages.ar.last24Hours, "7d": messages.ar.last7Days, "30d": messages.ar.last30Days, all: messages.ar.allTime };
  const formatDate = (date: Date) => new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(date);
  const actionLabel = (action: string) => messages.ar[adminAuditActionMessageKey(action) as keyof typeof messages.ar] ?? messages.ar.activityGeneric;

  const stats = [
    { label: messages.ar.totalOrders, value: summary.orderCount },
    { label: messages.ar.pendingOrders, value: summary.counts.PENDING },
    { label: messages.ar.processingOrders, value: summary.counts.PROCESSING },
    { label: messages.ar.deliveredOrders, value: summary.counts.DELIVERED },
    { label: messages.ar.allCustomers, value: totalCustomers, hint: totalCustomers === 0 ? messages.ar.noCustomersYet : undefined },
    { label: messages.ar.lowStockSkus, value: lowStockCount, variant: "warning" },
    { label: messages.ar.outOfStockSkus, value: outOfStockCount, variant: "error" },
  ];

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div><h1>{messages.ar.overview}</h1><p>{settings?.storeName ?? messages.ar.brand} · {messages.ar.dashboardPeriodHint}</p></div>
        <div className="admin-page__actions">
          <Link className="ui-button ui-button--outline" href="/admin/orders">{messages.ar.allOrders}</Link>
          <Link className="ui-button ui-button--primary" href="/admin/products/new">{messages.ar.addProduct}</Link>
        </div>
      </header>

      <form className="admin-toolbar admin-period-filter" method="get">
        <Select defaultValue={period} label={messages.ar.dashboardPeriod} name="period">
          {periodOptions.map((value) => <option key={value} value={value}>{periodLabels[value]}</option>)}
        </Select>
        <button className="ui-button ui-button--outline" type="submit">{messages.ar.applyPeriod}</button>
      </form>

      <section className="admin-stats" aria-label={messages.ar.overview}>
        {stats.map((stat) => (
          <Card className={`admin-stat${stat.variant ? ` admin-stat--${stat.variant}` : ""}`} key={stat.label}>
            <span>{stat.label}</span><strong>{stat.value}</strong>{stat.hint && <small>{stat.hint}</small>}
          </Card>
        ))}
      </section>
      <p className="text-sm text-muted">{messages.ar.lowStockHint.replace("{threshold}", String(threshold))}</p>

      <section className="admin-dashboard-grid" aria-label={messages.ar.orders}>
        <Card className="admin-dashboard-panel">
          <div className="admin-section__heading"><h2>{messages.ar.orderValue}</h2><span>{periodLabels[period]}</span></div>
          <p className="text-sm text-muted">{messages.ar.orderValueDisclosure}</p>
          {orderValue.length ? <ul className="admin-value-list">{orderValue.map((entry) => <li dir="ltr" key={entry.currency}>{formatMoney(entry.orderValue, entry.currency)}</li>)}</ul> : <p>{messages.ar.noRecentOrders}</p>}
        </Card>
        <Card className="admin-dashboard-panel">
          <div className="admin-section__heading"><h2>{messages.ar.deliveredOrderValue}</h2><span>{periodLabels[period]}</span></div>
          <p className="text-sm text-muted">{messages.ar.deliveredValueDisclosure}</p>
          {deliveredValue.length ? <ul className="admin-value-list">{deliveredValue.map((entry) => <li dir="ltr" key={entry.currency}>{formatMoney(entry.deliveredValue, entry.currency)}</li>)}</ul> : <p>{messages.ar.noDeliveredOrders}</p>}
        </Card>
      </section>

      <section className="admin-section" aria-labelledby="order-status-title">
        <div className="admin-section__heading"><h2 id="order-status-title">{messages.ar.statusBreakdown}</h2><span>{periodLabels[period]}</span></div>
        <div className="admin-status-grid">{orderStatuses.map((status) => <Card className="admin-status-card" key={status}><span>{orderStatusLabel(status)}</span><strong>{summary.counts[status] ?? 0}</strong></Card>)}</div>
      </section>

      <section className="admin-section" aria-labelledby="recent-orders-title">
        <div className="admin-section__heading"><h2 id="recent-orders-title">{messages.ar.recentOrders}</h2><Link href="/admin/orders">{messages.ar.allOrders} ←</Link></div>
        {recentOrders.length ? <div className="ui-table-wrap"><table className="ui-table">
          <thead><tr><th>{messages.ar.orderNumber}</th><th>{messages.ar.customer}</th><th>{messages.ar.total}</th><th>{messages.ar.status}</th><th>{messages.ar.orderDate}</th><th>{messages.ar.actions}</th></tr></thead>
          <tbody>{recentOrders.map((order) => <tr key={order.id}>
            <td dir="ltr">{order.orderNumber}</td><td>{order.contactName}</td><td dir="ltr">{formatMoney(order.total, order.currency)}</td>
            <td><Badge>{orderStatusLabel(order.status)}</Badge></td><td>{formatDate(order.createdAt)}</td>
            <td><Link href={getAdminOrderDetailHref(order.id)}>{messages.ar.details}</Link></td>
          </tr>)}</tbody>
        </table></div> : <EmptyState title={messages.ar.noRecentOrders} description={periodLabels[period]} action={<Link className="ui-button ui-button--outline" href="/admin/orders">{messages.ar.allOrders}</Link>} />}
      </section>

      <section className="admin-section" aria-labelledby="low-stock-title">
        <div className="admin-section__heading"><h2 id="low-stock-title">{messages.ar.lowStockSkusTitle}</h2><Link href="/admin/inventory">{messages.ar.inventory} ←</Link></div>
        {lowStockSkus.length ? <div className="ui-table-wrap"><table className="ui-table">
          <thead><tr><th>{messages.ar.productName}</th><th>{messages.ar.variant}</th><th>{messages.ar.stock}</th></tr></thead>
          <tbody>{lowStockSkus.map((sku) => <tr key={sku.id}>
            <td><Link href={`/admin/products/${encodeURIComponent(sku.product.id)}`}>{sku.product.translations[0]?.name ?? sku.product.slug}</Link></td>
            <td>{displayVariantOptions(sku.variantOptions) || messages.ar.noVariant}</td><td><Badge variant="warning">{sku.stockQuantity}</Badge></td>
          </tr>)}</tbody>
        </table></div> : <EmptyState title={messages.ar.noLowStockSkus} description={messages.ar.lowStockHint.replace("{threshold}", String(threshold))} action={<Link className="ui-button ui-button--outline" href="/admin/inventory">{messages.ar.inventory}</Link>} />}
      </section>

      <section className="admin-section" aria-labelledby="recent-activity-title">
        <div className="admin-section__heading"><h2 id="recent-activity-title">{messages.ar.recentActivity}</h2><span>{periodLabels[period]}</span></div>
        {activity.length ? <ol className="admin-activity-list">{activity.map((event, index) => <li key={`${event.createdAt.toISOString()}-${index}`}>
          <span className="admin-activity-list__event">{actionLabel(event.action)}</span><span className="admin-activity-list__actor">{event.actor?.name ?? messages.ar.activityActorFallback}</span><time dateTime={event.createdAt.toISOString()}>{formatDate(event.createdAt)}</time>
        </li>)}</ol> : <EmptyState title={messages.ar.noRecentActivity} description={periodLabels[period]} />}
      </section>

      <section className="admin-section" aria-labelledby="recent-products-title">
        <div className="admin-section__heading"><h2 id="recent-products-title">{messages.ar.recentProducts}</h2><Link href="/admin/products">{messages.ar.allProducts} ←</Link></div>
        {recentProducts.length ? <div className="ui-table-wrap"><table className="ui-table">
          <thead><tr><th>{messages.ar.name}</th><th>{messages.ar.category}</th><th>{messages.ar.price}</th><th>{messages.ar.stock}</th><th>{messages.ar.status}</th></tr></thead>
          <tbody>{recentProducts.map((product) => <tr key={product.id}>
            <td><Link href={`/admin/products/${encodeURIComponent(product.id)}`}>{product.translations[0]?.name ?? product.slug}</Link></td>
            <td>{product.category?.translations[0]?.name ?? messages.ar.noCategory}</td><td dir="ltr">{product.skus[0]?.price.toString() ?? "—"}</td><td>{product.skus[0]?.stockQuantity ?? "—"}</td>
            <td><Badge variant={product.status === "ACTIVE" ? "success" : product.status === "ARCHIVED" ? "warning" : "info"}>{product.status === "ACTIVE" ? messages.ar.active : product.status === "ARCHIVED" ? messages.ar.archived : messages.ar.draft}</Badge></td>
          </tr>)}</tbody>
        </table></div> : <EmptyState title={messages.ar.noProducts} description={messages.ar.manageCatalog} action={<Link className="ui-button ui-button--primary" href="/admin/products/new">{messages.ar.addProduct}</Link>} />}
      </section>

      <section className="admin-dashboard-quick-actions" aria-label={messages.ar.quickActions}>
        <Link className="ui-button ui-button--outline" href="/admin/inventory">{messages.ar.inventory}</Link>
        <Link className="ui-button ui-button--outline" href="/admin/categories">{messages.ar.categories}</Link>
      </section>
    </div>
  );
}
