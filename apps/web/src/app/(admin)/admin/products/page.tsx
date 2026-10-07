import Link from "next/link";
import { Badge, Card, EmptyState, Input, Select } from "@/components/ui";
import { ActionForm } from "@/components/admin/action-form";
import { AdminProductThumbnail } from "@/components/admin/admin-product-thumbnail";
import { adminMessages as messages } from "@/lib/admin/messages";
import { ADMIN_PAGE_SIZE } from "@/lib/admin/config";
import { archiveProduct, toggleProductStatus } from "../actions";
import { requireAdminPage } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";

type ProductsPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function pageLink(page: number, query: string, status: string) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (status) params.set("status", status);
  if (page > 1) params.set("page", String(page));
  return `/admin/products${params.size ? `?${params}` : ""}`;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  await requireAdminPage();
  const params = await searchParams;
  const query = (one(params.q) ?? "").trim().slice(0, 100);
  const statusInput = one(params.status) ?? "";
  const status = ["ACTIVE", "DRAFT", "ARCHIVED"].includes(statusInput) ? statusInput : "";
  const pageInput = Number.parseInt(one(params.page) ?? "1", 10);
  const page = Number.isInteger(pageInput) && pageInput > 0 ? pageInput : 1;
  const where = {
    ...(status ? { status: status as "ACTIVE" | "DRAFT" | "ARCHIVED" } : {}),
    ...(query ? { translations: { some: { locale: "AR" as const, name: { contains: query, mode: "insensitive" as const } } } } : {}),
  };
  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      include: {
        translations: { where: { locale: "AR" }, take: 1 },
        category: { include: { translations: { where: { locale: "AR" }, take: 1 } } },
        skus: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }], take: 1, select: { price: true, stockQuantity: true } },
        images: { orderBy: { sortOrder: "asc" }, take: 1 },
      },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div><h1>{messages.ar.products}</h1><p>{total} {messages.ar.products}</p></div>
        <div className="admin-page__actions"><Link className="ui-button ui-button--primary" href="/admin/products/new">{messages.ar.addProduct}</Link></div>
      </header>
      <Card>
        <form className="admin-toolbar" method="get">
          <Input name="q" type="search" label={messages.ar.search} defaultValue={query} />
          <Select name="status" label={messages.ar.statusFilter} defaultValue={status}>
            <option value="">{messages.ar.all}</option>
            <option value="ACTIVE">{messages.ar.active}</option>
            <option value="DRAFT">{messages.ar.draft}</option>
            <option value="ARCHIVED">{messages.ar.archived}</option>
          </Select>
          <button className="ui-button ui-button--outline" type="submit">{messages.ar.applyFilter}</button>
        </form>
      </Card>
      {products.length ? (
        <>
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead><tr><th>{messages.ar.primaryImage}</th><th>{messages.ar.category}</th><th>{messages.ar.price}</th><th>{messages.ar.stock}</th><th>{messages.ar.status}</th><th>{messages.ar.updated}</th><th>{messages.ar.actions}</th></tr></thead>
              <tbody>
                {products.map((product) => {
                  const sku = product.skus[0];
                  const statusLabel = product.status === "ACTIVE" ? messages.ar.active : product.status === "ARCHIVED" ? messages.ar.archived : messages.ar.draft;
                  return (
                    <tr key={product.id}>
                      <td><div className="admin-product-cell"><span className="admin-product-thumb">{product.images[0]?.url ? <AdminProductThumbnail src={product.images[0].url} alt={product.images[0].altText ?? messages.ar.imageAlt} width={52} height={52} /> : messages.ar.noImage}</span><span className="admin-product-name"><Link href={`/admin/products/${product.id}`}>{product.translations[0]?.name ?? product.slug}</Link><small dir="ltr">{product.slug}</small></span></div></td>
                      <td>{product.category?.translations[0]?.name ?? messages.ar.noCategory}</td>
                      <td>{sku?.price.toString() ?? "—"}</td>
                      <td>{sku?.stockQuantity ?? "—"}</td>
                      <td><Badge variant={product.status === "ACTIVE" ? "success" : product.status === "ARCHIVED" ? "warning" : "info"}>{statusLabel}</Badge></td>
                      <td>{new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium" }).format(product.updatedAt)}</td>
                      <td><div className="admin-row-actions">
                        <Link className="ui-button ui-button--ghost ui-button--small" href={`/admin/products/${product.id}`}>{messages.ar.edit}</Link>
                        <ActionForm action={toggleProductStatus} fields={{ productId: product.id }} label={product.status === "ACTIVE" ? messages.ar.deactivate : messages.ar.activate} />
                        {product.status !== "ARCHIVED" && <ActionForm action={archiveProduct} fields={{ productId: product.id }} label={messages.ar.archive} confirmMessage={messages.ar.archiveConfirm} variant="ghost" />}
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="admin-pagination"><p>{messages.ar.page.replace("{page}", String(page)).replace("{pages}", String(totalPages))}</p><div className="admin-pagination__links">
            {page > 1 && <Link href={pageLink(page - 1, query, status)}>→ {messages.ar.previous}</Link>}
            {page < totalPages && <Link href={pageLink(page + 1, query, status)}>{messages.ar.next} ←</Link>}
          </div></div>
        </>
      ) : <EmptyState title={query ? messages.ar.noSearchResults : messages.ar.noProducts} description={messages.ar.manageCatalog} action={<Link className="ui-button ui-button--primary" href="/admin/products/new">{messages.ar.addProduct}</Link>} />}
    </div>
  );
}
