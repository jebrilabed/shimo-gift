import Link from "next/link";
import { Badge, Card, EmptyState, Input } from "@/components/ui";
import { requireAdminPage } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";

export default async function AdminFaqList({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdminPage();
  const { q = "" } = await searchParams;
  const query = q.trim().slice(0, 100);
  const faqs = await prisma.fAQ.findMany({
    where: query ? { translations: { some: { locale: "AR", OR: [{ question: { contains: query, mode: "insensitive" } }, { answer: { contains: query, mode: "insensitive" } }] } } } : {},
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], include: { translations: { where: { locale: "AR" }, take: 1 } },
  });
  return <div className="admin-page">
    <header className="admin-page__header"><div><h1>الأسئلة الشائعة</h1><p>تظهر الأسئلة النشطة فقط في صفحة المتجر ويستخدمها مساعد AI.</p></div><Link className="ui-button ui-button--primary" href="/admin/content/faq/new">إضافة سؤال</Link></header>
    <Card><form className="admin-toolbar" method="get"><Input label="ابحث في الأسئلة والإجابات" name="q" type="search" defaultValue={query} /><button className="ui-button ui-button--outline" type="submit">بحث</button></form></Card>
    {faqs.length ? <div className="ui-table-wrap"><table className="ui-table"><thead><tr><th>السؤال</th><th>الترتيب</th><th>الحالة</th><th>الإجراء</th></tr></thead><tbody>
      {faqs.map((faq) => <tr key={faq.id}><td>{faq.translations[0]?.question ?? "لا توجد ترجمة عربية"}</td><td>{faq.sortOrder}</td><td><Badge variant={faq.isActive && faq.translations.length ? "success" : "warning"}>{faq.isActive && faq.translations.length ? "منشور" : "مسودة"}</Badge></td><td><Link className="ui-button ui-button--ghost ui-button--small" href={`/admin/content/faq/${faq.id}`}>تعديل</Link></td></tr>)}
    </tbody></table></div> : <EmptyState title="لا توجد أسئلة شائعة" description="أضف الأسئلة التي يحتاج إليها عملاء المتجر." action={<Link className="ui-button ui-button--primary" href="/admin/content/faq/new">إضافة سؤال</Link>} />}
  </div>;
}
