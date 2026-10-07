import { resolveSiteUrl } from "@/lib/seo/public-seo.mjs";

const defaultSiteUrl = "http://localhost:3000";
const production = process.env.NODE_ENV === "production";

function readSiteUrl(value: string | undefined): URL | null {
  return resolveSiteUrl(value, production) ?? (production ? null : new URL(defaultSiteUrl));
}

export const siteConfig = {
  name: "Shimo Gift",
  url: readSiteUrl(process.env.SITE_URL),
} as const;
