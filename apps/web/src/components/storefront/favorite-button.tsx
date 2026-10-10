"use client";

import { useFavoriteProducts } from "@/components/storefront/favorite-products-provider";

export function FavoriteButton({ slug, name }: { slug: string; name: string }) {
  const { favoriteSlugs, isReady, toggleFavorite } = useFavoriteProducts();
  const isFavorite = favoriteSlugs.includes(slug);
  const label = isFavorite ? `إزالة ${name} من المفضلة` : `إضافة ${name} إلى المفضلة`;

  return (
    <button
      aria-label={label}
      aria-pressed={isFavorite}
      className={`store-favorite-button${isFavorite ? " is-favorite" : ""}`}
      disabled={!isReady}
      onClick={() => toggleFavorite(slug)}
      title={label}
      type="button"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" fill={isFavorite ? "currentColor" : "none"}>
        <path d="M20.8 8.8c0 5.1-8.8 11-8.8 11s-8.8-5.9-8.8-11A4.8 4.8 0 0 1 12 6.1a4.8 4.8 0 0 1 8.8 2.7Z" />
      </svg>
    </button>
  );
}