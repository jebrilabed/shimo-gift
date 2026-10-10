"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Container } from "@/components/ui";
import { FavoriteButton } from "@/components/storefront/favorite-button";
import { useFavoriteProducts } from "@/components/storefront/favorite-products-provider";
import { SafeProductImage } from "@/components/storefront/safe-product-image";
import { storefrontMessages as messages } from "@/lib/storefront/messages";

type FavoriteProduct = {
  slug: string;
  name: string;
  image: { url: string; altText: string | null } | null;
  category: string | null;
  price: string | null;
};

type FavoritesResponse = { products: FavoriteProduct[]; currency: string | null };

export function FavoritesPage() {
  const { favoriteSlugs, isReady } = useFavoriteProducts();
  const [products, setProducts] = useState<FavoriteProduct[]>([]);
  const [currency, setCurrency] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    if (favoriteSlugs.length === 0) {
      setProducts([]);
      setIsLoading(false);
      setHasError(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setHasError(false);
    void fetch("/api/storefront/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slugs: favoriteSlugs }),
      cache: "no-store",
    }).then(async (response) => {
      if (!response.ok) throw new Error("favorites-unavailable");
      return response.json() as Promise<FavoritesResponse>;
    }).then((data) => {
      if (cancelled) return;
      const productsBySlug = new Map(data.products.map((product) => [product.slug, product]));
      setProducts(favoriteSlugs.flatMap((slug) => {
        const product = productsBySlug.get(slug);
        return product ? [product] : [];
      }));
      setCurrency(data.currency);
      setIsLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setHasError(true);
      setIsLoading(false);
    });

    return () => { cancelled = true; };
  }, [favoriteSlugs, isReady]);

  return (
    <main className="store-main">
      <Container>
        <header className="store-page-heading">
          <p className="store-muted">{messages.ar.brand}</p>
          <h1>{messages.ar.favorites}</h1>
        </header>
        {!isReady || isLoading ? <p role="status">{messages.ar.loadingFavorites}</p> : null}
        {hasError && <p className="store-alert store-alert--error" role="alert">{messages.ar.favoritesError}</p>}
        {!isLoading && !hasError && products.length === 0 && (
          <div className="ui-state">
            <span className="ui-state__symbol" aria-hidden="true">♡</span>
            <h2>{messages.ar.favoritesEmpty}</h2>
            <p>{messages.ar.favoritesEmptyHint}</p>
            <Link className="ui-button ui-button--primary" href="/ar/products">{messages.ar.browseProducts}</Link>
          </div>
        )}
        {!isLoading && products.length > 0 && (
          <div className="store-product-grid">
            {products.map((product) => (
              <Card className="store-product-card" key={product.slug}>
                <div className="store-product-card__image">
                  <Link aria-label={product.name} className="store-product-card__image-link" href={`/ar/products/${encodeURIComponent(product.slug)}`}>
                    <span className="store-product-card__image-media">
                      {product.image ? <SafeProductImage alt={product.image.altText || product.name} sizes="(max-width: 640px) 50vw, (max-width: 1000px) 33vw, 25vw" src={product.image.url} /> : <span className="store-product-card__no-image">{messages.ar.noImage}</span>}
                    </span>
                  </Link>
                  <FavoriteButton name={product.name} slug={product.slug} />
                </div>
                <div className="store-product-card__content">
                  {product.category && <p className="store-product-card__category">{product.category}</p>}
                  <h2><Link href={`/ar/products/${encodeURIComponent(product.slug)}`}>{product.name}</Link></h2>
                  <div className="store-product-card__footer">
                    {product.price && currency && <div className="store-product-card__price-box"><strong>{new Intl.NumberFormat("ar-SA", { style: "currency", currency }).format(Number(product.price))}</strong></div>}
                    <Link className="store-product-card__action" href={`/ar/products/${encodeURIComponent(product.slug)}`}>{messages.ar.viewProduct}</Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Container>
    </main>
  );
}