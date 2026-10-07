import Link from "next/link";
import { Badge, Card, EmptyState, Input } from "@/components/ui";
import { ActionForm } from "@/components/admin/action-form";
import { adminMessages as messages } from "@/lib/admin/messages";
import { ADMIN_PAGE_SIZE } from "@/lib/admin/config";
import { deleteCategory } from "../actions";
import { requireAdminPage } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";

type CategoriesPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function one(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }

export default async function CategoriesPage({ searchParams }: CategoriesPageProps) {
  await requireAdminPage();
  const params = await searchParams;
  const query = (one(params.q) ?? "").trim().slice(0, 100);
  const pageValue = Number.parseInt(one(params.page) ?? "1", 10);
  const page = Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const where = query ? { translations: { some: { locale: "AR" as const, name: { contains: query, mode: "insensitive" as const } } } } : {};
  const [total, categories] = await Promise.all([
    prisma.category.count({ where }),
    prisma.category.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      include: {
        translations: { where: { locale: "AR" }, take: 1 },
        parent: { include: { translations: { where: { locale: "AR" }, take: 1 } } },
        _count: { select: { products: true, children: true } },
      },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const pageHref = (target: number) => `/admin/categories?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(target > 1 ? { page: String(target) } : {}) })}`;

  return (
    <div className="admin-page">
      <header className="admin-page__header"><div><h1>{messages.ar.categories}</h1><p>{total} {messages.ar.categories}</p></div><Link className="ui-button ui-button--primary" href="/admin/categories/new">{messages.ar.addCategory}</Link></header>
      <Card><form className="admin-toolbar" method="get"><Input name="q" type="search" label={messages.ar.categorySearch} defaultValue={query} /><button className="ui-button ui-button--outline" type="submit">{messages.ar.applyFilter}</button></form></Card>
      {categories.length ? <>
        <div className="ui-table-wrap"><table className="ui-table">
          <thead><tr><th>{messages.ar.name}</th><th>{messages.ar.slug}</th><th>{messages.ar.parent}</th><th>{messages.ar.productCount}</th><th>{messages.ar.status}</th><th>{messages.ar.actions}</th></tr></thead>
          <tbody>{categories.map((category) => {
            const name = category.translations[0]?.name ?? category.slug;
            const blocked = category._count.products > 0 || category._count.children > 0;
            const blockedText = category._count.products > 0 ? messages.ar.categoryHasProducts : messages.ar.categoryHasChildren;
            return <tr key={category.id}>
              <td><Link href={`/admin/categories/${category.id}`}>{name}</Link></td>
              <td dir="ltr">{category.slug}</td>
              <td>{category.parent?.translations[0]?.name ?? messages.ar.noParent}</td>
              <td>{category._count.products}</td>
              <td><Badge variant={category.status === "ACTIVE" ? "success" : "warning"}>{category.status === "ACTIVE" ? messages.ar.active : messages.ar.archived}</Badge></td>
              <td><div className="admin-row-actions"><Link className="ui-button ui-button--ghost ui-button--small" href={`/admin/categories/${category.id}`}>{messages.ar.edit}</Link>
                {blocked ? <span className="admin-field-error">{blockedText}</span> : <ActionForm action={deleteCategory} fields={{ categoryId: category.id }} label={messages.ar.delete} confirmMessage={messages.ar.deleteCategoryConfirm} variant="ghost" />}
              </div></td>
            </tr>;
          })}</tbody>
        </table></div>
        <div className="admin-pagination"><p>{messages.ar.page.replace("{page}", String(page)).replace("{pages}", String(totalPages))}</p><div className="admin-pagination__links">{page > 1 && <Link href={pageHref(page - 1)}>→ {messages.ar.previous}</Link>}{page < totalPages && <Link href={pageHref(page + 1)}>{messages.ar.next} ←</Link>}</div></div>
      </> : <EmptyState title={messages.ar.noCategories} description={messages.ar.manageCatalog} action={<Link className="ui-button ui-button--primary" href="/admin/categories/new">{messages.ar.addCategory}</Link>} />}
    </div>
  );
}
