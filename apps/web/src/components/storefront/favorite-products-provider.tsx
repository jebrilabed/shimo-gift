"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const storageKey = "shimo-gift-favorite-products";
const maximumFavorites = 200;

type FavoriteProductsContextValue = {
  favoriteSlugs: string[];
  isReady: boolean;
  toggleFavorite: (slug: string) => void;
};

const FavoriteProductsContext = createContext<FavoriteProductsContextValue | null>(null);

export function FavoriteProductsProvider({ children }: { children: ReactNode }) {
  const [favoriteSlugs, setFavoriteSlugs] = useState<string[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      const parsed: unknown = stored ? JSON.parse(stored) : [];
      if (Array.isArray(parsed)) {
        setFavoriteSlugs([...new Set(parsed.filter((slug): slug is string => typeof slug === "string" && slug.length > 0 && slug.length <= 120))].slice(0, maximumFavorites));
      }
    } catch {
      // Favorites remain available in memory when browser storage is unavailable.
    }
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!isReady) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(favoriteSlugs));
    } catch {
      // Favorites remain available in memory when browser storage is unavailable.
    }
  }, [favoriteSlugs, isReady]);

  function toggleFavorite(slug: string) {
    if (!isReady) return;
    setFavoriteSlugs((current) => current.includes(slug)
      ? current.filter((favoriteSlug) => favoriteSlug !== slug)
      : current.length < maximumFavorites ? [...current, slug] : current);
  }

  return <FavoriteProductsContext.Provider value={{ favoriteSlugs, isReady, toggleFavorite }}>{children}</FavoriteProductsContext.Provider>;
}

export function useFavoriteProducts() {
  const context = useContext(FavoriteProductsContext);
  if (!context) throw new Error("useFavoriteProducts must be used within FavoriteProductsProvider");
  return context;
}