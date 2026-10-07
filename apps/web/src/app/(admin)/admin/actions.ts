"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { CategoryStatus, Locale, ProductStatus } from "@/generated/prisma/enums";
import { requireAdmin } from "@/lib/auth/authorization";
import { adminMessages } from "@/lib/admin/messages";
import type { AdminActionState } from "@/lib/admin/config";
import { parseCategoryInput, parseInventoryInput, parseProductInput } from "@/lib/admin/catalog-validation.mjs";
import { executeAdminMutation } from "@/lib/admin/execute-admin-mutation.mjs";
import { prisma } from "@/lib/db/prisma";
import { preservePublicSlug } from "@/lib/seo/slug-redirects";

type AdminActor = Awaited<ReturnType<typeof requireAdmin>>;
const messages = adminMessages.ar;

const fieldMessage = (code: string) => {
  const fieldMessages: Record<string, string> = {
    required: messages.validationRequired,
    tooLong: messages.validationTooLong,
    invalidSlug: messages.validationInvalidSlug,
    invalidSku: messages.validationInvalidSku,
    invalidMoney: messages.validationInvalidMoney,
    invalidStock: messages.validationInvalidStock,
    tooManyImages: messages.validationTooManyImages,
    invalidImageUrl: messages.validationInvalidImageUrl,
    comparePriceBelowPrice: messages.validationComparePriceBelowPrice,
  };
  return fieldMessages[code] ?? messages.genericError;
};

async function runAdminAction(
  operation: (admin: AdminActor) => Promise<AdminActionState>,
): Promise<AdminActionState> {
  try {
    const result = await executeAdminMutation(requireAdmin, operation);
    if (!result.ok) {
      return { error: result.reason === "unauthenticated" ? messages.loginRequired : messages.denied };
    }
    return result.value;
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
    console.error("Admin catalog operation failed.", { code });
    if (code === "P2002") return { error: messages.uniqueConflict };
    if (code === "P2003") return { error: messages.genericError };
    return { error: messages.databaseUnavailable };
  }
}

function mappedFieldErrors(errors: Record<string, string>) {
  return Object.fromEntries(Object.entries(errors).map(([field, code]) => [field, fieldMessage(code)]));
}

function categoryStatus(active: boolean) {
  return active ? CategoryStatus.ACTIVE : CategoryStatus.ARCHIVED;
}

function productStatus(active: boolean) {
  return active ? ProductStatus.ACTIVE : ProductStatus.DRAFT;
}

async function translationSlugExists(
  kind: "product" | "category",
  slug: string,
  locale: Locale,
  excludedId?: string,
) {
  if (kind === "product") {
    return prisma.productTranslation.findFirst({
      where: { slug, locale, ...(excludedId ? { productId: { not: excludedId } } : {}) },
      select: { id: true },
    });
  }
  return prisma.categoryTranslation.findFirst({
    where: { slug, locale, ...(excludedId ? { categoryId: { not: excludedId } } : {}) },
    select: { id: true },
  });
}

async function productSlugExists(slug: string, excludedId?: string) {
  return prisma.product.findFirst({
    where: { slug, ...(excludedId ? { id: { not: excludedId } } : {}) },
    select: { id: true },
  });
}

function productSlugBase(name: string) {
  return name.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 180).replace(/-+$/g, "") || "product";
}

async function generateProductSlug(nameAr: string, nameEn: string) {
  const base = productSlugBase(nameAr);
  let slug = base;
  let suffix = 2;
  while (
    await productSlugExists(slug) ||
    await translationSlugExists("product", slug, Locale.AR) ||
    (nameEn && await translationSlugExists("product", slug, Locale.EN))
  ) {
    const ending = `-${suffix++}`;
    slug = `${base.slice(0, 180 - ending.length).replace(/-+$/g, "")}${ending}`;
  }
  return slug;
}

async function generateCategorySlug(nameAr: string, nameEn: string) {
  const base = productSlugBase(nameAr);
  let slug = base;
  let suffix = 2;
  while (
    await prisma.category.findFirst({ where: { slug }, select: { id: true } }) ||
    await translationSlugExists("category", slug, Locale.AR) ||
    (nameEn && await translationSlugExists("category", slug, Locale.EN))
  ) {
    const ending = `-${suffix++}`;
    slug = `${base.slice(0, 180 - ending.length).replace(/-+$/g, "")}${ending}`;
  }
  return slug;
}

async function generateProductSkuCode() {
  let skuCode: string;
  do {
    skuCode = `FAR-${randomUUID().toUpperCase()}`;
  } while (await prisma.productSku.findUnique({ where: { skuCode }, select: { id: true } }));
  return skuCode;
}

export async function saveProduct(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  return runAdminAction(async (admin): Promise<AdminActionState> => {
    const productId = String(formData.get("productId") ?? "").trim();
    if (!productId) {
      const nameAr = formData.get("nameAr");
      const nameEn = formData.get("nameEn");
      formData.set("slug", await generateProductSlug(
        typeof nameAr === "string" ? nameAr.trim() : "",
        typeof nameEn === "string" ? nameEn.trim() : "",
      ));
    }
    const parsed = parseProductInput(formData);
    if (!parsed.ok) return { fieldErrors: mappedFieldErrors(parsed.errors) };
    const input = parsed.value;

    if (await productSlugExists(input.slug, productId || undefined)) {
      return { fieldErrors: { slug: messages.slugExists } };
    }
    if (await translationSlugExists("product", input.slug, Locale.AR, productId || undefined)) {
      return { fieldErrors: { slug: messages.slugExists } };
    }
    if (input.nameEn && await translationSlugExists("product", input.slug, Locale.EN, productId || undefined)) {
      return { fieldErrors: { slug: messages.slugExists } };
    }
    if (input.categoryId && !await prisma.category.findUnique({ where: { id: input.categoryId }, select: { id: true } })) {
      return { fieldErrors: { categoryId: messages.validationInvalidCategory } };
    }

    const existing = productId
      ? await prisma.product.findUnique({
        where: { id: productId },
          select: { id: true, status: true, kind: true, translations: { select: { locale: true, slug: true } }, skus: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }], take: 1, select: { id: true, skuCode: true, isDefault: true } } },
        })
      : null;
    if (productId && !existing) return { error: messages.productNotFound };
    const existingSku = existing?.skus[0];
    const skuCode = existingSku?.skuCode ?? await generateProductSkuCode();

    const translations = [
      { locale: Locale.AR, name: input.nameAr, slug: input.slug, description: input.descriptionAr || null, seoTitle: input.seoTitleAr || null, seoDescription: input.seoDescriptionAr || null },
      ...(input.nameEn ? [{ locale: Locale.EN, name: input.nameEn, slug: input.slug, description: input.descriptionEn || null, seoTitle: input.seoTitleEn || null, seoDescription: input.seoDescriptionEn || null }] : []),
    ];
    const skuData = {
      skuCode,
      price: new Prisma.Decimal(input.price),
      compareAtPrice: input.compareAtPrice ? new Prisma.Decimal(input.compareAtPrice) : null,
      stockQuantity: input.stockQuantity,
      isDefault: existing?.kind === "VARIANT" ? (existingSku?.isDefault ?? false) : true,
      isActive: input.isActive,
    };
    const productData = {
      slug: input.slug,
      status: existing?.status === ProductStatus.ARCHIVED && !input.isActive ? ProductStatus.ARCHIVED : productStatus(input.isActive),
      categoryId: input.categoryId,
      seoTitle: input.seoTitleAr || null,
      seoDescription: input.seoDescriptionAr || null,
    };

    const savedId = await prisma.$transaction(async (tx) => {
      let id: string;
      if (!existing) {
        const created = await tx.product.create({
          data: {
            ...productData,
            kind: "SIMPLE",
            translations: { create: translations },
            skus: { create: skuData },
            images: { create: [
              ...input.imageUrls.map((url) => ({ url, providerPublicId: null, altText: input.nameAr })),
              ...input.uploadedImages.map(({ url, publicId }) => ({ url, providerPublicId: publicId, altText: input.nameAr })),
            ].map((image, sortOrder) => ({ ...image, sortOrder })) },
          },
          select: { id: true },
        });
        id = created.id;
      } else {
        id = existing.id;
        await tx.product.update({ where: { id }, data: productData });
        for (const translation of translations) {
          await tx.productTranslation.upsert({
            where: { productId_locale: { productId: id, locale: translation.locale } },
            create: { productId: id, ...translation },
            update: { name: translation.name, slug: translation.slug, shortDescription: null, description: translation.description, seoTitle: translation.seoTitle, seoDescription: translation.seoDescription },
          });
        }
        for (const previous of existing.translations) {
          const nextTranslation = translations.find((translation) => translation.locale === previous.locale);
          if (nextTranslation && previous.slug !== nextTranslation.slug) {
            await preservePublicSlug(tx, { resourceType: "PRODUCT", locale: previous.locale, oldSlug: previous.slug, newSlug: nextTranslation.slug });
            await tx.adminAuditLog.create({ data: { actorUserId: admin.id, action: "catalog.product.slug-change", entityType: "Product", entityId: id, metadata: { locale: previous.locale.toLowerCase(), fromSlug: previous.slug, toSlug: nextTranslation.slug } } });
          }
        }
        if (!input.nameEn) await tx.productTranslation.deleteMany({ where: { productId: id, locale: Locale.EN } });
        if (existingSku) await tx.productSku.update({ where: { id: existingSku.id }, data: skuData });
        else await tx.productSku.create({ data: { ...skuData, productId: id } });
      }
      await tx.adminAuditLog.create({
        data: {
          actorUserId: admin.id,
          action: existing ? "catalog.product.update" : "catalog.product.create",
          entityType: "Product",
          entityId: id,
          metadata: { slug: input.slug, skuCode },
        },
      });
      return id;
    });

    revalidatePath("/admin");
    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${savedId}`);
    revalidatePath("/admin/inventory");
    revalidatePath("/ar");
    revalidatePath("/ar/products");
    revalidatePath("/ar/products/[slug]", "page");
    revalidatePath("/sitemap.xml");
    return { success: messages.productSaved, ...(!productId ? { redirectTo: "/admin/products" } : {}) };
  });
}

async function categoryParentInvalid(parentId: string | null, categoryId?: string) {
  if (!parentId) return false;
  let cursor: string | null = parentId;
  const seen = new Set<string>();
  for (let depth = 0; cursor && depth < 100; depth += 1) {
    if (cursor === categoryId || seen.has(cursor)) return true;
    seen.add(cursor);
    const parent: { parentId: string | null } | null = await prisma.category.findUnique({
      where: { id: cursor },
      select: { parentId: true },
    });
    if (!parent) return true;
    cursor = parent.parentId;
  }
  return cursor !== null;
}

export async function saveCategory(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  return runAdminAction(async (admin): Promise<AdminActionState> => {
    const categoryId = String(formData.get("categoryId") ?? "").trim();
    if (!categoryId) {
      const nameAr = formData.get("nameAr");
      const nameEn = formData.get("nameEn");
      formData.set("slug", await generateCategorySlug(
        typeof nameAr === "string" ? nameAr.trim() : "",
        typeof nameEn === "string" ? nameEn.trim() : "",
      ));
    }
    const parsed = parseCategoryInput(formData);
    if (!parsed.ok) return { fieldErrors: mappedFieldErrors(parsed.errors) };
    const input = parsed.value;
    if (input.parentId && await categoryParentInvalid(input.parentId, categoryId || undefined)) {
      return { fieldErrors: { parentId: messages.validationInvalidParent } };
    }
    const selectedProductCount = input.productIds.length
      ? await prisma.product.count({ where: { id: { in: input.productIds } } })
      : 0;
    if (selectedProductCount !== input.productIds.length) {
      return { fieldErrors: { productIds: messages.validationInvalidCategoryProducts } };
    }
    const duplicate = await prisma.category.findFirst({
      where: { slug: input.slug, ...(categoryId ? { id: { not: categoryId } } : {}) },
      select: { id: true },
    });
    const arSlugDuplicate = await translationSlugExists("category", input.slug, Locale.AR, categoryId || undefined);
    const enSlugDuplicate = input.nameEn
      ? await translationSlugExists("category", input.slug, Locale.EN, categoryId || undefined)
      : null;
    if (duplicate || arSlugDuplicate || enSlugDuplicate) return { fieldErrors: { slug: messages.slugExists } };

    const existing = categoryId
      ? await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true, translations: { select: { locale: true, slug: true } } } })
      : null;
    if (categoryId && !existing) return { error: messages.categoryNotFound };
    const translations = [
      { locale: Locale.AR, name: input.nameAr, slug: input.slug, description: input.descriptionAr || null, seoTitle: input.seoTitleAr || null, seoDescription: input.seoDescriptionAr || null },
      ...(input.nameEn ? [{ locale: Locale.EN, name: input.nameEn, slug: input.slug, description: input.descriptionEn || null, seoTitle: input.seoTitleEn || null, seoDescription: input.seoDescriptionEn || null }] : []),
    ];
    const data = {
      slug: input.slug,
      parentId: input.parentId,
      status: categoryStatus(input.isActive),
      seoTitle: input.seoTitleAr || null,
      seoDescription: input.seoDescriptionAr || null,
    };

    const savedId = await prisma.$transaction(async (tx) => {
      let id: string;
      if (!existing) {
        const created = await tx.category.create({
          data: { ...data, translations: { create: translations } },
          select: { id: true },
        });
        id = created.id;
      } else {
        id = existing.id;
        await tx.category.update({ where: { id }, data });
        for (const translation of translations) {
          await tx.categoryTranslation.upsert({
            where: { categoryId_locale: { categoryId: id, locale: translation.locale } },
            create: { categoryId: id, ...translation },
            update: { name: translation.name, slug: translation.slug, description: translation.description, seoTitle: translation.seoTitle, seoDescription: translation.seoDescription },
          });
        }
        for (const previous of existing.translations) {
          const nextTranslation = translations.find((translation) => translation.locale === previous.locale);
          if (nextTranslation && previous.slug !== nextTranslation.slug) {
            await preservePublicSlug(tx, { resourceType: "CATEGORY", locale: previous.locale, oldSlug: previous.slug, newSlug: nextTranslation.slug });
            await tx.adminAuditLog.create({ data: { actorUserId: admin.id, action: "catalog.category.slug-change", entityType: "Category", entityId: id, metadata: { locale: previous.locale.toLowerCase(), fromSlug: previous.slug, toSlug: nextTranslation.slug } } });
          }
        }
        if (!input.nameEn) await tx.categoryTranslation.deleteMany({ where: { categoryId: id, locale: Locale.EN } });
      }
      await tx.product.updateMany({
        where: { categoryId: id, ...(input.productIds.length ? { id: { notIn: input.productIds } } : {}) },
        data: { categoryId: null },
      });
      if (input.productIds.length) {
        await tx.product.updateMany({ where: { id: { in: input.productIds } }, data: { categoryId: id } });
      }
      await tx.adminAuditLog.create({
        data: {
          actorUserId: admin.id,
          action: existing ? "catalog.category.update" : "catalog.category.create",
          entityType: "Category",
          entityId: id,
          metadata: { slug: input.slug },
        },
      });
      return id;
    });
    revalidatePath("/admin/categories");
    revalidatePath(`/admin/categories/${savedId}`);
    revalidatePath("/admin/products");
    revalidatePath("/ar");
    revalidatePath("/ar/products");
    revalidatePath("/ar/categories/[slug]", "page");
    revalidatePath("/ar/products/[slug]", "page");
    revalidatePath("/sitemap.xml");
    return { success: messages.categorySaved, ...(!categoryId ? { redirectTo: "/admin/categories" } : {}) };
  });
}

export async function deleteCategory(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  return runAdminAction(async (admin): Promise<AdminActionState> => {
    const id = String(formData.get("categoryId") ?? "").trim();
    if (!id || id.length > 64) return { error: messages.categoryNotFound };
    const result = await prisma.$transaction(async (tx) => {
      const category = await tx.category.findUnique({
        where: { id },
        select: { id: true, products: { select: { id: true }, take: 1 }, children: { select: { id: true }, take: 1 } },
      });
      if (!category) return "missing" as const;
      if (category.products.length) return "products" as const;
      if (category.children.length) return "children" as const;
      await tx.adminAuditLog.create({
        data: { actorUserId: admin.id, action: "catalog.category.delete", entityType: "Category", entityId: id },
      });
      await tx.category.delete({ where: { id } });
      return "deleted" as const;
    });
    if (result === "missing") return { error: messages.categoryNotFound };
    if (result === "products") return { error: messages.categoryHasProducts };
    if (result === "children") return { error: messages.categoryHasChildren };
    revalidatePath("/admin/categories");
    revalidatePath("/admin");
    return { success: messages.categoryDeleted };
  });
}

export async function archiveProduct(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  return runAdminAction(async (admin): Promise<AdminActionState> => {
    const id = String(formData.get("productId") ?? "").trim();
    if (!id || id.length > 64) return { error: messages.productNotFound };
    const product = await prisma.$transaction(async (tx) => {
      const current = await tx.product.findUnique({ where: { id }, select: { id: true } });
      if (!current) return null;
      await tx.product.update({ where: { id }, data: { status: ProductStatus.ARCHIVED } });
      await tx.productSku.updateMany({ where: { productId: id }, data: { isActive: false } });
      await tx.adminAuditLog.create({
        data: { actorUserId: admin.id, action: "catalog.product.archive", entityType: "Product", entityId: id },
      });
      return current;
    });
    if (!product) return { error: messages.productNotFound };
    revalidatePath("/admin");
    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${id}`);
    revalidatePath("/admin/inventory");
    revalidatePath("/ar"); revalidatePath("/ar/products"); revalidatePath("/ar/products/[slug]", "page"); revalidatePath("/sitemap.xml");
    return { success: messages.productArchived };
  });
}

export async function toggleProductStatus(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  return runAdminAction(async (admin): Promise<AdminActionState> => {
    const id = String(formData.get("productId") ?? "").trim();
    if (!id || id.length > 64) return { error: messages.productNotFound };
    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.product.findUnique({ where: { id }, select: { id: true, status: true, kind: true } });
      if (!current) return null;
      const nextStatus = current.status === ProductStatus.ACTIVE ? ProductStatus.DRAFT : ProductStatus.ACTIVE;
      await tx.product.update({ where: { id }, data: { status: nextStatus } });
      if (current.kind === "SIMPLE") await tx.productSku.updateMany({ where: { productId: id }, data: { isActive: nextStatus === ProductStatus.ACTIVE } });
      await tx.adminAuditLog.create({
        data: { actorUserId: admin.id, action: "catalog.product.status", entityType: "Product", entityId: id, metadata: { status: nextStatus } },
      });
      return nextStatus;
    });
    if (!updated) return { error: messages.productNotFound };
    revalidatePath("/admin");
    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${id}`);
    revalidatePath("/admin/inventory");
    revalidatePath("/ar"); revalidatePath("/ar/products"); revalidatePath("/ar/products/[slug]", "page"); revalidatePath("/sitemap.xml");
    return { success: messages.productStatusSaved };
  });
}

export async function updateInventory(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  return runAdminAction(async (admin): Promise<AdminActionState> => {
    const parsed = parseInventoryInput(formData);
    if (!parsed.ok) return { error: fieldMessage(parsed.error) };
    const { skuId, productId, quantity } = parsed.value;
    if (!skuId || skuId.length > 64 || !productId || productId.length > 64) return { error: messages.skuNotFound };

    const updated = await prisma.$transaction(async (tx) => {
      const sku = await tx.$queryRaw<{ id: string; stockQuantity: number }[]>(Prisma.sql`
        SELECT "id", "stockQuantity" FROM "product_skus"
        WHERE "id" = ${skuId} AND "productId" = ${productId}
        FOR UPDATE
      `);
      if (!sku.length) return false;
      await tx.productSku.update({ where: { id: skuId }, data: { stockQuantity: quantity } });
      await tx.adminAuditLog.create({
        data: {
          actorUserId: admin.id,
          action: "catalog.inventory.update",
          entityType: "ProductSku",
          entityId: skuId,
          metadata: { productId, fromQuantity: sku[0].stockQuantity, toQuantity: quantity },
        },
      });
      return true;
    });
    if (!updated) return { error: messages.skuNotFound };
    revalidatePath("/admin");
    revalidatePath("/admin/inventory");
    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${productId}`);
    revalidatePath("/ar/products/[slug]", "page");
    revalidatePath("/sitemap.xml");
    return { success: messages.stockSaved };
  });
}
