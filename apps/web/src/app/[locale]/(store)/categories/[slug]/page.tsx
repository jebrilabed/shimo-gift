import type { Metadata } from "next";
import StorefrontHome from "../../page";
import { Locale } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { notFound, permanentRedirect } from "next/navigation";
import { siteConfig } from "@/lib/config/site";
import { getPublicCategoryTrail, getPublicSiteData } from "@/lib/seo/site-data";
import { getPublishedCategoryBySlug } from "@/lib/seo/public-catalog";
import { canonicalUrl } from "@/lib/seo/public-seo.mjs";
import { decodeRouteSlug } from "@/lib/i18n/route-slug";

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const query = await searchParams;
  const { slug: routeSlug, locale } = await params;
  if (locale !== "ar") return {};
  const slug = decodeRouteSlug(routeSlug);
  const category = await getPublishedCategoryBySlug(slug);
  const translation = category?.translations[0];
  if (!translation) return { robots: { index: false, follow: true } };
  const store = await getPublicSiteData();
  const canonical = canonicalUrl(`/ar/categories/${encodeURIComponent(translation.slug)}`, siteConfig.url);
  const title = translation.seoTitle || category.seoTitle || translation.name;
  const description = translation.seoDescription || category.seoDescription || translation.description || store.description;
  return {
    title,
    description,
    ...(canonical ? { alternates: { canonical } } : {}),
    openGraph: {
      type: "website", title, description, siteName: store.name, locale: "ar_SA", ...(canonical ? { url: canonical } : {}),
      ...(store.ogImage ? { images: [{ url: store.ogImage, alt: store.name }] } : {}),
    },
    twitter: { card: store.ogImage ? "summary_large_image" : "summary", title, description, ...(store.ogImage ? { images: [store.ogImage] } : {}) },
    ...(query.q?.trim() || query.page || query.sort ? { robots: { index: false, follow: true } } : {}),
  };
}

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ q?: string; page?: string; sort?: string }>;
};

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const [{ locale, slug: routeSlug }, query] = await Promise.all([params, searchParams]);
  if (locale !== "ar") notFound();
  const slug = decodeRouteSlug(routeSlug);
  const category = await getPublishedCategoryBySlug(slug);
  if (!category) {
    const redirectRecord = await prisma.slugRedirect.findFirst({ where: { resourceType: "CATEGORY", locale: Locale.AR, oldSlug: slug }, select: { newSlug: true } });
    if (redirectRecord?.newSlug && redirectRecord.newSlug !== slug) {
      const target = await prisma.categoryTranslation.findFirst({ where: { locale: Locale.AR, slug: redirectRecord.newSlug, category: { status: "ACTIVE" } }, select: { slug: true } });
      if (target) permanentRedirect(`/ar/categories/${encodeURIComponent(target.slug)}`);
    }
    notFound();
  }
  const trail = await getPublicCategoryTrail(category.id);
  return StorefrontHome({
    params: Promise.resolve({ locale }),
    searchParams: Promise.resolve({ ...query, category: slug }),
    categoryTrail: trail,
    showSiteStructuredData: false,
  });
}
