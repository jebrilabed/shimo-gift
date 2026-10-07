import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getLocaleDirection, isLocale } from "@/lib/i18n/config";
import { siteConfig } from "@/lib/config/site";
import { getPublicSiteData } from "@/lib/seo/site-data";
import { StorefrontHeader } from "@/components/storefront/storefront-header";
import { StorefrontFooter } from "@/components/storefront/storefront-footer";
import { StoreAssistantLauncher } from "@/components/storefront/store-assistant-launcher";
import "../globals.css";
import "./storefront.css";
import "./assistant.css";

type LocaleLayoutProps = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: LocaleLayoutProps): Promise<Metadata> {
  const { locale } = await params;

  if (!isLocale(locale)) {
    return {};
  }

  const store = await getPublicSiteData();
  return {
    ...(siteConfig.url ? { metadataBase: siteConfig.url } : {}),
    title: { default: store.name, template: `%s | ${store.name}` },
    description: store.description,
    applicationName: store.name,
    openGraph: {
      type: "website",
      siteName: store.name,
      locale: "ar_SA",
      title: store.name,
      description: store.description,
    },
    twitter: { card: store.ogImage ? "summary_large_image" : "summary" },
  };
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return (
    <html lang={locale} dir={getLocaleDirection(locale)} data-scroll-behavior="smooth">
      <body>
        <StorefrontHeader />
        {children}
        <StoreAssistantLauncher locale={locale} />
        <StorefrontFooter />
      </body>
    </html>
  );
}
