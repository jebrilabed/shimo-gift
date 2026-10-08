import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge, Card, Container } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { addressParts, displayVariantOptions, formatMoney } from "@/lib/storefront/format";
import { orderStatusLabel, paymentStatusLabel } from "@/lib/storefront/order-labels";
import { storefrontMessages as messages } from "@/lib/storefront/messages";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function MyOrderDetails({ params }: { params: Promise<{ orderNumber: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/ar/login");
  const { orderNumber } = await params;
  const order = await prisma.order.findFirst({
    where: { orderNumber, userId: user.id },
    select: {
      orderNumber: true,
      status: true,
      paymentStatus: true,
      createdAt: true,
      subtotal: true,
      shippingCost: true,
      total: true,
      currency: true,
      shippingAddress: true,
      items: { orderBy: { createdAt: "asc" }, select: { id: true, productNameSnapshot: true, variantSnapshot: true, unitPrice: true, quantity: true, subtotal: true } },
    },
  });
  if (!order) notFound();
  const shippingAddress = addressParts(order.shippingAddress);

  return (
    <main className="store-main">
      <Container width="reading">
        <Link href="/ar/orders">{messages.ar.backToOrders}</Link>
        <Card className="store-order-confirmation">
          <header className="store-page-heading"><h1>{order.orderNumber}</h1><p>{messages.ar.orderDate}: {new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(order.createdAt)}</p></header>
          <p>{messages.ar.orderStatus}: <Badge>{orderStatusLabel(order.status)}</Badge></p>
          <p>{messages.ar.paymentStatus}: {paymentStatusLabel(order.paymentStatus)}</p>
          {shippingAddress.address && <p>{messages.ar.addressInfo}: {shippingAddress.address}{shippingAddress.city ? `، ${shippingAddress.city}` : ""}</p>}
          <h2>{messages.ar.orderedItems}</h2>
          <div className="store-order-items-table-wrap" role="region" aria-label={messages.ar.orderedItems} tabIndex={0}>
            <table className="store-order-items-table">
              <thead><tr><th>{messages.ar.product}</th><th>{messages.ar.price}</th><th>{messages.ar.quantity}</th><th>{messages.ar.lineTotal}</th></tr></thead>
              <tbody>{order.items.map((item) => <tr key={item.id}>
                <td>{item.productNameSnapshot}{displayVariantOptions(item.variantSnapshot) && <small>{displayVariantOptions(item.variantSnapshot)}</small>}</td>
                <td>{formatMoney(item.unitPrice, order.currency)}</td>
                <td>{item.quantity}</td>
                <td>{formatMoney(item.subtotal, order.currency)}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <p className="store-summary__row"><span>{messages.ar.subtotal}</span><strong>{formatMoney(order.subtotal, order.currency)}</strong></p>
          <p className="store-summary__row"><span>{messages.ar.shippingCost}</span><strong>{formatMoney(order.shippingCost, order.currency)}</strong></p>
          <p className="store-summary__row"><span>{messages.ar.total}</span><strong>{formatMoney(order.total, order.currency)}</strong></p>
        </Card>
      </Container>
    </main>
  );
}
import type { Metadata } from "next";
