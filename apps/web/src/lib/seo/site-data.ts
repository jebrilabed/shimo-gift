import "server-only";
import { cache } from "react";
import { siteConfig } from "@/lib/config/site";
import { prisma } from "@/lib/db/prisma";
import { Locale } from "@/generated/prisma/enums";
import { storeCurrency } from "@/lib/phase7/validation.mjs";

export type PublicSiteData = {
  name: string;
  storeName: string;
  description: string;
  storeDescription: string | null;
  ogImage: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  currency: string | null;
  storeActive: boolean | null;
};

export type PublicCategoryCrumb = { name: string; slug: string; description: string | null };

export const getPublishedFaqs = cache(() => prisma.fAQ.findMany({
  where: { isActive: true, translations: { some: { locale: Locale.AR } } },
  orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  select: { translations: { where: { locale: Locale.AR }, take: 1, select: { question: true, answer: true } } },
}));

function addressText(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const address = (value as Record<string, unknown>).address;
  return typeof address === "string" && address.trim() ? address.trim().slice(0, 300) : null;
}

function publicHttpsUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

export const getPublicSiteData = cache(async (): Promise<PublicSiteData> => {
  const defaults: PublicSiteData = {
    name: siteConfig.name,
    storeName: siteConfig.name,
    description: "متجر Shimo Gift للهدايا والمنتجات المختارة.",
    storeDescription: null,
    ogImage: null,
    email: null,
    phone: null,
    address: null,
    currency: storeCurrency,
    storeActive: null,
  };
  try {
    const [settings, seo] = await Promise.all([
      prisma.storeSettings.findUnique({ where: { id: "singleton" }, select: { description: true, email: true, contactPhone: true, address: true, isActive: true } }),
      prisma.storeSeoSettings.findUnique({ where: { locale: "AR" }, select: { description: true, defaultOgImageUrl: true } }),
    ]);
    return {
      name: siteConfig.name,
      storeName: siteConfig.name,
      description: seo?.description?.trim() || settings?.description?.trim() || defaults.description,
      storeDescription: settings?.description?.trim() || null,
      ogImage: publicHttpsUrl(seo?.defaultOgImageUrl),
      email: settings?.email?.trim() || null,
      phone: settings?.contactPhone?.trim() || null,
      address: addressText(settings?.address),
      currency: storeCurrency,
      storeActive: settings?.isActive ?? null,
    };
  } catch {
    return defaults;
  }
});

export const getPublicCategoryTrail = cache(async (categoryId: string | null | undefined): Promise<PublicCategoryCrumb[]> => {
  if (!categoryId) return [];
  return prisma.$queryRaw<PublicCategoryCrumb[]>`
    WITH RECURSIVE category_trail AS (
      SELECT c."id", c."parentId", t."name", t."slug", t."description", 0 AS depth
      FROM "categories" AS c
      INNER JOIN "category_translations" AS t
        ON t."categoryId" = c."id" AND t."locale" = 'ar'
      WHERE c."id" = ${categoryId} AND c."status" = 'ACTIVE'
      UNION ALL
      SELECT parent."id", parent."parentId", parentTranslation."name", parentTranslation."slug", parentTranslation."description", trail.depth + 1
      FROM "categories" AS parent
      INNER JOIN category_trail AS trail ON trail."parentId" = parent."id"
      INNER JOIN "category_translations" AS parentTranslation
        ON parentTranslation."categoryId" = parent."id" AND parentTranslation."locale" = 'ar'
      WHERE parent."status" = 'ACTIVE' AND trail.depth < 11
    )
    SELECT "name", "slug", "description"
    FROM category_trail
    ORDER BY depth DESC
  `;
});

export function ogImageFromImages(images: { url: string; altText: string | null }[], fallback: string | null = null) {
  const first = images.find((image) => {
    try { return new URL(image.url).protocol === "https:"; } catch { return false; }
  });
  if (first) return [{ url: first.url, alt: first.altText?.trim() || "صورة المنتج" }];
  return fallback ? [{ url: fallback, alt: siteConfig.name }] : [];
}
