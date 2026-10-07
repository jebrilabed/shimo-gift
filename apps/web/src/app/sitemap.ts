import type { MetadataRoute } from "next";
import { Locale, ProductStatus } from "@/generated/prisma/enums";
import { siteConfig } from "@/lib/config/site";
import { prisma } from "@/lib/db/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = siteConfig.url;
  if (!baseUrl) return [];
  const staticEntries: MetadataRoute.Sitemap = [
    { url: new URL("/ar", baseUrl).toString(), changeFrequency: "daily", priority: 1 },
    { url: new URL("/ar/products", baseUrl).toString(), changeFrequency: "daily", priority: 0.9 },
  ];

  try {
    const [products, categories, pages, contactSettings] = await Promise.all([
      prisma.product.findMany({
        where: { status: ProductStatus.ACTIVE, translations: { some: { locale: Locale.AR } } },
        select: { updatedAt: true, translations: { where: { locale: Locale.AR }, take: 1, select: { slug: true } } },
      }),
      prisma.category.findMany({
        where: { status: "ACTIVE", translations: { some: { locale: Locale.AR } } },
        select: { updatedAt: true, translations: { where: { locale: Locale.AR }, take: 1, select: { slug: true } } },
      }),
      prisma.contentPageTranslation.findMany({ where: { locale: Locale.AR, slug: { notIn: ["account", "admin", "api", "assistant", "cart", "categories", "checkout", "design-system", "faq", "login", "orders", "products", "register", "search"] }, contentPage: { isActive: true } }, select: { slug: true, contentPage: { select: { pageKey: true, updatedAt: true } } } }),
      prisma.storeSettings.findUnique({ where: { id: "singleton" }, select: { contactPhone: true, email: true, address: true } }),
    ]);
    const hasContactPage = pages.some((page) => page.contentPage.pageKey === "contact");
    const address = contactSettings?.address;
    const hasPublicAddress = Boolean(address && typeof address === "object" && !Array.isArray(address) && "address" in address && typeof address.address === "string" && address.address.trim());
    const hasContactDetails = Boolean(contactSettings?.contactPhone || contactSettings?.email || hasPublicAddress);
    return [
      ...staticEntries,
      ...(!hasContactPage && hasContactDetails ? [{ url: new URL("/ar/contact", baseUrl).toString(), changeFrequency: "monthly" as const, priority: 0.5 }] : []),
      ...pages.map((page) => ({ url: new URL(`/ar/${encodeURIComponent(page.slug)}`, baseUrl).toString(), lastModified: page.contentPage.updatedAt, changeFrequency: "monthly" as const, priority: 0.5 })),
      ...products.flatMap((product) => product.translations.map((translation) => ({
        url: new URL(`/ar/products/${encodeURIComponent(translation.slug)}`, baseUrl).toString(),
        lastModified: product.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      }))),
      ...categories.flatMap((category) => category.translations.map((translation) => ({
        url: new URL(`/ar/categories/${encodeURIComponent(translation.slug)}`, baseUrl).toString(),
        lastModified: category.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      }))),
    ];
  } catch {
    // The static storefront entries remain useful during local setup before PostgreSQL is configured.
    return staticEntries;
  }
}
