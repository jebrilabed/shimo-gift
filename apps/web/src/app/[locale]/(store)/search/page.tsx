import type { Metadata } from "next";
import StorefrontHome from "../page";
import { getPublicSiteData } from "@/lib/seo/site-data";

type SearchProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; category?: string; page?: string; sort?: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  const store = await getPublicSiteData();
  return {
    title: "نتائج البحث", description: store.description, robots: { index: false, follow: true },
    openGraph: { type: "website", title: "نتائج البحث", description: store.description, siteName: store.name, locale: "ar_SA", ...(store.ogImage ? { images: [{ url: store.ogImage, alt: store.name }] } : {}) },
  };
}

export default async function SearchPage({ params, searchParams }: SearchProps) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  return StorefrontHome({ params: Promise.resolve({ locale }), searchParams: Promise.resolve(query), showSiteStructuredData: false, showHomeHero: false });
}
