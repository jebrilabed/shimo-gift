import Link from "next/link";
import { FaqForm, type FaqFormValues } from "@/components/admin/faq-form";
import { requireAdminPage } from "@/lib/auth/authorization";

export default async function NewFaqPage() {
  await requireAdminPage();
  const values: FaqFormValues = { isActive: false, sortOrder: 0, questionAr: "", answerAr: "", questionEn: "", answerEn: "" };
  return <div className="admin-page"><header className="admin-page__header"><div><h1>إضافة سؤال شائع</h1><p>الأسئلة الجديدة تبدأ كمسودة.</p></div><Link className="ui-button ui-button--ghost" href="/admin/content/faq">العودة</Link></header><FaqForm values={values} /></div>;
}
