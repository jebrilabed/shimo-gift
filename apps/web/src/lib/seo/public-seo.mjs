export function canonicalPath(pathname) {
  if (typeof pathname !== "string" || !pathname.startsWith("/") || pathname.startsWith("//")) return null;
  const clean = pathname.split(/[?#]/, 1)[0].replace(/\/{2,}/g, "/");
  if (clean.includes("\\") || clean.split("/").some((part) => part === "." || part === ".." || /^%2e(?:%2e)?$/i.test(part))) return null;
  return clean.length > 1 ? clean.replace(/\/$/, "") : "/";
}

export function resolveSiteUrl(value, production = false) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname.toLowerCase());
    if (url.username || url.password || url.search || url.hash || production && (url.protocol !== "https:" || local)) return null;
    url.pathname = "/";
    return url;
  } catch {
    return null;
  }
}

export function canonicalUrl(pathname, baseUrl) {
  const path = canonicalPath(pathname);
  if (!path || !(baseUrl instanceof URL) || baseUrl.protocol !== "https:" && baseUrl.hostname !== "localhost" && baseUrl.hostname !== "127.0.0.1") return null;
  const url = new URL(path, baseUrl);
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function buildProductStructuredData({ name, description, image, skus, currency, url }) {
  if (!name || !url || !currency || !Array.isArray(skus) || skus.length === 0) return null;
  const priced = skus.filter((sku) => Number.isFinite(Number(sku.price)) && Number(sku.price) >= 0);
  if (!priced.length) return null;
  const prices = [...new Set(priced.map((sku) => Number(sku.price)))].sort((a, b) => a - b);
  const availability = priced.some((sku) => sku.stockQuantity > 0)
    ? "https://schema.org/InStock"
    : "https://schema.org/OutOfStock";
  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    ...(description ? { description } : {}),
    ...(image ? { image: [image] } : {}),
    ...(prices.length === 1
      ? { offers: { "@type": "Offer", url, priceCurrency: currency, price: prices[0].toFixed(2), availability, itemCondition: "https://schema.org/NewCondition" } }
      : { offers: { "@type": "AggregateOffer", url, priceCurrency: currency, lowPrice: prices[0].toFixed(2), highPrice: prices.at(-1).toFixed(2), offerCount: priced.length, availability } }),
  };
  if (priced.length === 1 && (priced[0].skuCode || priced[0].sku)) {
    data.sku = priced[0].skuCode || priced[0].sku;
  }
  return data;
}

export function buildBreadcrumbData(items, baseUrl) {
  const valid = items.filter((item) => item && typeof item.name === "string" && item.name.trim());
  if (valid.length < 2) return null;
  const elements = valid.map((item, index) => {
    const url = item.path ? canonicalUrl(item.path, baseUrl) : null;
    return { "@type": "ListItem", position: index + 1, name: item.name, ...(url ? { item: url } : {}) };
  });
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: elements };
}

export function serializeJsonLd(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

export function publicPageEntries({ products, categories, pages, hasContact, baseUrl }) {
  const paths = ["/ar", "/ar/products"];
  if (hasContact) paths.push("/ar/contact");
  for (const product of products) paths.push(`/ar/products/${encodeURIComponent(product.slug)}`);
  for (const category of categories) paths.push(`/ar/categories/${encodeURIComponent(category.slug)}`);
  for (const page of pages) paths.push(`/ar/${encodeURIComponent(page.slug)}`);
  return [...new Set(paths)].map((path) => canonicalUrl(path, baseUrl)).filter(Boolean);
}
