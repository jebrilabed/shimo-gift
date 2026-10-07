import { resolveSiteUrl } from "../seo/public-seo.mjs";

export function checkEnvironment(env = process.env) {
  const issues = [];
  const databaseUrl = env.DATABASE_URL || "";
  if (!databaseUrl) issues.push("DATABASE_URL is required.");
  else {
    try {
      const parsed = new URL(databaseUrl);
      if (!(["postgres:", "postgresql:"].includes(parsed.protocol) && parsed.hostname)) issues.push("DATABASE_URL must use PostgreSQL.");
    } catch { issues.push("DATABASE_URL must be a valid PostgreSQL URL."); }
  }
  const authSecret = env.AUTH_SECRET || "";
  if (authSecret.length < 32) issues.push("AUTH_SECRET must contain at least 32 characters.");
  if (env.NODE_ENV === "production") {
    if (!env.SITE_URL) issues.push("SITE_URL is required in production.");
    else if (!resolveSiteUrl(env.SITE_URL, true)) issues.push("SITE_URL must be a public HTTPS URL without credentials, query, or fragment.");
  }
  return issues;
}
