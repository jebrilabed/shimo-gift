import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { parseContentPageInput, parseFaqInput } from "../src/lib/admin/content-validation.mjs";
import { planSlugRedirects } from "../src/lib/seo/slug-redirect-plan.mjs";
import { buildBreadcrumbData, buildProductStructuredData, canonicalPath, canonicalUrl, publicPageEntries, resolveSiteUrl, serializeJsonLd } from "../src/lib/seo/public-seo.mjs";

function form(values) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, String(value));
  return data;
}

test("canonical URLs preserve public locale routes and drop query/hash", () => {
  const base = new URL("https://shop.example/");
  assert.equal(canonicalPath("/ar/products/abaya/?sort=price#top"), "/ar/products/abaya");
  assert.equal(canonicalUrl("/ar/products/abaya/?sort=price#top", base), "https://shop.example/ar/products/abaya");
  assert.equal(canonicalUrl("//other.example/path", base), null);
  assert.equal(canonicalUrl("/ar", null), null);
  assert.equal(canonicalUrl("/ar/../admin", base), null);
  assert.equal(resolveSiteUrl("https://localhost", true), null);
  assert.equal(resolveSiteUrl("http://localhost:3000/path", false).origin, "http://localhost:3000");
  assert.equal(resolveSiteUrl("https://user:secret@shop.example", true), null);
});

test("Arabic content slugs are accepted, unsafe and reserved paths are rejected", () => {
  const valid = parseContentPageInput(form({ pageKey: "shipping-policy", titleAr: "سياسة الشحن", slugAr: "سياسة-الشحن", bodyAr: "نص السياسة" }));
  assert.equal(valid.ok, true);
  assert.equal(valid.value.isActive, false);
  assert.equal(parseContentPageInput(form({ pageKey: "faq", titleAr: "أسئلة", slugAr: "faq", bodyAr: "نص" })).ok, false);
  assert.equal(parseContentPageInput(form({ pageKey: "contact", titleAr: "تواصل", slugAr: "../admin", bodyAr: "نص" })).ok, false);
});

test("English content must be complete and is never synthesized", () => {
  const partial = parseContentPageInput(form({ pageKey: "terms", titleAr: "الشروط", slugAr: "terms", bodyAr: "النص", titleEn: "Terms" }));
  assert.equal(partial.ok, false);
  assert.equal(partial.errors.slugEn, "translationIncomplete");
  const arOnly = parseContentPageInput(form({ pageKey: "terms", titleAr: "الشروط", slugAr: "terms", bodyAr: "النص" }));
  assert.equal(arOnly.ok, true);
  assert.equal(arOnly.value.en, null);
});

test("FAQ validation bounds ordering and keeps localized question and answer together", () => {
  const invalid = parseFaqInput(form({ questionAr: "سؤال", answerAr: "جواب", questionEn: "Question", sortOrder: "1.5" }));
  assert.equal(invalid.ok, false);
  assert.equal(invalid.errors.answerEn, "translationIncomplete");
  assert.equal(invalid.errors.sortOrder, "invalidOrder");
  const valid = parseFaqInput(form({ questionAr: "سؤال", answerAr: "جواب", sortOrder: 4, isActive: "on" }));
  assert.equal(valid.ok, true);
  assert.equal(valid.value.sortOrder, 4);
  assert.equal(valid.value.isActive, true);
});

test("single and variant product offers use only current SKU prices and availability", () => {
  const single = buildProductStructuredData({ name: "عباءة", description: "وصف ظاهر", image: "https://images.example/abaya.jpg", skus: [{ skuCode: "AB-1", price: "99.50", stockQuantity: 0 }], currency: "SAR", url: "https://shop.example/ar/products/عباءة" });
  assert.equal(single.offers["@type"], "Offer");
  assert.equal(single.offers.price, "99.50");
  assert.equal(single.offers.availability, "https://schema.org/OutOfStock");
  assert.equal(single.sku, "AB-1");
  assert.equal("aggregateRating" in single, false);
  const variants = buildProductStructuredData({ name: "عباءة", skus: [{ price: "99", stockQuantity: 2 }, { price: "129", stockQuantity: 0 }], currency: "SAR", url: "https://shop.example/ar/products/عباءة" });
  assert.equal(variants.offers["@type"], "AggregateOffer");
  assert.equal(variants.offers.lowPrice, "99.00");
  assert.equal(variants.offers.highPrice, "129.00");
  assert.equal(variants.offers.availability, "https://schema.org/InStock");
  assert.equal(buildProductStructuredData({ name: "عباءة", skus: [{ price: "20", stockQuantity: 1 }], currency: null, url: "https://shop.example/ar/products/abaya" }), null);
});

test("JSON-LD serialization escapes script-breaking text and breadcrumb data matches public paths", () => {
  const value = { name: "</script><script>alert(1)</script>" };
  const serialized = serializeJsonLd(value);
  assert.equal(serialized.includes("</script>"), false);
  assert.equal(JSON.parse(serialized).name, value.name);
  const breadcrumbs = buildBreadcrumbData([{ name: "فراشة", path: "/ar" }, { name: "المنتجات", path: "/ar/products" }, { name: "منتج" }], new URL("https://shop.example"));
  assert.deepEqual(breadcrumbs.itemListElement.map((item) => item.position), [1, 2, 3]);
  assert.equal(breadcrumbs.itemListElement[1].item, "https://shop.example/ar/products");
  assert.equal("item" in breadcrumbs.itemListElement[2], false);
});

test("public URL list is Arabic-only, deduplicated, and uses canonical paths", () => {
  const urls = publicPageEntries({ products: [{ slug: "abaya" }], categories: [{ slug: "abayas" }], pages: [{ slug: "shipping-policy" }, { slug: "contact" }], hasContact: true, baseUrl: new URL("https://shop.example") });
  assert.equal(new Set(urls).size, urls.length);
  assert.equal(urls.includes("https://shop.example/ar/faq"), false);
  assert.ok(urls.includes("https://shop.example/ar/products/abaya"));
  assert.ok(urls.includes("https://shop.example/ar/shipping-policy"));
  assert.equal(urls.some((url) => url.includes("/en/")), false);
});

test("slug rename flattens old redirects, frees the new canonical slug, and avoids chains", () => {
  const plan = planSlugRedirects([
    { oldSlug: "first", newSlug: "current" },
    { oldSlug: "current", newSlug: "older-target" },
    { oldSlug: "next", newSlug: "elsewhere" },
  ], "current", "next");
  assert.deepEqual(plan.updates, [{ oldSlug: "first", newSlug: "next" }]);
  assert.deepEqual(plan.removals, ["next"]);
  assert.deepEqual(plan.redirect, { oldSlug: "current", newSlug: "next" });
  assert.equal(plan.redirect.oldSlug === plan.redirect.newSlug, false);
});

test("sitemap and robots expose only intended public routes while noindex pages stay crawlable", () => {
  const sitemap = readFileSync(new URL("../src/app/sitemap.ts", import.meta.url), "utf8");
  const robots = readFileSync(new URL("../src/app/robots.ts", import.meta.url), "utf8");
  assert.match(sitemap, /ProductStatus\.ACTIVE/);
  assert.match(sitemap, /status:\s*"ACTIVE"/);
  assert.match(sitemap, /contentPage:\s*\{\s*isActive:\s*true\s*\}/);
  assert.match(sitemap, /Locale\.AR/);
  assert.doesNotMatch(sitemap, /\/ar\/faq/);
  assert.doesNotMatch(sitemap, /\/en\//);
  assert.match(robots, /disallow:\s*\["\/admin",\s*"\/api\/"\]/);
  assert.doesNotMatch(robots, /"\/ar\/(?:cart|checkout|search|account)/);
});

test("content writes are guarded by server-side admin authorization and public queries exclude drafts", () => {
  const actions = readFileSync(new URL("../src/app/(admin)/admin/content/actions.ts", import.meta.url), "utf8");
  const publicPage = readFileSync(new URL("../src/app/[locale]/(store)/[slug]/page.tsx", import.meta.url), "utf8");
  const publicData = readFileSync(new URL("../src/lib/seo/site-data.ts", import.meta.url), "utf8");
  assert.match(actions, /executeAdminMutation\(requireAdmin, operation\)/);
  assert.match(publicPage, /contentPage:\s*\{\s*isActive:\s*true\s*\}/);
  assert.match(publicData, /where:\s*\{\s*isActive:\s*true, translations:/);
});
