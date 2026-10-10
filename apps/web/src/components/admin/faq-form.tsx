"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Card, Input, Textarea } from "@/components/ui";
import { ToastMessage } from "@/components/ui/toast";
import type { AdminActionState } from "@/lib/admin/config";
import { saveFaq } from "@/app/(admin)/admin/content/actions";
import { SubmitButton } from "./submit-button";

export type FaqFormValues = { id?: string; isActive: boolean; sortOrder: number; questionAr: string; answerAr: string; questionEn: string; answerEn: string };

export function FaqForm({ values }: { values: FaqFormValues }) {
  const [state, action] = useActionState<AdminActionState, FormData>(saveFaq, {});
  const error = (field: string) => state.fieldErrors?.[field];
  return <Card><form action={action} className="admin-form">
    {values.id && <input name="faqId" type="hidden" value={values.id} />}
    <div className="admin-form__grid">
      <Input label="السؤال بالعربية" name="questionAr" required maxLength={250} defaultValue={values.questionAr} error={error("questionAr")} />
      <Textarea label="الإجابة بالعربية" name="answerAr" required maxLength={10000} rows={6} defaultValue={values.answerAr} error={error("answerAr")} />
      <Input label="السؤال بالإنجليزية (اختياري)" name="questionEn" maxLength={250} dir="ltr" defaultValue={values.questionEn} error={error("questionEn")} />
      <Textarea label="الإجابة بالإنجليزية" name="answerEn" maxLength={10000} rows={6} dir="ltr" defaultValue={values.answerEn} error={error("answerEn")} />
      <Input label="ترتيب العرض" name="sortOrder" type="number" min={0} max={999999} step={1} defaultValue={values.sortOrder} error={error("sortOrder")} />
    </div>
    <label className="admin-checkbox"><input defaultChecked={values.isActive} name="isActive" type="checkbox" /><span>منشور ويظهر للعامة</span></label>
    <ToastMessage eventKey={state} message={state.error} tone="error" />
    <ToastMessage eventKey={state} message={state.success} tone="success" />
    <ToastMessage eventKey={state} message={state.fieldErrors ? Object.values(state.fieldErrors).join(" ") : undefined} tone="warning" />
    <div className="admin-page__actions"><SubmitButton>حفظ السؤال</SubmitButton><Link className="ui-button ui-button--ghost" href="/admin/content/faq">إلغاء</Link></div>
  </form></Card>;
}
