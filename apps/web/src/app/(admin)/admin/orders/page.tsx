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
import { adminMessages } from "@/lib/admin/messages";
import { DeleteOrderForm } from "@/components/admin/delete-order-form";
import { ToastMessage } from "@/components/ui/toast";

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
  deleted: adminMessages.ar.orderDeleted,
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
    <Container className="admin-page admin-orders-page">
      <header className="admin-page__header admin-orders-header">
        <div>
          <p className="admin-eyebrow">{messages.ar.admin}</p>
          <h1>{messages.ar.adminOrders}</h1>
          <p className="admin-orders-header__count"><strong>{total}</strong> {messages.ar.orderCount}</p>
        </div>
      </header>
      <ToastMessage message={notice ? notices[notice] : undefined} tone={notice === "updated" || notice === "deleted" ? "success" : "error"} />
      <form aria-label={messages.ar.adminOrders} className="admin-orders-filters" method="get">
        <div className="admin-orders-filters__fields">
          <Input className="admin-orders-filters__search" defaultValue={query} label={messages.ar.searchOrders} maxLength={120} name="q" type="search" />
          <Select defaultValue={status} label={messages.ar.statusFilter} name="status">
            <option value="">{messages.ar.allStatuses}</option>
            {statusOptions.map((value) => <option key={value} value={value}>{orderStatusLabel(value)}</option>)}
          </Select>
          <Select defaultValue={paymentStatus} label={messages.ar.paymentStatusFilter} name="paymentStatus">
            <option value="">{messages.ar.allPaymentStatuses}</option>
            {Object.values(PaymentStatus).map((value) => <option key={value} value={value}>{paymentStatusLabel(value)}</option>)}
          </Select>
          <Input defaultValue={filters.fromValue} label={messages.ar.orderDateFrom} name="from" type="date" />
          <Input defaultValue={filters.toValue} label={messages.ar.orderDateTo} name="to" type="date" />
          <div className="admin-orders-filters__actions">
            <Button type="submit">{messages.ar.applyFilter}</Button>
            <Link className="admin-orders-filters__reset" href="/admin/orders">مسح الفلاتر</Link>
          </div>
        </div>
      </form>
      {filters.dateError && <ToastMessage message={messages.ar.invalidOrderDateRange} tone="warning" />}
      {!orders.length ? (
        <div className="ui-state"><span className="ui-state__symbol" aria-hidden="true">▧</span><h2>{messages.ar.noAdminOrders}</h2></div>
      ) : (
        <div aria-label={messages.ar.adminOrders} className="ui-table-wrap admin-orders-table-wrap" role="region" tabIndex={0}>
          <table className="ui-table admin-orders-table">
            <thead><tr><th>{messages.ar.orderNumber}</th><th>{messages.ar.customer}</th><th>{adminMessages.ar.phoneNumber}</th><th>{messages.ar.total}</th><th>{messages.ar.status} / {messages.ar.paymentStatus}</th><th>{messages.ar.orderDate}</th><th>{messages.ar.actions}</th></tr></thead>
            <tbody>{orders.map((order) => <tr key={order.id}>
              <td data-label={messages.ar.orderNumber}><span className="admin-orders-table__order"><Link className="admin-orders-table__number" dir="ltr" href={`/admin/orders/${encodeURIComponent(order.id)}`}>{order.orderNumber}</Link><small>{messages.ar.details}</small></span></td>
              <td data-label={messages.ar.customer}><span className="admin-orders-table__customer"><strong>{order.contactName}</strong></span></td>
              <td data-label={adminMessages.ar.phoneNumber}><span className="admin-orders-table__phone" dir="ltr">{order.contactPhone}</span></td>
              <td data-label={messages.ar.total}><strong className="admin-orders-table__total">{formatMoney(order.total, order.currency)}</strong></td>
              <td data-label={`${messages.ar.status} / ${messages.ar.paymentStatus}`}><span className="admin-orders-table__statuses"><span><small>{messages.ar.status}</small><Badge>{orderStatusLabel(order.status)}</Badge></span><span><small>{messages.ar.paymentStatus}</small><Badge>{paymentStatusLabel(order.paymentStatus)}</Badge></span></span></td>
              <td data-label={messages.ar.orderDate}><span className="admin-orders-table__dates"><time dateTime={order.createdAt.toISOString()}>{new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(order.createdAt)}</time><small>{messages.ar.orderDateUpdated}: {new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(order.updatedAt)}</small></span></td>
              <td data-label={messages.ar.actions}><DeleteOrderForm orderId={order.id} label={adminMessages.ar.deleteOrder} confirmMessage={adminMessages.ar.deleteOrderConfirm} /></td>
            </tr>)}</tbody>
          </table>
        </div>
      )}
      {pages > 1 && <nav aria-label={messages.ar.adminOrders} className="ui-pagination">{page > 1 ? <Link href={urlFor(page - 1)}>{messages.ar.previous}</Link> : <span />}{messages.ar.page.replace("{page}", String(page)).replace("{pages}", String(pages))}{page < pages ? <Link href={urlFor(page + 1)}>{messages.ar.next}</Link> : <span />}</nav>}
    </Container>
  );
}
