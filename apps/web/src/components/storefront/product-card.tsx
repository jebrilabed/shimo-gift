import { SafeProductImage } from "@/components/storefront/safe-product-image";
import Link from "next/link";
import { Prisma } from "@/generated/prisma/client";
import { Badge, Card } from "@/components/ui";
import { formatMoney } from "@/lib/storefront/format";
import { storefrontMessages as messages } from "@/lib/storefront/messages";
import { addToCartAction } from "@/app/[locale]/(store)/actions";
import { StorefrontSubmitButton } from "@/components/storefront/submit-button";
import { FavoriteButton } from "@/components/storefront/favorite-button";

type ProductCardProps = {
  product: {
    slug: string;
    translations: { name: string; slug: string }[];
    images: { url: string; altText: string | null }[];
    category: { translations: { name: string }[] } | null;
    skus: { id: string; price: { toString(): string }; stockQuantity: number; variantOptions: unknown }[];
  };
  currency: string | null;
};

export function ProductCard({ product, currency }: ProductCardProps) {
  const translation = product.translations[0];
  if (!translation) return null;
  const minPrice = product.skus.reduce<Prisma.Decimal | null>((minimum, sku) => {
    const price = new Prisma.Decimal(sku.price.toString());
    return !minimum || price.lessThan(minimum) ? price : minimum;
  }, null)?.toFixed(2) ?? null;
  const stock = product.skus.reduce((sum, sku) => sum + sku.stockQuantity, 0);
  const image = product.images[0];
  const quickAddSku = product.skus.length === 1 && product.skus[0].stockQuantity > 0 ? product.skus[0] : null;

  return (
    <Card className="store-product-card">
      <div className="store-product-card__image">
        <Link className="store-product-card__image-link" href={`/ar/products/${encodeURIComponent(translation.slug)}`} aria-label={translation.name}>
          <span className="store-product-card__image-media">
            {image ? (
              <SafeProductImage alt={image.altText || translation.name} sizes="(max-width: 640px) 50vw, (max-width: 1000px) 33vw, 25vw" src={image.url} />
            ) : (
              <span className="store-product-card__no-image">{messages.ar.noImage}</span>
            )}
          </span>
        </Link>
        <span className="store-product-card__badge-overlay">
          <Badge variant={stock > 0 ? "success" : "error"}>{stock > 0 ? messages.ar.inStock : messages.ar.outOfStock}</Badge>
        </span>
        <FavoriteButton name={translation.name} slug={translation.slug} />
      </div>
      <div className="store-product-card__content">
        {product.category?.translations[0] && <p className="store-product-card__category">{product.category.translations[0].name}</p>}
        <h2><Link href={`/ar/products/${encodeURIComponent(translation.slug)}`}>{translation.name}</Link></h2>
        <div className="store-product-card__footer">
          <div className="store-product-card__price-box">
            {minPrice && currency ? <strong>{formatMoney(minPrice, currency)}</strong> : <span className="store-muted">{currency ? messages.ar.unavailable : messages.ar.currencyUnavailable}</span>}
          </div>
          {quickAddSku ? (
            <form action={addToCartAction} className="store-product-card__quick-add">
              <input name="skuId" type="hidden" value={quickAddSku.id} />
              <input name="quantity" type="hidden" value="1" />
              <StorefrontSubmitButton pendingText={messages.ar.adding}>{messages.ar.addToCart}</StorefrontSubmitButton>
            </form>
          ) : (
            <Link className="store-product-card__action" href={`/ar/products/${encodeURIComponent(translation.slug)}`}>
              {messages.ar.viewProduct}
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}
