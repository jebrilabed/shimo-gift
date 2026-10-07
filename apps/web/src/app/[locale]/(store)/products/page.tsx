import type { Metadata } from "next";
import StorefrontHome from "../page";
import { siteConfig } from "@/lib/config/site";
import { getPublicSiteData } from "@/lib/seo/site-data";
import { canonicalUrl } from "@/lib/seo/public-seo.mjs";

export async function generateMetadata({ searchParams }: Parameters<typeof StorefrontHome>[0]): Promise<Metadata> {
  const params = await searchParams;
  const filtered = Boolean(params.q?.trim() || params.category?.trim() || params.page || params.sort);
  const store = await getPublicSiteData();
  const canonical = canonicalUrl("/ar/products", siteConfig.url);
  const title = "المنتجات";
  const description = store.description;
  return {
    title,
    description,
    ...(canonical ? { alternates: { canonical } } : {}),
    openGraph: { type: "website", title, description, siteName: store.name, locale: "ar_SA", ...(canonical ? { url: canonical } : {}), ...(store.ogImage ? { images: [{ url: store.ogImage, alt: store.name }] } : {}) },
    twitter: { card: store.ogImage ? "summary_large_image" : "summary", title, description, ...(store.ogImage ? { images: [store.ogImage] } : {}) },
    ...(filtered ? { robots: { index: false, follow: true } } : {}),
  };
}

export default function ProductsPage(props: Parameters<typeof StorefrontHome>[0]) {
  return StorefrontHome({ ...props, showSiteStructuredData: false, showHomeHero: false });
}
