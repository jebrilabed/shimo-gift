import { notFound } from "next/navigation";
import Link from "next/link";
import { ContentPageForm, type ContentPageFormValues } from "@/components/admin/content-page-form";
import { requireAdminPage } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";

export default async function EditContentPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const page = await prisma.contentPage.findUnique({ where: { id }, include: { translations: true } });
  if (!page) notFound();
  const ar = page.translations.find((translation) => translation.locale === "AR");
  const en = page.translations.find((translation) => translation.locale === "EN");
  const values: ContentPageFormValues = { id: page.id, pageKey: page.pageKey, isActive: page.isActive, titleAr: ar?.title ?? "", slugAr: ar?.slug ?? "", bodyAr: ar?.body ?? "", seoTitleAr: ar?.seoTitle ?? "", seoDescriptionAr: ar?.seoDescription ?? "", titleEn: en?.title ?? "", slugEn: en?.slug ?? "", bodyEn: en?.body ?? "", seoTitleEn: en?.seoTitle ?? "", seoDescriptionEn: en?.seoDescription ?? "" };
  return <div className="admin-page"><header className="admin-page__header"><div><h1>تعديل صفحة المحتوى</h1><p>{page.pageKey}</p></div><Link className="ui-button ui-button--ghost" href="/admin/content/pages">العودة إلى الصفحات</Link></header><ContentPageForm values={values} /></div>;
}
