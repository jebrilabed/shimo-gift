import Link from "next/link";
import { Badge, Card, EmptyState, Input, Select } from "@/components/ui";
import { AdminProductThumbnail } from "@/components/admin/admin-product-thumbnail";
import { InventoryQuantityForm } from "@/components/admin/inventory-quantity-form";
import { adminMessages as messages } from "@/lib/admin/messages";
import { ADMIN_PAGE_SIZE } from "@/lib/admin/config";
import { getLowStockThreshold } from "@/lib/admin/inventory";
import { requireAdminPage } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { getStoreCurrency } from "@/lib/storefront/orders";
import { displayVariantOptions, formatMoney } from "@/lib/storefront/format";

type InventoryPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };
function one(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  await requireAdminPage();
  const params = await searchParams;
  const query = (one(params.q) ?? "").trim().slice(0, 100);
  const filter = ["low", "out"].includes(one(params.stock) ?? "") ? one(params.stock) : "";
  const pageNumber = Number.parseInt(one(params.page) ?? "1", 10);
  const page = Number.isInteger(pageNumber) && pageNumber > 0 ? pageNumber : 1;
  const threshold = await getLowStockThreshold();
  const where = {
    ...(filter === "out" ? { stockQuantity: 0 } : filter === "low" ? { stockQuantity: { gt: 0, lt: threshold } } : {}),
    ...(query ? {
      product: { translations: { some: { locale: "AR" as const, name: { contains: query, mode: "insensitive" as const } } } },
    } : {}),
  };
  const [total, skus, currency] = await Promise.all([
    prisma.productSku.count({ where }),
    prisma.productSku.findMany({
      where,
      orderBy: [{ stockQuantity: "asc" }, { updatedAt: "desc" }],
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      select: {
        id: true,
        productId: true,
        price: true,
        stockQuantity: true,
        isDefault: true,
        variantOptions: true,
        product: {
          select: {
            id: true,
            slug: true,
            translations: { where: { locale: "AR" }, take: 1 },
            images: { orderBy: { sortOrder: "asc" }, take: 1 },
          },
        },
      },
    }),
    getStoreCurrency(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const pageHref = (target: number) => `/admin/inventory?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(filter ? { stock: filter } : {}), ...(target > 1 ? { page: String(target) } : {}) })}`;

  return <div className="admin-page">
    <header className="admin-page__header"><div><h1>{messages.ar.inventory}</h1><p>{messages.ar.lowStockHint.replace("{threshold}", String(threshold))}</p></div><Link className="ui-button ui-button--outline" href="/admin/products">{messages.ar.products}</Link></header>
    <Card><form className="admin-toolbar" method="get">
      <Input name="q" type="search" label={messages.ar.search} defaultValue={query} />
      <Select name="stock" label={messages.ar.stockFilter} defaultValue={filter}><option value="">{messages.ar.stockAll}</option><option value="low">{messages.ar.stockLow}</option><option value="out">{messages.ar.stockOut}</option></Select>
      <button className="ui-button ui-button--outline" type="submit">{messages.ar.applyFilter}</button>
    </form></Card>
    {skus.length ? <>
      <div className="ui-table-wrap admin-inventory-table-wrap"><table className="ui-table admin-inventory-table">
        <thead><tr><th>{messages.ar.primaryImage}</th><th>{messages.ar.productName}</th><th>{messages.ar.price}</th><th>{messages.ar.stock}</th><th>{messages.ar.status}</th><th>{messages.ar.updateStock}</th></tr></thead>
        <tbody>{skus.map((sku) => {
          const product = sku.product;
          const name = product.translations[0]?.name ?? product.slug;
          const stockLabel = sku.stockQuantity === 0 ? messages.ar.outOfStock : sku.stockQuantity < threshold ? messages.ar.lowStock : messages.ar.inStock;
          const variant = sku.stockQuantity === 0 ? "error" : sku.stockQuantity < threshold ? "warning" : "success";
          return <tr key={sku.id}>
            <td className="admin-product-image-cell" data-label={messages.ar.primaryImage}><span className="admin-product-thumb">{product.images[0]?.url ? <AdminProductThumbnail src={product.images[0].url} alt={product.images[0].altText ?? messages.ar.imageAlt} width={52} height={52} /> : messages.ar.noImage}</span></td>
            <td data-label={messages.ar.productName}><span className="admin-product-name"><Link href={`/admin/products/${product.id}`}>{name}</Link>{displayVariantOptions(sku.variantOptions) && <small>{displayVariantOptions(sku.variantOptions)}</small>}</span></td>
            <td data-label={messages.ar.price}>{currency ? formatMoney(sku.price, currency) : "—"}</td><td data-label={messages.ar.stock}>{sku.stockQuantity}</td><td data-label={messages.ar.status}><Badge variant={variant}>{stockLabel}</Badge></td>
            <td data-label={messages.ar.updateStock}><InventoryQuantityForm skuId={sku.id} productId={product.id} quantity={sku.stockQuantity} /></td>
          </tr>;
        })}</tbody>
      </table></div>
      <div className="admin-pagination"><p>{messages.ar.page.replace("{page}", String(page)).replace("{pages}", String(totalPages))}</p><div className="admin-pagination__links">{page > 1 && <Link href={pageHref(page - 1)}>→ {messages.ar.previous}</Link>}{page < totalPages && <Link href={pageHref(page + 1)}>{messages.ar.next} ←</Link>}</div></div>
    </> : <EmptyState title={query ? messages.ar.noSearchResults : messages.ar.noInventory} description={messages.ar.manageCatalog} action={<Link className="ui-button ui-button--primary" href="/admin/products/new">{messages.ar.addProduct}</Link>} />}
  </div>;
}
