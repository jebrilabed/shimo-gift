import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FavoritesPage } from "@/components/storefront/favorites-page";
import { isLocale } from "@/lib/i18n/config";

export const metadata: Metadata = { title: "المفضلة" };

export default async function StoreFavoritesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <FavoritesPage />;
}