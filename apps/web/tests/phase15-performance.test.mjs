import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { cloudinaryImageUrl } from "../src/lib/seo/cloudinary-image.mjs";

const source = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("Cloudinary delivery uses responsive format, quality, and width transforms safely", () => {
  assert.equal(
    cloudinaryImageUrl("https://res.cloudinary.com/farasha/image/upload/v1234/catalog/dress.jpg", 640),
    "https://res.cloudinary.com/farasha/image/upload/f_auto,q_auto,w_640/v1234/catalog/dress.jpg",
  );
  assert.equal(cloudinaryImageUrl("https://res.cloudinary.com/farasha/image/upload/c_fill,w_800/v1234/dress.jpg", 320), null);
  assert.equal(cloudinaryImageUrl("https://images.example/dress.jpg", 320), null);
  assert.equal(cloudinaryImageUrl("http://res.cloudinary.com/farasha/image/upload/dress.jpg", 320), null);
  assert.equal(cloudinaryImageUrl("https://user:pass@res.cloudinary.com/farasha/image/upload/dress.jpg", 320), null);
  assert.equal(cloudinaryImageUrl("https://res.cloudinary.com/farasha/image/upload/dress.jpg", 0), null);
});

test("storefront product images use responsive delivery, preserve fallback, and only explicit LCP priority", () => {
  const image = source("../src/components/storefront/safe-product-image.tsx");
  const card = source("../src/components/storefront/product-card.tsx");
  const detail = source("../src/app/[locale]/(store)/products/[slug]/page.tsx");
  assert.equal(image.startsWith('"use client"'), true);
  assert.match(image, /loading=\{priority \? "eager" : "lazy"\}/);
  assert.match(image, /loader=\{imageLoader\}/);
  assert.match(image, /onError=\{\(\) => setFailed\(true\)\}/);
  assert.doesNotMatch(card, /priority/);
  assert.match(detail, /SafeProductImage[^\n]+priority/);
});

test("the optional AI assistant is not mounted in the global storefront layout", () => {
  const layout = source("../src/app/[locale]/(store)/layout.tsx");
  const launcher = source("../src/components/storefront/store-assistant-launcher.tsx");
  const panel = source("../src/components/storefront/store-assistant.tsx");
  assert.doesNotMatch(layout, /StoreAssistantLauncher/);
  assert.doesNotMatch(layout, /assistant\.css/);
  assert.doesNotMatch(layout, /from .*store-assistant"/);
  assert.match(launcher, /lazy\(\(\) => import\("\.\/store-assistant"\)/);
  assert.match(launcher, /loaded && <Suspense/);
  assert.match(panel, /if \(hidden\) return;/);
});

test("public data loaders are request-memoized while catalog data remains request-fresh", () => {
  const siteData = source("../src/lib/seo/site-data.ts");
  const catalogData = source("../src/lib/seo/public-catalog.ts");
  const product = source("../src/app/[locale]/(store)/products/[slug]/page.tsx");
  const category = source("../src/app/[locale]/(store)/categories/[slug]/page.tsx");
  assert.match(siteData, /import \{ cache \} from "react"/);
  assert.match(siteData, /getPublicSiteData = cache\(/);
  assert.match(siteData, /getPublishedFaqs = cache\(/);
  assert.match(catalogData, /getPublishedProductBySlug = cache\(/);
  assert.match(catalogData, /getPublishedCategoryBySlug = cache\(/);
  assert.match(product, /getPublishedProductBySlug\(slug\)/);
  assert.match(category, /getPublishedCategoryBySlug\(slug\)/);
  assert.doesNotMatch(catalogData, /unstable_cache|"use cache"/);
});

test("catalog and admin listings keep server pagination limits", () => {
  const listing = source("../src/app/[locale]/(store)/page.tsx");
  const dashboard = source("../src/app/(admin)/admin/page.tsx");
  const adminProducts = source("../src/app/(admin)/admin/products/page.tsx");
  const adminOrders = source("../src/app/(admin)/admin/orders/page.tsx");
  const inventory = source("../src/app/(admin)/admin/inventory/page.tsx");
  const productManagement = source("../src/components/admin/product-management.tsx");
  assert.match(listing, /skip,\s*take: STOREFRONT_PAGE_SIZE/);
  assert.match(adminProducts, /take: ADMIN_PAGE_SIZE/);
  assert.match(adminOrders, /take: ADMIN_PAGE_SIZE/);
  assert.match(dashboard, /take: 5,\s*select: \{\s*id: true,\s*slug: true,\s*status: true/);
  assert.doesNotMatch(dashboard, /take: 5,\s*include:/);
  assert.match(adminProducts, /loader=\{cloudinaryImageLoader\}/);
  assert.match(inventory, /loader=\{cloudinaryImageLoader\}/);
  assert.match(productManagement, /loader=\{cloudinaryImageLoader\}/);
});

test("category breadcrumbs use one bounded recursive query instead of serial ancestor lookups", () => {
  const publicData = source("../src/lib/seo/site-data.ts");
  assert.match(publicData, /WITH RECURSIVE category_trail AS/);
  assert.match(publicData, /trail\.depth < 11/);
  assert.doesNotMatch(publicData, /for \(let depth = 0; currentId/);
});

test("AI request, tool, and conversation context limits remain bounded", () => {
  const webClient = source("../src/lib/ai/chat-client.ts");
  const aiChat = readFileSync(fileURLToPath(new URL("../../ai/app/services/chat.py", import.meta.url)), "utf8");
  const aiTools = readFileSync(fileURLToPath(new URL("../../ai/app/tools/store_tools.py", import.meta.url)), "utf8");
  assert.match(webClient, /AbortSignal\.timeout\(25_000\)/);
  assert.match(aiChat, /history\[-10:\]/);
  assert.match(aiChat, /timeout=20/);
  assert.match(aiChat, /max_tool_calls: int = 4/);
  assert.match(aiTools, /httpx\.Timeout\(8\.0, connect=3\.0\)/);
});
