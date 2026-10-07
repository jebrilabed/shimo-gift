import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, Card, Container } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { STOREFRONT_PAGE_SIZE } from "@/lib/storefront/config";
import { formatMoney } from "@/lib/storefront/format";
import { orderStatusLabel } from "@/lib/storefront/order-labels";
import { storefrontMessages as messages } from "@/lib/storefront/messages";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function MyOrdersPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/ar/login");
  const { page: pageString } = await searchParams;
  const requestedPage = Number(pageString ?? 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * STOREFRONT_PAGE_SIZE,
      take: STOREFRONT_PAGE_SIZE,
      select: { orderNumber: true, status: true, createdAt: true, total: true, currency: true },
    }),
    prisma.order.count({ where: { userId: user.id } }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / STOREFRONT_PAGE_SIZE));

  return (
    <main className="store-main">
      <Container>
        <header className="store-page-heading"><h1>{messages.ar.myOrders}</h1></header>
        {!orders.length ? (
          <div className="ui-state"><span className="ui-state__symbol" aria-hidden="true">◇</span><h2>{messages.ar.noOrders}</h2><Link href="/ar">{messages.ar.continueShopping}</Link></div>
        ) : (
          <div className="store-order-list">
            {orders.map((order) => (
              <Card className="store-order-card" key={order.orderNumber}>
                <Link href={`/ar/orders/${encodeURIComponent(order.orderNumber)}`}><strong>{order.orderNumber}</strong></Link>
                <span>{new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium" }).format(order.createdAt)}</span>
                <Badge>{orderStatusLabel(order.status)}</Badge>
                <strong>{formatMoney(order.total, order.currency)}</strong>
              </Card>
            ))}
          </div>
        )}
        {pageCount > 1 && <nav aria-label={messages.ar.myOrders} className="store-pagination">{page > 1 ? <Link href={`/ar/orders?page=${page - 1}`}>{messages.ar.previous}</Link> : <span />}{messages.ar.page.replace("{page}", String(page)).replace("{pages}", String(pageCount))}{page < pageCount ? <Link href={`/ar/orders?page=${page + 1}`}>{messages.ar.next}</Link> : <span />}</nav>}
      </Container>
    </main>
  );
}
import type { Metadata } from "next";
