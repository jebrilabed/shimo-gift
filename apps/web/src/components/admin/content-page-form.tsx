"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Card, Input, Textarea } from "@/components/ui";
import type { AdminActionState } from "@/lib/admin/config";
import { saveContentPage } from "@/app/(admin)/admin/content/actions";
import { SubmitButton } from "./submit-button";

export type ContentPageFormValues = {
  id?: string;
  pageKey: string;
  isActive: boolean;
  titleAr: string;
  slugAr: string;
  bodyAr: string;
  seoTitleAr: string;
  seoDescriptionAr: string;
  titleEn: string;
  slugEn: string;
  bodyEn: string;
  seoTitleEn: string;
  seoDescriptionEn: string;
};

export function ContentPageForm({ values }: { values: ContentPageFormValues }) {
  const [state, action] = useActionState<AdminActionState, FormData>(saveContentPage, {});
  const error = (field: string) => state.fieldErrors?.[field];
  return <Card><form action={action} className="admin-form">
    {values.id && <input name="contentPageId" type="hidden" value={values.id} />}
    <div className="admin-form__grid">
      <Input label="مفتاح الصفحة (ثابت بعد الإنشاء)" name="pageKey" required maxLength={80} readOnly={Boolean(values.id)} defaultValue={values.pageKey} dir="ltr" error={error("pageKey")} hint="مثال: shipping-policy أو contact" />
      <Input label="عنوان الصفحة بالعربية" name="titleAr" required maxLength={180} defaultValue={values.titleAr} error={error("titleAr")} />
      <Input label="الرابط العربي" name="slugAr" required maxLength={160} dir="ltr" defaultValue={values.slugAr} error={error("slugAr")} />
      <Textarea className="admin-form__wide" label="المحتوى العربي (نص عادي)" name="bodyAr" required maxLength={50000} rows={12} defaultValue={values.bodyAr} error={error("bodyAr")} />
      <Input label="عنوان SEO بالعربية" name="seoTitleAr" maxLength={180} defaultValue={values.seoTitleAr} error={error("seoTitleAr")} />
      <Textarea label="وصف SEO بالعربية" name="seoDescriptionAr" maxLength={500} rows={3} defaultValue={values.seoDescriptionAr} error={error("seoDescriptionAr")} />
      <h2 className="admin-form__wide">الترجمة الإنجليزية (اختيارية — لا تُعرض حتى تفعيل مساراتها)</h2>
      <Input label="عنوان الصفحة بالإنجليزية" name="titleEn" maxLength={180} dir="ltr" defaultValue={values.titleEn} error={error("titleEn")} />
      <Input label="الرابط الإنجليزي" name="slugEn" maxLength={160} dir="ltr" defaultValue={values.slugEn} error={error("slugEn")} />
      <Textarea className="admin-form__wide" label="المحتوى الإنجليزي" name="bodyEn" maxLength={50000} rows={8} dir="ltr" defaultValue={values.bodyEn} error={error("bodyEn")} />
      <Input label="SEO title (English)" name="seoTitleEn" maxLength={180} dir="ltr" defaultValue={values.seoTitleEn} error={error("seoTitleEn")} />
      <Textarea label="SEO description (English)" name="seoDescriptionEn" maxLength={500} rows={3} dir="ltr" defaultValue={values.seoDescriptionEn} error={error("seoDescriptionEn")} />
    </div>
    <label className="admin-checkbox"><input defaultChecked={values.isActive} name="isActive" type="checkbox" /><span>منشورة ومتاحة للعامة</span></label>
    {state.error && <p className="admin-feedback admin-feedback--error" role="alert">{state.error}</p>}
    {state.success && <p className="admin-feedback admin-feedback--success" role="status">{state.success}</p>}
    {state.fieldErrors && <p className="admin-feedback admin-feedback--error" role="alert">{Object.values(state.fieldErrors).join(" ")}</p>}
    <div className="admin-page__actions"><SubmitButton>حفظ الصفحة</SubmitButton><Link className="ui-button ui-button--ghost" href="/admin/content/pages">إلغاء</Link></div>
  </form></Card>;
}
