import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import { requireAdminPage } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";

export default async function ContentDashboard() {
  await requireAdminPage();
  const [pages, faqs] = await Promise.all([
    prisma.contentPage.count(),
    prisma.fAQ.count(),
  ]);
  return <div className="admin-page">
    <header className="admin-page__header"><div><h1>المحتوى وSEO</h1><p>إدارة الصفحات العامة والأسئلة الشائعة المنشورة للمتجر.</p></div></header>
    <div className="admin-dashboard-grid">
      <Card><h2>صفحات المتجر</h2><p>{pages} صفحة محفوظة</p><p>سياسات الشحن والإرجاع والخصوصية والشروط ومعلومات التواصل.</p><Link className="ui-button ui-button--primary" href="/admin/content/pages">إدارة الصفحات</Link></Card>
      <Card><h2>الأسئلة الشائعة</h2><p>{faqs} سؤالاً محفوظاً</p><p>إدارة إجابات المتجر وترتيبها وحالة نشرها.</p><Link className="ui-button ui-button--primary" href="/admin/content/faq">إدارة الأسئلة</Link></Card>
    </div>
    <Card><h2>الروابط الموصى بها</h2><div className="flex flex-wrap gap-3">{["shipping-policy", "return-policy", "privacy-policy", "terms", "contact"].map((key) => <Link className="ui-button ui-button--outline" href={`/admin/content/pages/new?pageKey=${key}`} key={key}>{key}</Link>)}</div><p className="mt-3 text-sm text-slate-600">أنشئ المحتوى العربي المطلوب وانشره عند مراجعته. الترجمة الإنجليزية اختيارية ولا تُفعّل مسارات /en تلقائياً.</p></Card>
    <Card><h2>حالة اللغات</h2><Badge variant="success">العربية متاحة — /ar</Badge><p className="mt-3">لا توجد مسارات عامة مفعّلة للإنجليزية حالياً.</p></Card>
  </div>;
}
