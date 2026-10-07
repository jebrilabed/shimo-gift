import Link from "next/link";
import { NotificationStatus } from "@/generated/prisma/enums";
import { Badge, Button, Container, Select } from "@/components/ui";
import { adminMessages as messages } from "@/lib/admin/messages";
import { requireAdminPage } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { retryNotificationAction } from "./actions";

const pageSize = 20;
const statusLabels: Record<NotificationStatus, string> = {
  [NotificationStatus.PENDING]: messages.ar.statusPending,
  [NotificationStatus.PROCESSING]: messages.ar.statusProcessing,
  [NotificationStatus.SENT]: messages.ar.statusSent,
  [NotificationStatus.FAILED]: messages.ar.statusFailed,
};
const eventLabels: Record<string, string> = {
  ORDER_CREATED: messages.ar.eventOrderCreated,
  ORDER_CONFIRMED: messages.ar.eventOrderConfirmed,
  ORDER_PROCESSING: messages.ar.eventOrderProcessing,
  ORDER_SHIPPED: messages.ar.eventOrderShipped,
  ORDER_DELIVERED: messages.ar.eventOrderDelivered,
  ORDER_CANCELLED: messages.ar.eventOrderCancelled,
};

export default async function AdminNotificationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminPage();
  const params = await searchParams;
  const rawStatus = Array.isArray(params.status) ? params.status[0] : params.status;
  const status = Object.values(NotificationStatus).includes(rawStatus as NotificationStatus) ? rawStatus as NotificationStatus : "";
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const page = /^\d+$/.test(rawPage ?? "") ? Math.max(1, Math.min(1_000_000, Number(rawPage))) : 1;
  const notice = Array.isArray(params.notice) ? params.notice[0] : params.notice;
  const where = status ? { status } : {};
  const [notifications, total] = await Promise.all([
    prisma.notificationOutbox.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        eventType: true,
        status: true,
        retryCount: true,
        lastAttemptAt: true,
        nextAttemptAt: true,
        errorMessage: true,
        deliveryUnknown: true,
        createdAt: true,
        order: { select: { id: true, orderNumber: true } },
      },
    }),
    prisma.notificationOutbox.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const urlFor = (nextPage: number) => `/admin/notifications?${new URLSearchParams({ ...(status ? { status } : {}), page: String(nextPage) })}`;
  const notices: Record<string, string> = {
    retried: messages.ar.notificationRetryDone,
    config: messages.ar.notificationRetryConfig,
    invalid: messages.ar.notificationRetryInvalid,
    denied: messages.ar.denied,
    error: messages.ar.notificationRetryError,
  };
  const formatDate = (date: Date | null) => date ? new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(date) : "—";

  return <Container className="admin-content">
    <header className="admin-page-header"><div><p className="admin-eyebrow">{messages.ar.admin}</p><h1>{messages.ar.notificationOutboxTitle}</h1><p>{messages.ar.notificationOutboxDescription}</p></div></header>
    {notice && notices[notice] && <p className={`store-alert ${notice === "retried" ? "store-alert--success" : "store-alert--error"}`} role={notice === "retried" ? "status" : "alert"}>{notices[notice]}</p>}
    <form className="store-filter-row" method="get">
      <Select label={messages.ar.notificationStatus} name="status" defaultValue={status}>
        <option value="">{messages.ar.notificationAllStatuses}</option>
        {Object.values(NotificationStatus).map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}
      </Select>
      <Button type="submit" variant="outline">{messages.ar.applyFilter}</Button>
    </form>
    {!notifications.length ? <div className="ui-state"><span className="ui-state__symbol" aria-hidden="true">◉</span><h2>{messages.ar.notificationNoRows}</h2></div> : <div className="store-table-wrap">
      <table className="store-table"><thead><tr>
        <th>{messages.ar.eventType}</th><th>{messages.ar.notificationOrder}</th><th>{messages.ar.notificationStatus}</th><th>{messages.ar.attempts}</th><th>{messages.ar.lastAttempt}</th><th>{messages.ar.notificationCreated}</th><th>{messages.ar.notificationFailure}</th><th>{messages.ar.actions}</th>
      </tr></thead><tbody>{notifications.map((notification) => <tr key={notification.id}>
        <td>{eventLabels[notification.eventType] ?? messages.ar.activityGeneric}</td>
        <td>{notification.order ? <Link href={`/admin/orders/${encodeURIComponent(notification.order.id)}`} dir="ltr">{notification.order.orderNumber}</Link> : messages.ar.notificationNoOrder}</td>
        <td><Badge variant={notification.status === NotificationStatus.SENT ? "success" : notification.status === NotificationStatus.FAILED ? "error" : notification.status === NotificationStatus.PROCESSING ? "info" : "warning"}>{statusLabels[notification.status]}</Badge></td>
        <td>{notification.retryCount}</td><td>{formatDate(notification.lastAttemptAt)}</td><td>{formatDate(notification.createdAt)}</td>
        <td className="admin-notification-error">{notification.deliveryUnknown && <strong>{messages.ar.notificationUnknownDelivery} </strong>}{notification.errorMessage?.slice(0, 240) ?? "—"}{notification.nextAttemptAt && <small>{messages.ar.nextAttempt}: {formatDate(notification.nextAttemptAt)}</small>}</td>
        <td>{notification.status === NotificationStatus.FAILED ? <form action={retryNotificationAction}><input type="hidden" name="notificationId" value={notification.id} /><Button type="submit" variant="outline" size="small">{messages.ar.retryNotification}</Button></form> : "—"}</td>
      </tr>)}</tbody></table>
    </div>}
    {pages > 1 && <nav aria-label={messages.ar.notificationOutboxTitle} className="ui-pagination">{page > 1 ? <Link href={urlFor(page - 1)}>{messages.ar.previous}</Link> : <span />}{messages.ar.notificationPage.replace("{page}", String(page)).replace("{pages}", String(pages))}{page < pages ? <Link href={urlFor(page + 1)}>{messages.ar.next}</Link> : <span />}</nav>}
  </Container>;
}
