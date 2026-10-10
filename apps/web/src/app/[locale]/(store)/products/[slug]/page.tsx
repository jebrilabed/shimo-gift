import { notFound, permanentRedirect } from "next/navigation";
import { Badge, Container, Input, Select } from "@/components/ui";
import { Prisma } from "@/generated/prisma/client";
import { StorefrontSubmitButton } from "@/components/storefront/submit-button";
import { addToCartAction } from "../../actions";
import { isLocale } from "@/lib/i18n/config";
import { decodeRouteSlug } from "@/lib/i18n/route-slug";
import { Locale, ProductStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { displayVariantOptions, formatMoney } from "@/lib/storefront/format";
import { storefrontMessages as messages } from "@/lib/storefront/messages";
import type { Metadata } from "next";
import { SafeProductImage } from "@/components/storefront/safe-product-image";
import { siteConfig } from "@/lib/config/site";
import { getPublicCategoryTrail, getPublicSiteData, ogImageFromImages } from "@/lib/seo/site-data";
import { getPublishedProductBySlug } from "@/lib/seo/public-catalog";
import { buildBreadcrumbData, buildProductStructuredData, canonicalUrl } from "@/lib/seo/public-seo.mjs";
import { SeoJsonLd, StoreBreadcrumbs } from "@/components/storefront/seo-json-ld";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { slug: routeSlug, locale } = await params;
  if (!isLocale(locale)) return {};
  const slug = decodeRouteSlug(routeSlug);
  const product = await getPublishedProductBySlug(slug);
  const translation = product?.translations[0];
  if (!product || !translation) return { robots: { index: false, follow: true } };
  const store = await getPublicSiteData();
  const title = translation.seoTitle || product.seoTitle || translation.name;
  const description = translation.seoDescription || product.seoDescription || translation.description || store.description;
  const canonical = canonicalUrl(`/ar/products/${encodeURIComponent(slug)}`, siteConfig.url);
  const images = ogImageFromImages(product.images, store.ogImage);
  return {
    title,
    description,
    ...(canonical ? { alternates: { canonical } } : {}),
    openGraph: {
      type: "website",
      title, description, siteName: store.name, locale: "ar_SA",
      ...(canonical ? { url: canonical } : {}), ...(images.length ? { images } : {}),
    },
    twitter: { card: images.length ? "summary_large_image" : "summary", title, description, ...(images.length ? { images: images.map((image) => image.url) } : {}) },
  };
}

export default async function ProductDetails({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug: routeSlug } = await params;
  if (!isLocale(locale)) notFound();
  const slug = decodeRouteSlug(routeSlug);
  const [product, storeData] = await Promise.all([getPublishedProductBySlug(slug), getPublicSiteData()]);
  if (!product?.translations[0]) {
    const redirectRecord = await prisma.slugRedirect.findFirst({ where: { resourceType: "PRODUCT", locale: Locale.AR, oldSlug: slug }, select: { newSlug: true } });
    if (redirectRecord?.newSlug && redirectRecord.newSlug !== slug) {
      const target = await prisma.productTranslation.findFirst({ where: { locale: Locale.AR, slug: redirectRecord.newSlug, product: { status: ProductStatus.ACTIVE, OR: [{ categoryId: null }, { category: { is: { status: "ACTIVE" } } }] } }, select: { slug: true } });
      if (target) permanentRedirect(`/ar/products/${encodeURIComponent(target.slug)}`);
    }
    notFound();
  }
  if (storeData.storeActive === false) notFound();
  const translation = product.translations[0];
  const firstImage = product.images[0];
  const store = storeData;
  const currency = storeData.currency;
  const categoryTrail = await getPublicCategoryTrail(product.categoryId);
  const productPath = `/ar/products/${encodeURIComponent(translation.slug)}`;
  const canonical = canonicalUrl(productPath, siteConfig.url);
  const purchasable = product.skus.filter((sku) => sku.stockQuantity > 0);
  const totalStock = product.skus.reduce((total, sku) => total + sku.stockQuantity, 0);
  const selectableSkus = product.skus.length ? product.skus : [];
  const minimumPrice = selectableSkus.reduce<Prisma.Decimal | null>((minimum, sku) =>
    !minimum || sku.price.lessThan(minimum) ? sku.price : minimum, null);
  const breadcrumbs = [
    { name: store.name, path: "/ar" },
    { name: messages.ar.products, path: "/ar/products" },
    ...categoryTrail.map((category) => ({ name: category.name, path: `/ar/categories/${encodeURIComponent(category.slug)}` })),
    { name: translation.name, path: productPath },
  ];
  const productData = buildProductStructuredData({
    name: translation.name,
    description: translation.description,
    image: firstImage?.url && firstImage.url.startsWith("https://") ? firstImage.url : null,
    skus: selectableSkus.map((sku) => ({ price: sku.price.toString(), stockQuantity: sku.stockQuantity })),
    currency,
    url: canonical,
  });

  return (
    <main className="store-main">
      <Container>
        <StoreBreadcrumbs items={breadcrumbs} jsonLd={buildBreadcrumbData(breadcrumbs, siteConfig.url)} />
        {productData && <SeoJsonLd data={productData} />}
        <article className="store-product-detail">
          <div className="store-product-detail__gallery">
            <div className="store-product-detail__image">
              <span className="store-product-detail__image-media">
                {firstImage ? <SafeProductImage alt={firstImage.altText || translation.name} sizes="(max-width: 960px) 100vw, 50vw" priority src={firstImage.url} /> : <span className="store-image-empty">{messages.ar.noImage}</span>}
              </span>
            </div>
            {product.images.length > 1 && <div className="store-product-detail__thumbnails">{product.images.slice(1).map((image, index) => <div className="store-product-detail__thumbnail" key={`${image.url}-${index}`}><SafeProductImage alt={image.altText || `${translation.name} ${index + 2}`} sizes="84px" src={image.url} /></div>)}</div>}
          </div>
          <div className="store-product-detail__content">
            <header className="store-page-heading">
              {categoryTrail.at(-1)?.name && <p className="store-muted">{categoryTrail.at(-1)?.name}</p>}
              <h1>{translation.name}</h1>
              {minimumPrice && currency ? <p className="store-price">{messages.ar.startingAt} {formatMoney(minimumPrice, currency)}</p> : <p className="store-muted">{messages.ar.currencyUnavailable}</p>}
              <Badge variant={totalStock > 0 ? "success" : "error"}>{totalStock > 0 ? messages.ar.inStock : messages.ar.outOfStock}</Badge>
              {totalStock > 0 && totalStock <= 5 && <p className="store-muted">{messages.ar.limitedStock.replace("{quantity}", String(totalStock))}</p>}
            </header>
            {translation.description && <section className="store-description"><h2>{messages.ar.description}</h2><p>{translation.description}</p></section>}
            {purchasable.length > 0 && currency ? (
              <form action={addToCartAction} className="store-form">
                {selectableSkus.length > 1 && (
                  <Select label={messages.ar.variant} name="skuId" required>
                    <option disabled value="">{messages.ar.chooseVariant}</option>
                    {selectableSkus.map((sku, index) => {
                      const label = displayVariantOptions(sku.variantOptions) || `${messages.ar.variant} ${index + 1}`;
                      const availability = sku.stockQuantity > 0 ? ` — ${formatMoney(sku.price, currency)}` : ` — ${formatMoney(sku.price, currency)} · ${messages.ar.outOfStock}`;
                      return <option disabled={sku.stockQuantity <= 0} key={sku.id} value={sku.id}>{label}{availability}</option>;
                    })}
                  </Select>
                )}
                {selectableSkus.length === 1 && <input name="skuId" type="hidden" value={selectableSkus[0].id} />}
                <Input defaultValue={1} label={messages.ar.quantity} max={Math.max(...purchasable.map((sku) => sku.stockQuantity))} min={1} name="quantity" required type="number" />
                <StorefrontSubmitButton pendingText={messages.ar.adding} disabled={totalStock <= 0}>{messages.ar.addToCart}</StorefrontSubmitButton>
              </form>
            ) : <p className="store-alert">{purchasable.length ? messages.ar.currencyNotConfigured : messages.ar.outOfStock}</p>}
          </div>
        </article>
      </Container>
    </main>
  );
}
