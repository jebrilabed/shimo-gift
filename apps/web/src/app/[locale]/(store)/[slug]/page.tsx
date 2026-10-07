import type { Metadata } from "next";
import { cache } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import { Container } from "@/components/ui";
import { StoreBreadcrumbs } from "@/components/storefront/seo-json-ld";
import { Locale } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { siteConfig } from "@/lib/config/site";
import { getPublicSiteData } from "@/lib/seo/site-data";
import { buildBreadcrumbData, canonicalUrl } from "@/lib/seo/public-seo.mjs";
import { decodeRouteSlug } from "@/lib/i18n/route-slug";

type PageProps = { params: Promise<{ locale: string; slug: string }> };

const findPublishedPage = cache(async (slug: string) => {
  if (["account", "admin", "api", "assistant", "cart", "categories", "checkout", "design-system", "faq", "login", "orders", "products", "register", "search"].includes(slug.toLowerCase())) return null;
  const direct = await prisma.contentPageTranslation.findFirst({
    where: { locale: Locale.AR, slug, contentPage: { isActive: true } },
    select: { title: true, slug: true, body: true, seoTitle: true, seoDescription: true, contentPage: { select: { updatedAt: true } } },
  });
  if (direct || !["contact", "shipping-policy", "return-policy", "privacy-policy", "terms"].includes(slug)) return direct;
  return prisma.contentPageTranslation.findFirst({
    where: { locale: Locale.AR, contentPage: { isActive: true, pageKey: slug } },
    select: { title: true, slug: true, body: true, seoTitle: true, seoDescription: true, contentPage: { select: { updatedAt: true } } },
  });
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug: routeSlug } = await params;
  if (locale !== "ar") return { robots: { index: false, follow: true } };
  const slug = decodeRouteSlug(routeSlug);
  const [page, store] = await Promise.all([findPublishedPage(slug), getPublicSiteData()]);
  if (!page && slug !== "contact") return { robots: { index: false, follow: true } };
  if (!page && slug === "contact" && !store.phone && !store.email && !store.address) return { robots: { index: false, follow: true } };
  const title = page?.seoTitle?.trim() || page?.title || (slug === "contact" ? "تواصل معنا" : store.name);
  const description = page?.seoDescription?.trim() || page?.body.slice(0, 280) || store.description;
  const canonical = canonicalUrl(`/ar/${encodeURIComponent(page?.slug ?? slug)}`, siteConfig.url);
  return {
    title, description, ...(canonical ? { alternates: { canonical } } : {}),
    openGraph: { type: "article", title, description, siteName: store.name, locale: "ar_SA", ...(canonical ? { url: canonical } : {}), ...(store.ogImage ? { images: [{ url: store.ogImage, alt: store.name }] } : {}) },
    twitter: { card: store.ogImage ? "summary_large_image" : "summary", title, description, ...(store.ogImage ? { images: [store.ogImage] } : {}) },
  };
}

export default async function PublicContentPage({ params }: PageProps) {
  const { locale, slug: routeSlug } = await params;
  if (locale !== "ar") notFound();
  const slug = decodeRouteSlug(routeSlug);
  const [page, store] = await Promise.all([findPublishedPage(slug), getPublicSiteData()]);
  if (!page) {
    const redirectRecord = await prisma.slugRedirect.findFirst({ where: { resourceType: "CONTENT_PAGE", locale: Locale.AR, oldSlug: slug }, select: { newSlug: true } });
    if (redirectRecord?.newSlug && redirectRecord.newSlug !== slug) {
      const target = await findPublishedPage(redirectRecord.newSlug);
      if (target) permanentRedirect(`/ar/${encodeURIComponent(target.slug)}`);
    }
    if (slug !== "contact") notFound();
  }
  if (page && slug !== page.slug) permanentRedirect(`/ar/${encodeURIComponent(page.slug)}`);
  const addressValue = store.address;
  const hasContactData = Boolean(store.phone || store.email || addressValue);
  if (!page && !hasContactData) notFound();
  const title = page?.title ?? "تواصل معنا";
  const breadcrumbs = [{ name: store.name, path: "/ar" }, { name: title, path: `/ar/${encodeURIComponent(page?.slug ?? slug)}` }];
  return <main className="store-main"><Container>
    <StoreBreadcrumbs items={breadcrumbs} jsonLd={buildBreadcrumbData(breadcrumbs, siteConfig.url)} />
    <article className="store-content-page"><header className="store-page-heading"><h1>{title}</h1></header>
      {page?.body && <div className="store-content-page__body">{page.body}</div>}
      {slug === "contact" && hasContactData && <section className="store-contact-details"><h2>معلومات التواصل</h2><p>{store.storeName}</p>{store.phone && <p>الهاتف: <a href={`tel:${store.phone}`}>{store.phone}</a></p>}{store.email && <p>البريد الإلكتروني: <a href={`mailto:${store.email}`}>{store.email}</a></p>}{addressValue && <p>العنوان: {addressValue}</p>}</section>}
    </article>
  </Container></main>;
}
