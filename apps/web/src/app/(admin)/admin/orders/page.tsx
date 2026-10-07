import Link from "next/link";
import { requireAdminPage } from "@/lib/auth/authorization";
import { Badge, Button, Container, Input, Select } from "@/components/ui";
import { OrderStatus, PaymentStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { ADMIN_PAGE_SIZE } from "@/lib/admin/config";
import { buildAdminOrderWhere, parseAdminOrderFilters } from "@/lib/admin/order-filters.mjs";
import { orderStatusLabel, paymentStatusLabel } from "@/lib/storefront/order-labels";
import { storefrontMessages as messages } from "@/lib/storefront/messages";
import { formatMoney } from "@/lib/storefront/format";

const statusOptions = Object.values(OrderStatus);
const notices: Record<string, string> = {
  updated: messages.ar.statusUpdated,
  transition: messages.ar.invalidTransition,
  missingSku: messages.ar.missingSkuRestore,
  notFound: messages.ar.orderNotFound,
  denied: messages.ar.denied,
  error: messages.ar.databaseUnavailable,
  invalid: messages.ar.genericError,
  alreadyCancelled: messages.ar.alreadyCancelled,
  restockUnavailable: messages.ar.restockUnavailable,
};

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminPage();
  const params = await searchParams;
  const notice = Array.isArray(params.notice) ? params.notice[0] : params.notice;
  const filters = parseAdminOrderFilters(params, statusOptions, Object.values(PaymentStatus));
  const query = filters.query;
  const status = filters.status as OrderStatus | "";
  const paymentStatus = filters.paymentStatus as PaymentStatus | "";
  const page = filters.page;
  const where = buildAdminOrderWhere(filters);
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      select: { id: true, orderNumber: true, contactName: true, contactPhone: true, status: true, paymentStatus: true, total: true, currency: true, createdAt: true, updatedAt: true },
    }),
    prisma.order.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const urlFor = (nextPage: number) => `/admin/orders?${new URLSearchParams({
    ...(query ? { q: query } : {}),
    ...(status ? { status } : {}),
    ...(paymentStatus ? { paymentStatus } : {}),
    ...(filters.fromValue ? { from: filters.fromValue } : {}),
    ...(filters.toValue ? { to: filters.toValue } : {}),
    page: String(nextPage),
  })}`;

  return (
    <Container className="admin-content">
      <header className="admin-page-header"><div><p className="admin-eyebrow">{messages.ar.admin}</p><h1>{messages.ar.adminOrders}</h1><p>{total} {messages.ar.orderCount}</p></div></header>
      {notice && notices[notice] && <p className={`store-alert ${notice === "updated" ? "store-alert--success" : "store-alert--error"}`} role="status">{notices[notice]}</p>}
      <form className="store-filter-row" method="get">
        <Input defaultValue={query} label={messages.ar.searchOrders} maxLength={120} name="q" type="search" />
        <Select defaultValue={status ?? ""} label={messages.ar.statusFilter} name="status">
          <option value="">{messages.ar.allStatuses}</option>
          {statusOptions.map((value) => <option key={value} value={value}>{orderStatusLabel(value)}</option>)}
        </Select>
        <Select defaultValue={paymentStatus} label={messages.ar.paymentStatusFilter} name="paymentStatus">
          <option value="">{messages.ar.allPaymentStatuses}</option>
          {Object.values(PaymentStatus).map((value) => <option key={value} value={value}>{paymentStatusLabel(value)}</option>)}
        </Select>
        <Input defaultValue={filters.fromValue} label={messages.ar.orderDateFrom} name="from" type="date" />
        <Input defaultValue={filters.toValue} label={messages.ar.orderDateTo} name="to" type="date" />
        <Button type="submit" variant="outline">{messages.ar.applyFilter}</Button>
      </form>
      {filters.dateError && <p className="store-alert store-alert--error" role="alert">{messages.ar.invalidOrderDateRange}</p>}
      {!orders.length ? (
        <div className="ui-state"><span className="ui-state__symbol" aria-hidden="true">▧</span><h2>{messages.ar.noAdminOrders}</h2></div>
      ) : (
        <div className="store-table-wrap">
          <table className="store-table">
            <thead><tr><th>{messages.ar.orderNumber}</th><th>{messages.ar.customer}</th><th>{messages.ar.phone}</th><th>{messages.ar.total}</th><th>{messages.ar.status}</th><th>{messages.ar.paymentStatus}</th><th>{messages.ar.orderDate}</th><th>{messages.ar.orderDateUpdated}</th><th>{messages.ar.actions}</th></tr></thead>
            <tbody>{orders.map((order) => <tr key={order.id}>
              <td dir="ltr">{order.orderNumber}</td><td>{order.contactName}</td><td dir="ltr">{order.contactPhone}</td>
              <td>{formatMoney(order.total, order.currency)}</td><td><Badge>{orderStatusLabel(order.status)}</Badge></td><td><Badge>{paymentStatusLabel(order.paymentStatus)}</Badge></td>
              <td>{new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(order.createdAt)}</td>
              <td>{new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(order.updatedAt)}</td>
              <td><Link href={`/admin/orders/${encodeURIComponent(order.id)}`}>{messages.ar.details}</Link></td>
            </tr>)}</tbody>
          </table>
        </div>
      )}
      {pages > 1 && <nav aria-label={messages.ar.adminOrders} className="ui-pagination">{page > 1 ? <Link href={urlFor(page - 1)}>{messages.ar.previous}</Link> : <span />}{messages.ar.page.replace("{page}", String(page)).replace("{pages}", String(pages))}{page < pages ? <Link href={urlFor(page + 1)}>{messages.ar.next}</Link> : <span />}</nav>}
    </Container>
  );
}
