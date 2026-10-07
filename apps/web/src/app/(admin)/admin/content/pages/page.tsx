import Link from "next/link";
import { Badge, Card, EmptyState, Input } from "@/components/ui";
import { requireAdminPage } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";

export default async function ContentPagesList({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdminPage();
  const { q = "" } = await searchParams;
  const query = q.trim().slice(0, 100);
  const pages = await prisma.contentPage.findMany({
    where: query ? {
      OR: [
        { pageKey: { contains: query, mode: "insensitive" } },
        { translations: { some: { locale: "AR", OR: [
          { title: { contains: query, mode: "insensitive" } },
          { slug: { contains: query, mode: "insensitive" } },
        ] } } },
      ],
    } : {},
    orderBy: [{ pageKey: "asc" }, { createdAt: "desc" }],
    include: { translations: { where: { locale: "AR" }, take: 1 } },
  });
  return <div className="admin-page">
    <header className="admin-page__header"><div><h1>صفحات المتجر</h1><p>الصفحات العامة والمحتوى التعريفي والسياسات.</p></div><Link className="ui-button ui-button--primary" href="/admin/content/pages/new">إضافة صفحة</Link></header>
    <Card><form className="admin-toolbar" method="get"><Input label="ابحث بالعنوان أو الرابط أو المفتاح" name="q" type="search" defaultValue={query} /><button className="ui-button ui-button--outline" type="submit">بحث</button></form></Card>
    {pages.length ? <div className="ui-table-wrap"><table className="ui-table"><thead><tr><th>العنوان</th><th>مفتاح الصفحة</th><th>الرابط</th><th>الحالة</th><th>الإجراء</th></tr></thead><tbody>
      {pages.map((page) => { const translation = page.translations[0]; return <tr key={page.id}>
        <td>{translation?.title ?? page.pageKey}</td><td dir="ltr">{page.pageKey}</td><td dir="ltr">{translation ? `/ar/${translation.slug}` : "لا توجد ترجمة عربية"}</td>
        <td><Badge variant={page.isActive && translation ? "success" : "warning"}>{page.isActive && translation ? "منشورة" : "مسودة"}</Badge></td>
        <td><Link className="ui-button ui-button--ghost ui-button--small" href={`/admin/content/pages/${page.id}`}>تعديل</Link></td>
      </tr>; })}
    </tbody></table></div> : <EmptyState title="لا توجد صفحات بعد" description="أنشئ صفحات السياسات ومعلومات المتجر من المحتوى الحالي." action={<Link className="ui-button ui-button--primary" href="/admin/content/pages/new">إضافة صفحة</Link>} />}
  </div>;
}
