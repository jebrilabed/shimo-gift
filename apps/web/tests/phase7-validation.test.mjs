import assert from "node:assert/strict";
import test from "node:test";
import { parseAddress, parseImage, parseRegistration, parseSku, parseStoreSettings, supportedCurrencies } from "../src/lib/phase7/validation.mjs";
import { checkEnvironment } from "../src/lib/config/environment-readiness.mjs";
import { parseCategoryInput, parseProductInput } from "../src/lib/admin/catalog-validation.mjs";

function form(values) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

test("registration normalizes email and never accepts a client role", () => {
  const parsed = parseRegistration(form({ name: " Sara ", email: "SARA@example.com", password: "Pass1234", confirmation: "Pass1234", role: "ADMIN" }));
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.value, { name: "Sara", email: "sara@example.com", password: "Pass1234" });
  assert.equal("role" in parsed.value, false);
});

test("registration rejects short or mismatched passwords", () => {
  assert.equal(parseRegistration(form({ name: "Sara", email: "sara@example.com", password: "short", confirmation: "different" })).ok, false);
  assert.equal(parseRegistration(form({ name: "Sara", email: "sara@example.com", password: "Pass123", confirmation: "Pass123" })).ok, false);
});

test("customer address validation requires bounded contact and location data", () => {
  const parsed = parseAddress(form({ fullName: "Sara", phone: "+966 500000000", addressLine: "Street 1", city: "Riyadh", isDefault: "on" }));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.value.isDefault, true);
  assert.equal(parseAddress(form({ fullName: "", phone: "x", addressLine: "", city: "" })).ok, false);
});

test("store settings always use Israeli shekels and Arabic locale", () => {
  const base = { storeName: "Farasha", currency: "SAR", defaultLocale: "ar", isActive: "on" };
  assert.equal(parseStoreSettings(form(base)).ok, true);
  assert.equal(parseStoreSettings(form({ ...base, currency: "BAD" })).value.currency, "ILS");
  assert.equal(parseStoreSettings(form({ ...base, currency: "ILS" })).value.currency, "ILS");
  assert.deepEqual(supportedCurrencies, ["SAR", "USD", "EUR", "ILS", "JOD"]);
});

test("SKU validation blocks negative values and malformed variant JSON", () => {
  const base = { skuCode: "DRESS-RED", price: "10.50", stockQuantity: "4", variantOptions: '{"color":"red"}', isActive: "on" };
  assert.equal(parseSku(form(base)).ok, true);
  assert.equal(parseSku(form({ ...base, stockQuantity: "-1" })).ok, false);
  assert.equal(parseSku(form({ ...base, price: "-1" })).ok, false);
  assert.equal(parseSku(form({ ...base, variantOptions: "[]" })).ok, false);
});

test("product images require credential-free HTTPS URLs", () => {
  assert.equal(parseImage(form({ url: "https://cdn.example.com/product.jpg", altText: "Dress" })).ok, true);
  assert.equal(parseImage(form({ url: "http://cdn.example.com/product.jpg" })).ok, false);
  assert.equal(parseImage(form({ url: "https://user:pass@example.com/product.jpg" })).ok, false);
});

test("product and category SEO fields are saved as bounded plain text", () => {
  const product = parseProductInput(form({
    nameAr: "فستان", slug: "dress", skuCode: "DRESS-1", price: "10", stockQuantity: "2",
    seoTitleAr: "عنوان مناسب", seoDescriptionAr: "وصف مناسب", seoTitleEn: "Dress title", seoDescriptionEn: "Dress description",
  }));
  assert.equal(product.ok, true);
  assert.equal(product.value.seoTitleEn, "Dress title");
  assert.equal(parseProductInput(form({ nameAr: "فستان", slug: "dress", skuCode: "DRESS-1", price: "10", stockQuantity: "2", seoTitleAr: "x".repeat(181) })).ok, false);
  const category = parseCategoryInput(form({ nameAr: "ملابس", slug: "clothes", seoTitleAr: "عنوان التصنيف", seoDescriptionAr: "وصف التصنيف" }));
  assert.equal(category.ok, true);
  assert.equal(category.value.seoDescriptionAr, "وصف التصنيف");
  assert.equal(parseCategoryInput(form({ nameAr: "ملابس", slug: "clothes", seoDescriptionEn: "x".repeat(501) })).ok, false);
});

test("production environment validation reports configuration only, never secret values", () => {
  const incomplete = checkEnvironment({ NODE_ENV: "production", DATABASE_URL: "", AUTH_SECRET: "short" });
  assert.equal(incomplete.length >= 2, true);
  assert.equal(incomplete.some((issue) => issue.includes("short")), false);
  assert.deepEqual(checkEnvironment({ NODE_ENV: "production", DATABASE_URL: "postgresql://db.example/farasha", AUTH_SECRET: "x".repeat(40), SITE_URL: "https://farasha.example" }), []);
});
