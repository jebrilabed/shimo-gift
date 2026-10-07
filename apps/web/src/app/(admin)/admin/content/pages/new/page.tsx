import Link from "next/link";
import { ContentPageForm, type ContentPageFormValues } from "@/components/admin/content-page-form";
import { requireAdminPage } from "@/lib/auth/authorization";

export default async function NewContentPage({ searchParams }: { searchParams: Promise<{ pageKey?: string }> }) {
  await requireAdminPage();
  const { pageKey = "" } = await searchParams;
  const values: ContentPageFormValues = { pageKey: /^[a-z0-9-]{1,80}$/.test(pageKey) ? pageKey : "", isActive: false, titleAr: "", slugAr: "", bodyAr: "", seoTitleAr: "", seoDescriptionAr: "", titleEn: "", slugEn: "", bodyEn: "", seoTitleEn: "", seoDescriptionEn: "" };
  return <div className="admin-page"><header className="admin-page__header"><div><h1>إضافة صفحة عامة</h1><p>أضف نصاً عربياً موثوقاً؛ لا تستخدم HTML خاماً.</p></div><Link className="ui-button ui-button--ghost" href="/admin/content/pages">العودة</Link></header><ContentPageForm values={values} /></div>;
}
