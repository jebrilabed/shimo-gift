import { notFound } from "next/navigation";
import Link from "next/link";
import { FaqForm, type FaqFormValues } from "@/components/admin/faq-form";
import { requireAdminPage } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";

export default async function EditFaqPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const faq = await prisma.fAQ.findUnique({ where: { id }, include: { translations: true } });
  if (!faq) notFound();
  const ar = faq.translations.find((translation) => translation.locale === "AR");
  const en = faq.translations.find((translation) => translation.locale === "EN");
  const values: FaqFormValues = { id: faq.id, isActive: faq.isActive, sortOrder: faq.sortOrder, questionAr: ar?.question ?? "", answerAr: ar?.answer ?? "", questionEn: en?.question ?? "", answerEn: en?.answer ?? "" };
  return <div className="admin-page"><header className="admin-page__header"><div><h1>تعديل سؤال شائع</h1><p>{ar?.question ?? faq.id}</p></div><Link className="ui-button ui-button--ghost" href="/admin/content/faq">العودة إلى الأسئلة</Link></header><FaqForm values={values} /></div>;
}
