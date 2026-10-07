import { notFound } from "next/navigation";
import Link from "next/link";
import { ProductForm, type ProductFormValues } from "@/components/admin/product-form";
import { adminMessages as messages } from "@/lib/admin/messages";
import { requireAdminPage } from "@/lib/auth/authorization";
import { prisma } from "@/lib/db/prisma";
import { ProductManagement } from "@/components/admin/product-management";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const [product, categories] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        translations: true,
        skus: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] },
        images: { orderBy: { sortOrder: "asc" } },
      },
    }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" }, include: { translations: { where: { locale: "AR" }, take: 1 } } }),
  ]);
  if (!product) notFound();
  const ar = product.translations.find((translation) => translation.locale === "AR");
  const en = product.translations.find((translation) => translation.locale === "EN");
  const sku = product.skus.find((item) => item.isDefault) ?? product.skus[0];
  const values: ProductFormValues = {
    id: product.id,
    nameAr: ar?.name ?? "",
    nameEn: en?.name ?? "",
    slug: product.slug,
    descriptionAr: ar?.description ?? "",
    descriptionEn: en?.description ?? "",
    seoTitleAr: ar?.seoTitle ?? "",
    seoDescriptionAr: ar?.seoDescription ?? "",
    seoTitleEn: en?.seoTitle ?? "",
    seoDescriptionEn: en?.seoDescription ?? "",
    price: sku?.price.toString() ?? "0",
    compareAtPrice: sku?.compareAtPrice?.toString() ?? "",
    stockQuantity: sku?.stockQuantity ?? 0,
    categoryId: product.categoryId ?? "",
    imageUrls: product.images.map((image) => image.url),
    isActive: product.status === "ACTIVE",
  };
  return <div className="admin-page"><header className="admin-page__header"><div><h1>{messages.ar.editProduct}</h1><p>{ar?.name ?? product.slug}</p></div><Link className="ui-button ui-button--ghost" href="/admin/products">{messages.ar.backToProducts}</Link></header><ProductForm values={{ ...values, imageUrls: [] }} categories={categories.map((category) => ({ id: category.id, name: category.translations[0]?.name ?? category.slug }))} /><ProductManagement
    productId={product.id}
    skus={product.skus.map(({ id: skuId, price, stockQuantity, variantOptions, isActive }) => ({
      id: skuId,
      price: price.toString(),
      stockQuantity,
      variantOptions,
      isActive,
    }))}
    images={product.images.map(({ id: imageId, url, providerPublicId, altText, sortOrder }) => ({
      id: imageId,
      url,
      providerPublicId,
      altText,
      sortOrder,
    }))}
  /></div>;
}
