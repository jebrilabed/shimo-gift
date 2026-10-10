"use client";

import { useActionState, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, Input, Select, Textarea } from "@/components/ui";
import { ToastMessage } from "@/components/ui/toast";
import { adminMessages as messages } from "@/lib/admin/messages";
import type { AdminActionState } from "@/lib/admin/config";
import { saveProduct } from "@/app/(admin)/admin/actions";
import { SubmitButton } from "./submit-button";
import { ProductImageUploader, type UploadedProductImage } from "./product-image-uploader";
import { cloudinaryImageUrl } from "@/lib/seo/cloudinary-image.mjs";

function productImageLoader({ src, width }: { src: string; width: number }) {
  return cloudinaryImageUrl(src, width) ?? src;
}

export type ProductFormValues = {
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
  price: string;
  compareAtPrice: string;
  stockQuantity: number;
  categoryId: string;
  imageUrls: string[];
  isActive: boolean;
};

export function ProductForm({
  values,
  categories,
}: {
  values: ProductFormValues;
  categories: { id: string; name: string }[];
}) {
  const [state, action] = useActionState<AdminActionState, FormData>(saveProduct, {});
  const router = useRouter();
  const [formValues, setFormValues] = useState(() => ({
    nameAr: values.nameAr,
    descriptionAr: values.descriptionAr,
    price: values.price,
    compareAtPrice: values.compareAtPrice,
    stockQuantity: String(values.stockQuantity),
    categoryId: values.categoryId,
    isActive: values.isActive,
  }));
  const [uploadedImages, setUploadedImages] = useState<UploadedProductImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const fieldError = (key: string) => state.fieldErrors?.[key];

  useEffect(() => {
    if (state.redirectTo) router.replace(state.redirectTo);
  }, [router, state.redirectTo]);

  return (
    <Card>
      <form action={action} className="admin-form">
        {values.id && <input type="hidden" name="productId" value={values.id} />}
        {values.id && <>
          <input type="hidden" name="nameEn" value={values.nameEn} />
          <input type="hidden" name="slug" value={values.slug} />
          <input type="hidden" name="descriptionEn" value={values.descriptionEn} />
          <input type="hidden" name="seoTitleAr" value={values.seoTitleAr} />
          <input type="hidden" name="seoDescriptionAr" value={values.seoDescriptionAr} />
          <input type="hidden" name="seoTitleEn" value={values.seoTitleEn} />
          <input type="hidden" name="seoDescriptionEn" value={values.seoDescriptionEn} />
        </>}
        {!values.id && <input type="hidden" name="imageAssets" value={JSON.stringify(uploadedImages.map(({ url, providerPublicId }) => ({ url, publicId: providerPublicId })))} />}
        <div className="admin-form__grid">
          <Input name="nameAr" label={messages.ar.productName} required maxLength={160} value={formValues.nameAr} onChange={(event) => setFormValues((current) => ({ ...current, nameAr: event.target.value }))} error={fieldError("nameAr")} />
          <Input name="price" label={messages.ar.price} required type="number" min="0" max="9999999999.99" step="0.01" inputMode="decimal" value={formValues.price} onChange={(event) => setFormValues((current) => ({ ...current, price: event.target.value }))} error={fieldError("price")} />
          <Input name="compareAtPrice" label={messages.ar.compareAtPrice} type="number" min="0" max="9999999999.99" step="0.01" inputMode="decimal" value={formValues.compareAtPrice} onChange={(event) => setFormValues((current) => ({ ...current, compareAtPrice: event.target.value }))} error={fieldError("compareAtPrice")} />
          <Input name="stockQuantity" label={messages.ar.stock} required type="number" min="0" max="999999999" step="1" inputMode="numeric" value={formValues.stockQuantity} onChange={(event) => setFormValues((current) => ({ ...current, stockQuantity: event.target.value }))} error={fieldError("stockQuantity")} />
          <Select name="categoryId" label={messages.ar.category} value={formValues.categoryId} onChange={(event) => setFormValues((current) => ({ ...current, categoryId: event.target.value }))} error={fieldError("categoryId")}>
            <option value="">{messages.ar.noCategory}</option>
            {categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
          </Select>
          <Textarea className="admin-form__wide" name="descriptionAr" label={messages.ar.description} rows={4} maxLength={5000} value={formValues.descriptionAr} onChange={(event) => setFormValues((current) => ({ ...current, descriptionAr: event.target.value }))} error={fieldError("descriptionAr")} />
          {!values.id && <div className="admin-form__wide admin-product-image-field">
            <ProductImageUploader
              maxFiles={8 - uploadedImages.length}
              onUploaded={(image) => setUploadedImages((current) => [...current, image])}
              onUploadingChange={setUploading}
            />
            {uploadedImages.length > 0 && <div className="admin-product-image-previews">{uploadedImages.map((image, index) => <div className="admin-product-image-preview" key={image.providerPublicId}>
              <Image alt={image.fileName} height={88} loader={productImageLoader} src={image.url} width={88} />
              <span title={image.fileName}>{image.fileName}</span>
              <button aria-label={`إزالة ${image.fileName}`} onClick={() => setUploadedImages((current) => current.filter((_, itemIndex) => itemIndex !== index))} type="button">إزالة</button>
            </div>)}</div>}
            {fieldError("imageUrls") && <p className="admin-feedback admin-feedback--error" role="alert">{fieldError("imageUrls")}</p>}
          </div>}
          {values.id && <p className="admin-form__wide">{messages.ar.imageManagerHint}</p>}
        </div>
        <label className="admin-checkbox">
          <input type="checkbox" name="isActive" checked={formValues.isActive} onChange={(event) => setFormValues((current) => ({ ...current, isActive: event.target.checked }))} />
          <span>{messages.ar.activeStatus}</span>
        </label>
        <ToastMessage eventKey={state} message={state.error} tone="error" />
        <ToastMessage eventKey={state} message={state.success} tone="success" />
        <ToastMessage eventKey={state} message={state.fieldErrors ? messages.ar.genericError : undefined} tone="warning" />
        <div className="admin-page__actions"><SubmitButton disabled={uploading}>{messages.ar.save}</SubmitButton><Link className="ui-button ui-button--ghost" href="/admin/products">{messages.ar.cancel}</Link></div>
      </form>
    </Card>
  );
}
