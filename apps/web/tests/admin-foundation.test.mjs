import test from "node:test";
import assert from "node:assert/strict";
import { parseCategoryInput, parseInventoryInput, parseProductInput } from "../src/lib/admin/catalog-validation.mjs";
import { executeAdminMutation } from "../src/lib/admin/execute-admin-mutation.mjs";

function form(values) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null) data.set(key, String(value));
  }
  return data;
}

const validProduct = {
  nameAr: "  فستان فراشة  ", nameEn: "Butterfly Dress", slug: "butterfly-dress", skuCode: "FAR-001",
  price: "125.50", compareAtPrice: "150", stockQuantity: "12", categoryId: "cat_123", imageUrls: "https://cdn.example.test/dress.jpg",
  descriptionAr: "وصف", descriptionEn: "Description", isActive: "on",
};

test("product input trims text, normalizes slug, and accepts valid catalog fields", () => {
  const parsed = parseProductInput(form(validProduct));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.value.nameAr, "فستان فراشة");
  assert.equal(parsed.value.slug, "butterfly-dress");
  assert.equal(parsed.value.price, "125.50");
  assert.deepEqual(parsed.value.imageUrls, ["https://cdn.example.test/dress.jpg"]);
});

test("product validation rejects empty names, bad slugs, negative prices, and fractional stock", () => {
  const parsed = parseProductInput(form({ ...validProduct, nameAr: "  ", slug: "bad slug", price: "-1", stockQuantity: "1.5" }));
  assert.equal(parsed.ok, false);
  assert.deepEqual(Object.keys(parsed.errors).sort(), ["nameAr", "price", "slug", "stockQuantity"]);
});

test("product validation rejects compare-at values below price and non-HTTPS images", () => {
  const parsed = parseProductInput(form({ ...validProduct, compareAtPrice: "100", imageUrls: "http://example.test/image.jpg" }));
  assert.equal(parsed.ok, false);
  assert.equal(parsed.errors.compareAtPrice, "comparePriceBelowPrice");
  assert.equal(parsed.errors.imageUrls, "invalidImageUrl");
});

test("category validation requires a trimmed name and valid slug", () => {
  const valid = parseCategoryInput(form({ nameAr: " فساتين ", slug: "dresses", isActive: "on" }));
  assert.equal(valid.ok, true);
  assert.equal(valid.value.nameAr, "فساتين");
  const invalid = parseCategoryInput(form({ nameAr: " ", slug: "bad/slug" }));
  assert.equal(invalid.ok, false);
  assert.equal(invalid.errors.nameAr, "required");
  assert.equal(invalid.errors.slug, "invalidSlug");
});

test("inventory input accepts zero and rejects negative and fractional quantities", () => {
  assert.equal(parseInventoryInput(form({ skuId: "sku_1", productId: "prod_1", quantity: "0" })).ok, true);
  assert.equal(parseInventoryInput(form({ skuId: "sku_1", productId: "prod_1", quantity: "-1" })).ok, false);
  assert.equal(parseInventoryInput(form({ skuId: "sku_1", productId: "prod_1", quantity: "3.2" })).ok, false);
});

test("unauthenticated and CUSTOMER actors cannot enter an admin mutation", async () => {
  let mutations = 0;
  const unauthenticated = await executeAdminMutation(async () => {
    const error = new Error("signed out"); error.name = "AuthenticationRequiredError"; throw error;
  }, async () => { mutations += 1; });
  const customer = await executeAdminMutation(async () => {
    const error = new Error("not admin"); error.name = "AuthorizationDeniedError"; throw error;
  }, async () => { mutations += 1; });
  assert.deepEqual(unauthenticated, { ok: false, reason: "unauthenticated" });
  assert.deepEqual(customer, { ok: false, reason: "forbidden" });
  assert.equal(mutations, 0);
});

test("ADMIN authorization completes before the mutation callback", async () => {
  const actor = { id: "admin_1", role: "ADMIN" };
  const result = await executeAdminMutation(async () => actor, async (admin) => ({ actorId: admin.id }));
  assert.deepEqual(result, { ok: true, value: { actorId: "admin_1" } });
});
