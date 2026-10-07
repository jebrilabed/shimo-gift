import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button, Container, Input, Select } from "@/components/ui";
import { ProductCard } from "@/components/storefront/product-card";
import { SafeProductImage } from "@/components/storefront/safe-product-image";
import { isLocale } from "@/lib/i18n/config";
import { Locale, ProductStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { STOREFRONT_PAGE_SIZE } from "@/lib/storefront/config";
import { storefrontMessages as messages } from "@/lib/storefront/messages";
import type { Metadata } from "next";
import { siteConfig } from "@/lib/config/site";
import { getPublicSiteData, type PublicCategoryCrumb } from "@/lib/seo/site-data";
import { buildBreadcrumbData, canonicalUrl } from "@/lib/seo/public-seo.mjs";
import { SeoJsonLd, StoreBreadcrumbs } from "@/components/storefront/seo-json-ld";
import { formatMoney } from "@/lib/storefront/format";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; category?: string; page?: string; sort?: string }>;
  categoryTrail?: PublicCategoryCrumb[];
  showSiteStructuredData?: boolean;
  showHomeHero?: boolean;
};

export async function generateMetadata({ searchParams }: Pick<PageProps, "searchParams">): Promise<Metadata> {
  const params = await searchParams;
  const filtered = Boolean(params.q?.trim() || params.category?.trim() || params.page || params.sort);
  const store = await getPublicSiteData();
  const canonical = canonicalUrl("/ar", siteConfig.url);
  return {
    title: store.name,
    description: store.description,
    ...(canonical ? { alternates: { canonical } } : {}),
    openGraph: {
      type: "website", title: store.name, description: store.description, siteName: store.name,
      locale: "ar_SA", ...(canonical ? { url: canonical } : {}),
      ...(store.ogImage ? { images: [{ url: store.ogImage, alt: store.name }] } : {}),
    },
    twitter: { card: store.ogImage ? "summary_large_image" : "summary", title: store.name, description: store.description, ...(store.ogImage ? { images: [store.ogImage] } : {}) },
    ...(filtered ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function StorefrontHome({ params, searchParams, categoryTrail = [], showSiteStructuredData = true, showHomeHero = true }: PageProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const paramsFromUrl = await searchParams;
  const query = (paramsFromUrl.q ?? "").trim().slice(0, 100);
  const categorySlug = (paramsFromUrl.category ?? "").trim().slice(0, 120);
  const pageNumber = Number(paramsFromUrl.page ?? 1);
  const page = Number.isSafeInteger(pageNumber) && pageNumber > 0 ? pageNumber : 1;
  const skip = (page - 1) * STOREFRONT_PAGE_SIZE;
  const where = {
    status: ProductStatus.ACTIVE,
    translations: {
      some: {
        locale: Locale.AR,
        ...(query ? { name: { contains: query, mode: "insensitive" as const } } : {}),
      },
    },
    ...(categorySlug ? {
      category: { is: { status: "ACTIVE" as const, translations: { some: { locale: Locale.AR, slug: categorySlug } } } },
    } : {
      OR: [{ categoryId: null }, { category: { is: { status: "ACTIVE" as const } } }],
    }),
  };

  const [products, total, categories, storeData] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      skip,
      take: STOREFRONT_PAGE_SIZE,
      select: {
        slug: true,
        featured: true,
        translations: { where: { locale: Locale.AR }, take: 1, select: { name: true, slug: true } },
        images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true, altText: true } },
        category: { select: { translations: { where: { locale: Locale.AR }, take: 1, select: { name: true } } } },
        skus: { where: { isActive: true }, select: { price: true, stockQuantity: true, variantOptions: true } },
      },
    }),
    prisma.product.count({ where }),
    prisma.category.findMany({
      where: { status: "ACTIVE", translations: { some: { locale: Locale.AR } } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { translations: { where: { locale: Locale.AR }, take: 1, select: { name: true, slug: true } } },
    }),
    getPublicSiteData(),
  ]);
  const currency = storeData.currency;
  const pages = Math.max(1, Math.ceil(total / STOREFRONT_PAGE_SIZE));
  const heroProduct = products.find((product) => product.featured && product.images[0]) ?? products.find((product) => product.images[0]) ?? null;
  const heroTranslation = heroProduct?.translations[0];
  const heroImage = heroProduct?.images[0];
  const heroSku = heroProduct?.skus.find((sku) => sku.stockQuantity > 0) ?? heroProduct?.skus[0];
  const isHomeView = showHomeHero && !query && !categorySlug && page === 1 && categoryTrail.length === 0;
  const previousHref = `/ar?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(categorySlug ? { category: categorySlug } : {}), page: String(page - 1) }).toString()}`;
  const nextHref = `/ar?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(categorySlug ? { category: categorySlug } : {}), page: String(page + 1) }).toString()}`;

  return (
    <main className={`store-main ${isHomeView ? "store-home" : ""}`}>
      <Container>
        {categoryTrail.length > 0 && <StoreBreadcrumbs items={[
          { name: storeData.name, path: "/ar" },
          { name: messages.ar.products, path: "/ar/products" },
          ...categoryTrail.map((category) => ({ name: category.name, path: `/ar/categories/${encodeURIComponent(category.slug)}` })),
        ]} jsonLd={buildBreadcrumbData([
          { name: storeData.name, path: "/ar" },
          { name: messages.ar.products, path: "/ar/products" },
          ...categoryTrail.map((category) => ({ name: category.name, path: `/ar/categories/${encodeURIComponent(category.slug)}` })),
        ], siteConfig.url)} />}
        {isHomeView ? (
          <>
            <section aria-labelledby="store-home-title" className="store-home__hero">
              <div className="store-home__hero-copy">
                <span className="store-home__eyebrow">
                  <span className="store-home__eyebrow-dot" />
                  {storeData.storeName || messages.ar.brand} — عالم الهدايا الفاخرة
                </span>
                <h1 id="store-home-title">
                  هدايا تُلامس القلب<br />وتصنع أجمل الذكريات
                </h1>
                <p>
                  {storeData.storeDescription || "اكتشفوا تشكيلة Shimo Gift الحصرية المصممة بأناقة وتغليف مميز ليناسب جميع مناسباتكم وتطلعاتكم."}
                </p>
                <div className="store-home__hero-actions">
                  <Link className="ui-button ui-button--primary ui-button--large" href="/ar/products">
                    استكشف التشكيلة
                  </Link>
                  {heroTranslation && (
                    <Link className="store-home__hero-secondary" href={`/ar/products/${encodeURIComponent(heroTranslation.slug)}`}>
                      شاهدي قطعة مميزة
                    </Link>
                  )}
                </div>
              </div>
              <div className="store-home__hero-visual" aria-hidden={!heroImage}>
                <span className="store-home__hero-orbit" />
                {heroImage && heroTranslation ? (
                  <>
                    <Link aria-label={heroTranslation.name} className="store-home__hero-image" href={`/ar/products/${encodeURIComponent(heroTranslation.slug)}`}>
                      <SafeProductImage alt={heroImage.altText || heroTranslation.name} priority sizes="(max-width: 640px) 75vw, (max-width: 960px) 40vw, 35vw" src={heroImage.url} />
                    </Link>
                    <Link className="store-home__hero-note" href={`/ar/products/${encodeURIComponent(heroTranslation.slug)}`}>
                      <span>{heroProduct?.category?.translations[0]?.name || messages.ar.products}</span>
                      <strong>{heroTranslation.name}</strong>
                      {heroSku && currency && <b>{messages.ar.startingAt} {formatMoney(heroSku.price, currency)}</b>}
                    </Link>
                  </>
                ) : (
                  <span className="store-home__hero-placeholder">
                    <Image alt="" height={512} src="/brand/shimo-logo.png" width={512} />
                  </span>
                )}
              </div>
            </section>

            {/* Brand Value Proposition Features Bar */}
            <section aria-label="مميزات المتجر" className="store-features">
              <div className="store-features__grid">
                <div className="store-feature-card">
                  <span className="store-feature-card__icon">🎁</span>
                  <div>
                    <h3>تغليف هدايا فاخر</h3>
                    <p>لمسات أنيقة تجعل فتح الهدية لحظة لا تُنسى</p>
                  </div>
                </div>
                <div className="store-feature-card">
                  <span className="store-feature-card__icon">✨</span>
                  <div>
                    <h3>جودة واستثناء</h3>
                    <p>منتجات مختارة بعناية فائقة لتناسب أذواقكم</p>
                  </div>
                </div>
                <div className="store-feature-card">
                  <span className="store-feature-card__icon">🚚</span>
                  <div>
                    <h3>توصيل سريع</h3>
                    <p>وصول آمن وسريع لجميع هداياكم حتى الباب</p>
                  </div>
                </div>
                <div className="store-feature-card">
                  <span className="store-feature-card__icon">💖</span>
                  <div>
                    <h3>خدمة عملاء متميزة</h3>
                    <p>فريقنا جاهز دائماً لمساعدتكم واختيار الأنسب</p>
                  </div>
                </div>
              </div>
            </section>
          </>
        ) : (
          <header className="store-page-heading">
            <p className="store-muted">{storeData.storeName || messages.ar.brand}</p>
            <h1>{categoryTrail.at(-1)?.name || messages.ar.products}</h1>
            {categoryTrail.length ? (categoryTrail.at(-1)?.description && <p className="store-muted">{categoryTrail.at(-1)?.description}</p>) : storeData.storeDescription && <p className="store-muted">{storeData.storeDescription}</p>}
          </header>
        )}
        {!currency && <p className="store-alert store-alert--error" role="status">{messages.ar.currencyNotConfigured}</p>}
        {storeData.storeActive === false ? <div className="ui-state"><h2>{messages.ar.storeInactive}</h2></div> : <>
        {isHomeView && categories.length > 0 && <section aria-label={messages.ar.category} className="store-home__section">
          <div className="store-home__section-heading"><h2>تصفحي حسب التصنيف</h2></div>
          <nav className="store-home__category-list">
            {categories.flatMap((category) => category.translations.map((translation) => <Link href={`/ar/categories/${encodeURIComponent(translation.slug)}`} key={translation.slug}>{translation.name}</Link>))}
          </nav>
        </section>}
        <section className={isHomeView ? "store-home__section store-home__catalogue" : "store-catalogue"}>
        <div className="store-home__section-heading">
          <div><h2>{isHomeView ? "أحدث الهدايا والمنتجات" : messages.ar.products}</h2><p>{total} منتج متوفر</p></div>
          {isHomeView && <Link className="store-home__all-link" href="/ar/products">عرض كل المنتجات</Link>}
        </div>
        <div className="store-filter-responsive">
          <div className="store-filter-responsive__desktop"><CatalogFilters categories={categories} categorySlug={categorySlug} query={query} /></div>
          <details className="store-filter-drawer">
            <summary className="store-filter-drawer__trigger"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M7 12h10m-7 6h4" /></svg>{messages.ar.search} وتصنيف</summary>
            <CatalogFilters categories={categories} categorySlug={categorySlug} query={query} />
          </details>
        </div>
        {products.length ? (
          <div className="store-product-grid">
            {products.map((product) => <ProductCard currency={currency} key={product.slug} product={product} />)}
          </div>
        ) : (
          <div className="ui-state">
            <span className="ui-state__symbol" aria-hidden="true">◇</span>
            <h2>{query || categorySlug ? messages.ar.noSearchResults : messages.ar.noProducts}</h2>
          </div>
        )}
        {pages > 1 && (
          <nav aria-label="التنقل بين صفحات المنتجات" className="store-pagination">
            {page > 1 ? <Link href={previousHref}>{messages.ar.previous}</Link> : <span />}
            <span>{messages.ar.page.replace("{page}", String(page)).replace("{pages}", String(pages))}</span>
            {page < pages ? <Link href={nextHref}>{messages.ar.next}</Link> : <span />}
          </nav>
        )}
        </section>
        </>}
        {showSiteStructuredData && <>
          {siteConfig.url && <SeoJsonLd data={{ "@context": "https://schema.org", "@type": "WebSite", name: storeData.name, url: canonicalUrl("/ar", siteConfig.url) ?? undefined }} />}
          {siteConfig.url && <SeoJsonLd data={{
            "@context": "https://schema.org", "@type": "Organization", name: storeData.name, url: siteConfig.url.toString(),
            ...(storeData.ogImage ? { logo: storeData.ogImage } : {}),
            ...(storeData.email || storeData.phone ? { contactPoint: [{ "@type": "ContactPoint", ...(storeData.email ? { email: storeData.email } : {}), ...(storeData.phone ? { telephone: storeData.phone } : {}), contactType: "customer service", availableLanguage: "Arabic" }] } : {}),
          }} />}
        </>}
      </Container>
    </main>
  );
}

function CatalogFilters({ categories, categorySlug, query }: {
  categories: { translations: { name: string; slug: string }[] }[];
  categorySlug: string;
  query: string;
}) {
  return <form action="/ar/search" className="store-filter-row" method="get">
    <Input defaultValue={query} label={messages.ar.search} maxLength={100} name="q" type="search" />
    <Select defaultValue={categorySlug} label={messages.ar.category} name="category">
      <option value="">{messages.ar.allCategories}</option>
      {categories.flatMap((category) => category.translations.map((translation) => <option key={translation.slug} value={translation.slug}>{translation.name}</option>))}
    </Select>
    <Button type="submit" variant="outline">{messages.ar.applySearch}</Button>
  </form>;
}
