"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Card, Input, Select, Textarea } from "@/components/ui";
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
    price: values.price,
    compareAtPrice: values.compareAtPrice,
    stockQuantity: String(values.stockQuantity),
    categoryId: values.categoryId,
    isActive: values.isActive,
  }));
  const [uploadedImages, setUploadedImages] = useState<UploadedProductImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const fieldError = (key: string) => state.fieldErrors?.[key];

  return (
    <Card>
      <form action={action} className="admin-form">
        {values.id && <input type="hidden" name="productId" value={values.id} />}
        {!values.id && <input type="hidden" name="imageAssets" value={JSON.stringify(uploadedImages.map(({ url, providerPublicId }) => ({ url, publicId: providerPublicId })))} />}
        <div className="admin-form__grid">
          <Input name="nameAr" label={messages.ar.productName} required maxLength={160} value={formValues.nameAr} onChange={(event) => setFormValues((current) => ({ ...current, nameAr: event.target.value }))} error={fieldError("nameAr")} />
          {values.id && <Input name="nameEn" label={messages.ar.productNameEn} maxLength={160} value={formValues.nameEn} onChange={(event) => setFormValues((current) => ({ ...current, nameEn: event.target.value }))} error={fieldError("nameEn")} />}
          {values.id && <Input name="slug" label={messages.ar.slug} required maxLength={180} dir="ltr" autoCapitalize="none" value={formValues.slug} onChange={(event) => setFormValues((current) => ({ ...current, slug: event.target.value }))} error={fieldError("slug")} />}
          <Input name="price" label={messages.ar.price} required type="number" min="0" max="9999999999.99" step="0.01" inputMode="decimal" value={formValues.price} onChange={(event) => setFormValues((current) => ({ ...current, price: event.target.value }))} error={fieldError("price")} />
          <Input name="compareAtPrice" label={messages.ar.compareAtPrice} type="number" min="0" max="9999999999.99" step="0.01" inputMode="decimal" value={formValues.compareAtPrice} onChange={(event) => setFormValues((current) => ({ ...current, compareAtPrice: event.target.value }))} error={fieldError("compareAtPrice")} />
          <Input name="stockQuantity" label={messages.ar.stock} required type="number" min="0" max="999999999" step="1" inputMode="numeric" value={formValues.stockQuantity} onChange={(event) => setFormValues((current) => ({ ...current, stockQuantity: event.target.value }))} error={fieldError("stockQuantity")} />
          <Select name="categoryId" label={messages.ar.category} value={formValues.categoryId} onChange={(event) => setFormValues((current) => ({ ...current, categoryId: event.target.value }))} error={fieldError("categoryId")}>
            <option value="">{messages.ar.noCategory}</option>
            {categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
          </Select>
          <Textarea className="admin-form__wide" name="descriptionAr" label={messages.ar.description} rows={4} maxLength={5000} value={formValues.descriptionAr} onChange={(event) => setFormValues((current) => ({ ...current, descriptionAr: event.target.value }))} error={fieldError("descriptionAr")} />
          {values.id && <Textarea className="admin-form__wide" name="descriptionEn" label={messages.ar.descriptionEn} rows={3} maxLength={5000} value={formValues.descriptionEn} onChange={(event) => setFormValues((current) => ({ ...current, descriptionEn: event.target.value }))} error={fieldError("descriptionEn")} />}
          {values.id && <>
            <Input className="admin-form__wide" name="seoTitleAr" label="عنوان SEO بالعربية" maxLength={180} value={formValues.seoTitleAr} onChange={(event) => setFormValues((current) => ({ ...current, seoTitleAr: event.target.value }))} error={fieldError("seoTitleAr")} />
            <Textarea className="admin-form__wide" name="seoDescriptionAr" label="وصف SEO بالعربية" rows={3} maxLength={500} value={formValues.seoDescriptionAr} onChange={(event) => setFormValues((current) => ({ ...current, seoDescriptionAr: event.target.value }))} error={fieldError("seoDescriptionAr")} />
            <Input className="admin-form__wide" dir="ltr" name="seoTitleEn" label="SEO title in English" maxLength={180} value={formValues.seoTitleEn} onChange={(event) => setFormValues((current) => ({ ...current, seoTitleEn: event.target.value }))} error={fieldError("seoTitleEn")} />
            <Textarea className="admin-form__wide" dir="ltr" name="seoDescriptionEn" label="SEO description in English" rows={3} maxLength={500} value={formValues.seoDescriptionEn} onChange={(event) => setFormValues((current) => ({ ...current, seoDescriptionEn: event.target.value }))} error={fieldError("seoDescriptionEn")} />
          </>}
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
        {state.error && <p className="admin-feedback admin-feedback--error" role="alert">{state.error}</p>}
        {state.success && <p className="admin-feedback admin-feedback--success" role="status">{state.success}</p>}
        {state.fieldErrors && <p className="admin-feedback admin-feedback--error" role="alert">{messages.ar.genericError}</p>}
        <div className="admin-page__actions"><SubmitButton disabled={uploading}>{messages.ar.save}</SubmitButton><Link className="ui-button ui-button--ghost" href="/admin/products">{messages.ar.cancel}</Link></div>
      </form>
    </Card>
  );
}
