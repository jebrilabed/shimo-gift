"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Input, Textarea } from "@/components/ui";
import { ToastMessage } from "@/components/ui/toast";
import { adminMessages as messages } from "@/lib/admin/messages";
import type { AdminActionState } from "@/lib/admin/config";
import { saveCategory } from "@/app/(admin)/admin/actions";
import { SubmitButton } from "./submit-button";

export type CategoryFormValues = {
  id?: string;
  nameAr: string;
  descriptionAr: string;
  isActive: boolean;
  productIds: string[];
  nameEn?: string;
  slug?: string;
  descriptionEn?: string;
  seoTitleAr?: string;
  seoDescriptionAr?: string;
  seoTitleEn?: string;
  seoDescriptionEn?: string;
  parentId?: string;
};

type CategoryProductOption = { id: string; name: string };

export function CategoryForm({
  values,
  products,
}: {
  values: CategoryFormValues;
  products: CategoryProductOption[];
}) {
  const [state, action] = useActionState<AdminActionState, FormData>(saveCategory, {});
  const router = useRouter();
  const [formValues, setFormValues] = useState(() => ({
    nameAr: values.nameAr,
    descriptionAr: values.descriptionAr,
    isActive: values.isActive,
  }));
  const [selectedProductIds, setSelectedProductIds] = useState(values.productIds);
  const fieldError = (key: string) => state.fieldErrors?.[key];

  useEffect(() => {
    if (state.redirectTo) router.replace(state.redirectTo);
  }, [router, state.redirectTo]);

  function toggleProduct(productId: string, selected: boolean) {
    setSelectedProductIds((current) => selected
      ? current.includes(productId) ? current : [...current, productId]
      : current.filter((id) => id !== productId));
  }

  return (
    <Card>
      <form action={action} className="admin-form">
        {values.id && <>
          <input type="hidden" name="categoryId" value={values.id} />
          <input type="hidden" name="slug" value={values.slug ?? ""} />
          <input type="hidden" name="nameEn" value={values.nameEn ?? ""} />
          <input type="hidden" name="descriptionEn" value={values.descriptionEn ?? ""} />
          <input type="hidden" name="seoTitleAr" value={values.seoTitleAr ?? ""} />
          <input type="hidden" name="seoDescriptionAr" value={values.seoDescriptionAr ?? ""} />
          <input type="hidden" name="seoTitleEn" value={values.seoTitleEn ?? ""} />
          <input type="hidden" name="seoDescriptionEn" value={values.seoDescriptionEn ?? ""} />
          <input type="hidden" name="parentId" value={values.parentId ?? ""} />
        </>}
        <div className="admin-form__grid">
          <Input name="nameAr" label={messages.ar.categoryName} required maxLength={120} value={formValues.nameAr} onChange={(event) => setFormValues((current) => ({ ...current, nameAr: event.target.value }))} error={fieldError("nameAr")} />
          <Textarea className="admin-form__wide" name="descriptionAr" label={messages.ar.categoryDescription} rows={4} maxLength={3000} value={formValues.descriptionAr} onChange={(event) => setFormValues((current) => ({ ...current, descriptionAr: event.target.value }))} error={fieldError("descriptionAr")} />
        </div>
        <label className="admin-checkbox"><input type="checkbox" name="isActive" checked={formValues.isActive} onChange={(event) => setFormValues((current) => ({ ...current, isActive: event.target.checked }))} /><span>{messages.ar.status}: {formValues.isActive ? messages.ar.active : messages.ar.archived}</span></label>
        <fieldset className="admin-category-products">
          <legend>{messages.ar.productCount}</legend>
          {products.length > 0 ? products.map((product) => (
            <label className="admin-checkbox" key={product.id}>
              <input
                type="checkbox"
                name="productIds"
                value={product.id}
                checked={selectedProductIds.includes(product.id)}
                onChange={(event) => toggleProduct(product.id, event.target.checked)}
              />
              <span>{product.name}</span>
            </label>
          )) : <p>{messages.ar.noProductsAvailable}</p>}
          {fieldError("productIds") && <p className="admin-field-error" role="alert">{fieldError("productIds")}</p>}
        </fieldset>
        <ToastMessage eventKey={state} message={state.error} tone="error" />
        <ToastMessage eventKey={state} message={state.success} tone="success" />
        <ToastMessage eventKey={state} message={state.fieldErrors ? messages.ar.genericError : undefined} tone="warning" />
        <div className="admin-page__actions"><SubmitButton>{messages.ar.save}</SubmitButton><Link className="ui-button ui-button--ghost" href="/admin/categories">{messages.ar.cancel}</Link></div>
      </form>
    </Card>
  );
}
