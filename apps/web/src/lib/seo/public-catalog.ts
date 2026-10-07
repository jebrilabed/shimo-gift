import "server-only";
import { cache } from "react";
import { Locale, ProductStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";

/**
 * These loaders use React's request-scoped memoization only. Public catalog
 * details are re-read for each request so price and stock never use a shared,
 * stale cache. generateMetadata and the page can share the same DB read.
 */
export const getPublishedProductBySlug = cache((slug: string) => prisma.product.findFirst({
  where: {
    status: ProductStatus.ACTIVE,
    translations: { some: { locale: Locale.AR, slug } },
    OR: [{ categoryId: null }, { category: { is: { status: "ACTIVE" } } }],
  },
  select: {
    id: true,
    seoTitle: true,
    seoDescription: true,
    categoryId: true,
    translations: { where: { locale: Locale.AR }, take: 1, select: { name: true, description: true, slug: true, seoTitle: true, seoDescription: true } },
    images: { orderBy: { sortOrder: "asc" }, select: { url: true, altText: true } },
    skus: { where: { isActive: true }, orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }], select: { id: true, price: true, stockQuantity: true, variantOptions: true } },
  },
}));

export const getPublishedCategoryBySlug = cache((slug: string) => prisma.category.findFirst({
  where: { status: "ACTIVE", translations: { some: { locale: Locale.AR, slug } } },
  select: {
    id: true,
    seoTitle: true,
    seoDescription: true,
    translations: { where: { locale: Locale.AR }, take: 1, select: { name: true, description: true, seoTitle: true, seoDescription: true, slug: true } },
  },
}));
