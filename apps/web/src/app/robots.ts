import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/"],
    },
    ...(siteConfig.url ? { sitemap: new URL("/sitemap.xml", siteConfig.url).toString() } : {}),
  };
}
