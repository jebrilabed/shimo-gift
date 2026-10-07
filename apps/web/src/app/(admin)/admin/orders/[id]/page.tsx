import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdminPage } from "@/lib/auth/authorization";
import { Badge, Card, Container, Select } from "@/components/ui";
import { StorefrontSubmitButton } from "@/components/storefront/submit-button";
import { OrderStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { allowedOrderTransitions } from "@/lib/storefront/order-workflow.mjs";
import { addressParts, formatMoney } from "@/lib/storefront/format";
import { orderStatusLabel, paymentStatusLabel } from "@/lib/storefront/order-labels";
import { storefrontMessages as messages } from "@/lib/storefront/messages";
import { updateOrderStatusAction } from "../actions";

export default async function AdminOrderDetails({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  await requireAdminPage();
  const [{ id }, { notice }] = await Promise.all([params, searchParams]);
  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentStatus: true,
      contactName: true,
      contactEmail: true,
      contactPhone: true,
      shippingAddress: true,
      customerNote: true,
      currency: true,
      subtotal: true,
      shippingCost: true,
      total: true,
      createdAt: true,
      updatedAt: true,
      items: { orderBy: { createdAt: "asc" }, select: { id: true, productNameSnapshot: true, variantSnapshot: true, unitPrice: true, quantity: true, subtotal: true } },
    },
  });
  if (!order) notFound();
  const address = addressParts(order.shippingAddress);
  const availableTransitions = allowedOrderTransitions(order.status);

  return (
    <Container className="admin-content">
      <header className="admin-page-header"><div><p className="admin-eyebrow">{messages.ar.adminOrders}</p><h1 dir="ltr">{order.orderNumber}</h1><p><Badge>{orderStatusLabel(order.status)}</Badge></p></div><Link href="/admin/orders">{messages.ar.backToAdminOrders}</Link></header>
      {notice === "updated" && <p className="store-alert store-alert--success" role="status">{messages.ar.statusUpdated}</p>}
      {notice && notice !== "updated" && <p className="store-alert store-alert--error" role="alert">{notice === "transition" ? messages.ar.invalidTransition : notice === "missingSku" ? messages.ar.missingSkuRestore : notice === "alreadyCancelled" ? messages.ar.alreadyCancelled : notice === "restockUnavailable" ? messages.ar.restockUnavailable : notice === "notFound" ? messages.ar.orderNotFound : messages.ar.databaseUnavailable}</p>}
      <div className="store-admin-order-info">
        <Card><h2>{messages.ar.customer}</h2><p>{order.contactName}</p><p dir="ltr">{order.contactPhone}</p>{order.contactEmail && <p dir="ltr">{order.contactEmail}</p>}</Card>
        <Card><h2>{messages.ar.addressInfo}</h2><p>{address.address}</p><p>{address.city}</p></Card>
        <Card><h2>{messages.ar.adminOrderDetails}</h2><p>{messages.ar.orderDate}: {new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(order.createdAt)}</p><p>{messages.ar.orderDateUpdated}: {new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(order.updatedAt)}</p><p>{messages.ar.orderStatus}: {orderStatusLabel(order.status)}</p><p>{messages.ar.paymentStatus}: {paymentStatusLabel(order.paymentStatus)}</p></Card>
        <Card><h2>{messages.ar.customerNote}</h2><p>{order.customerNote || messages.ar.noNotes}</p></Card>
      </div>
      <Card className="store-order-items-card">
        <h2>{messages.ar.orderedItems}</h2>
        <div className="store-table-wrap"><table className="store-table"><thead><tr><th>{messages.ar.product}</th><th>{messages.ar.quantity}</th><th>{messages.ar.price}</th><th>{messages.ar.lineTotal}</th></tr></thead><tbody>
          {order.items.map((item) => <tr key={item.id}><td>{item.productNameSnapshot}{typeof item.variantSnapshot === "object" && item.variantSnapshot && !Array.isArray(item.variantSnapshot) ? <small>{Object.entries(item.variantSnapshot).map(([key, value]) => `${key}: ${String(value)}`).join(" · ")}</small> : null}</td><td>{item.quantity}</td><td>{formatMoney(item.unitPrice, order.currency)}</td><td>{formatMoney(item.subtotal, order.currency)}</td></tr>)}
        </tbody></table></div>
        <p className="store-summary__row"><span>{messages.ar.subtotal}</span><strong>{formatMoney(order.subtotal, order.currency)}</strong></p>
        <p className="store-summary__row"><span>{messages.ar.shippingCost}</span><strong>{formatMoney(order.shippingCost, order.currency)}</strong></p>
        <p className="store-summary__row"><span>{messages.ar.total}</span><strong>{formatMoney(order.total, order.currency)}</strong></p>
      </Card>
      {availableTransitions.length > 0 ? (
        <Card>
          <h2>{messages.ar.updateStatus}</h2>
          <form action={updateOrderStatusAction} className="store-form--inline">
            <input name="orderId" type="hidden" value={order.id} />
            <Select label={messages.ar.status} name="status" required><option disabled value="">{messages.ar.nextStatus}</option>{availableTransitions.map((status) => <option key={status} value={status}>{orderStatusLabel(status as OrderStatus)}</option>)}</Select>
            <StorefrontSubmitButton pendingText={messages.ar.saving}>{messages.ar.updateStatus}</StorefrontSubmitButton>
          </form>
        </Card>
      ) : <p className="store-muted">{messages.ar.noStatusChanges}</p>}
    </Container>
  );
}
