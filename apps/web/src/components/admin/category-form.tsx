"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Card, Input, Select, Textarea } from "@/components/ui";
import { adminMessages as messages } from "@/lib/admin/messages";
import type { AdminActionState } from "@/lib/admin/config";
import { saveCategory } from "@/app/(admin)/admin/actions";
import { SubmitButton } from "./submit-button";

export type CategoryFormValues = {
  id?: string;
  nameAr: string;
  nameEn: string;
  slug: string;
  descriptionAr: string;
  descriptionEn: string;
  seoTitleAr: string;
  seoDescriptionAr: string;
  seoTitleEn: string;
  seoDescriptionEn: string;
  parentId: string;
  isActive: boolean;
};

export function CategoryForm({
  values,
  parents,
}: {
  values: CategoryFormValues;
  parents: { id: string; name: string }[];
}) {
  const [state, action] = useActionState<AdminActionState, FormData>(saveCategory, {});
  const [formValues, setFormValues] = useState(() => ({
    nameAr: values.nameAr,
    nameEn: values.nameEn,
    slug: values.slug,
    descriptionAr: values.descriptionAr,
    descriptionEn: values.descriptionEn,
    seoTitleAr: values.seoTitleAr,
    seoDescriptionAr: values.seoDescriptionAr,
    seoTitleEn: values.seoTitleEn,
    seoDescriptionEn: values.seoDescriptionEn,
    parentId: values.parentId,
    isActive: values.isActive,
  }));
  const fieldError = (key: string) => state.fieldErrors?.[key];
  return (
    <Card>
      <form action={action} className="admin-form">
        {values.id && <input type="hidden" name="categoryId" value={values.id} />}
        <div className="admin-form__grid">
          <Input name="nameAr" label={messages.ar.categoryName} required maxLength={120} value={formValues.nameAr} onChange={(event) => setFormValues((current) => ({ ...current, nameAr: event.target.value }))} error={fieldError("nameAr")} />
          <Input name="nameEn" label={messages.ar.categoryNameEn} maxLength={120} value={formValues.nameEn} onChange={(event) => setFormValues((current) => ({ ...current, nameEn: event.target.value }))} error={fieldError("nameEn")} />
          {values.id && <Input name="slug" label={messages.ar.slug} required maxLength={180} dir="ltr" value={formValues.slug} onChange={(event) => setFormValues((current) => ({ ...current, slug: event.target.value }))} error={fieldError("slug")} />}
          <Select name="parentId" label={messages.ar.parentCategory} value={formValues.parentId} onChange={(event) => setFormValues((current) => ({ ...current, parentId: event.target.value }))} error={fieldError("parentId")}>
            <option value="">{messages.ar.noParent}</option>
            {parents.filter((parent) => parent.id !== values.id).map((parent) => <option value={parent.id} key={parent.id}>{parent.name}</option>)}
          </Select>
          <Textarea className="admin-form__wide" name="descriptionAr" label={messages.ar.categoryDescription} rows={4} maxLength={3000} value={formValues.descriptionAr} onChange={(event) => setFormValues((current) => ({ ...current, descriptionAr: event.target.value }))} error={fieldError("descriptionAr")} />
          <Textarea className="admin-form__wide" name="descriptionEn" label={messages.ar.categoryDescriptionEn} rows={3} maxLength={3000} value={formValues.descriptionEn} onChange={(event) => setFormValues((current) => ({ ...current, descriptionEn: event.target.value }))} error={fieldError("descriptionEn")} />
          {values.id && (
            <>
              <Input className="admin-form__wide" name="seoTitleAr" label="عنوان SEO بالعربية" maxLength={180} value={formValues.seoTitleAr} onChange={(event) => setFormValues((current) => ({ ...current, seoTitleAr: event.target.value }))} error={fieldError("seoTitleAr")} />
              <Textarea className="admin-form__wide" name="seoDescriptionAr" label="وصف SEO بالعربية" rows={3} maxLength={500} value={formValues.seoDescriptionAr} onChange={(event) => setFormValues((current) => ({ ...current, seoDescriptionAr: event.target.value }))} error={fieldError("seoDescriptionAr")} />
              <Input className="admin-form__wide" dir="ltr" name="seoTitleEn" label="SEO title in English" maxLength={180} value={formValues.seoTitleEn} onChange={(event) => setFormValues((current) => ({ ...current, seoTitleEn: event.target.value }))} error={fieldError("seoTitleEn")} />
              <Textarea className="admin-form__wide" dir="ltr" name="seoDescriptionEn" label="SEO description in English" rows={3} maxLength={500} value={formValues.seoDescriptionEn} onChange={(event) => setFormValues((current) => ({ ...current, seoDescriptionEn: event.target.value }))} error={fieldError("seoDescriptionEn")} />
            </>
          )}
        </div>
        <label className="admin-checkbox"><input type="checkbox" name="isActive" checked={formValues.isActive} onChange={(event) => setFormValues((current) => ({ ...current, isActive: event.target.checked }))} /><span>{messages.ar.activeCategory}</span></label>
        {state.error && <p className="admin-feedback admin-feedback--error" role="alert">{state.error}</p>}
        {state.success && <p className="admin-feedback admin-feedback--success" role="status">{state.success}</p>}
        {state.fieldErrors && <p className="admin-feedback admin-feedback--error" role="alert">{messages.ar.genericError}</p>}
        <div className="admin-page__actions"><SubmitButton>{messages.ar.save}</SubmitButton><Link className="ui-button ui-button--ghost" href="/admin/categories">{messages.ar.cancel}</Link></div>
      </form>
    </Card>
  );
}
