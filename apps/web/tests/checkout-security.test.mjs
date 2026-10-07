import assert from "node:assert/strict";
import test from "node:test";
import { calculateCheckoutAmounts } from "../src/lib/storefront/checkout-pricing.mjs";
import {
  checkoutOwnerBinding,
  createCheckoutAttemptToken,
  verifyCheckoutAttemptToken,
  checkoutQuoteMatches,
} from "../src/lib/storefront/checkout-security.mjs";
import { parseCheckoutInput } from "../src/lib/storefront/order-workflow.mjs";

const secret = "development-only-test-secret-with-enough-length";
const quoteItems = [
  { skuId: "sku-b", quantity: 2, unitPrice: "0.20" },
  { skuId: "sku-a", quantity: 3, unitPrice: "0.10" },
];

function createAttempt(owner = checkoutOwnerBinding(secret, "guest", "guest-hash-a"), overrides = {}) {
  return createCheckoutAttemptToken({
    secret,
    ownerBinding: owner,
    cartId: "internal-cart-id",
    currency: "SAR",
    items: quoteItems,
    now: 1_800_000_000_000,
    ...overrides,
  });
}

test("checkout tokens are signed, owner-bound, time-limited, and hide internal cart identity", () => {
  const owner = checkoutOwnerBinding(secret, "guest", "guest-hash-a");
  const attempt = createAttempt(owner);
  assert.ok(attempt);
  assert.equal(attempt.expiresAt, 1_800_007_200_000);
  const decodedPayload = Buffer.from(attempt.token.split(".")[0], "base64url").toString("utf8");
  assert.equal(decodedPayload.includes("internal-cart-id"), false);

  const verified = verifyCheckoutAttemptToken(attempt.token, secret, owner, 1_800_000_000_001);
  assert.ok(verified);
  assert.equal(verified.idempotencyKey.length, 64);
  assert.equal(verifyCheckoutAttemptToken(attempt.token, secret, checkoutOwnerBinding(secret, "guest", "guest-hash-b"), 1_800_000_000_001), null);
  assert.equal(verifyCheckoutAttemptToken(attempt.token, secret, owner, 1_800_007_200_001), null);
  assert.equal(verifyCheckoutAttemptToken(`${attempt.token}A`, secret, owner, 1_800_000_000_001), null);
});

test("separate checkout attempts get distinct keys while a retry reuses its key", () => {
  const owner = checkoutOwnerBinding(secret, "customer", "user-123");
  const first = createAttempt(owner);
  const second = createAttempt(owner);
  assert.notEqual(first.token, second.token);

  const firstRetry = verifyCheckoutAttemptToken(first.token, secret, owner, 1_800_000_000_001);
  const secondRetry = verifyCheckoutAttemptToken(first.token, secret, owner, 1_800_000_000_001);
  const separateAttempt = verifyCheckoutAttemptToken(second.token, secret, owner, 1_800_000_000_001);
  assert.equal(firstRetry.idempotencyKey, secondRetry.idempotencyKey);
  assert.notEqual(firstRetry.idempotencyKey, separateAttempt.idempotencyKey);
});

test("checkout quote detects changed prices, quantities, and SKU lines", () => {
  const attempt = createAttempt();
  const verified = verifyCheckoutAttemptToken(attempt.token, secret, checkoutOwnerBinding(secret, "guest", "guest-hash-a"), 1_800_000_000_001);
  assert.equal(checkoutQuoteMatches(verified.quote.items, [...quoteItems].reverse()), true);
  assert.equal(checkoutQuoteMatches(verified.quote.items, [{ ...quoteItems[0], unitPrice: "0.21" }, quoteItems[1]]), false);
  assert.equal(checkoutQuoteMatches(verified.quote.items, [{ ...quoteItems[0], quantity: 1 }, quoteItems[1]]), false);
});

test("checkout totals use decimal-safe current prices and shipping", () => {
  assert.deepEqual(calculateCheckoutAmounts([
    { unitPrice: "0.10", quantity: 3 },
    { unitPrice: "0.20", quantity: 2 },
  ]), {
    lineSubtotals: ["0.30", "0.40"],
    subtotal: "0.70",
    shipping: "0.00",
    total: "0.70",
  });
  assert.equal(calculateCheckoutAmounts([{ unitPrice: "99.99", quantity: 3 }], "5.00").total, "304.97");
  assert.equal(calculateCheckoutAmounts([{ unitPrice: "1.00", quantity: 1 }], "-1.00"), null);
});

test("checkout form parsing ignores client prices, totals, stock, and owner identifiers", () => {
  const form = new FormData();
  form.set("contactName", "سارة");
  form.set("contactPhone", "+966 50 123 4567");
  form.set("address", "شارع النخيل");
  form.set("city", "الرياض");
  form.set("customerNote", "");
  form.set("price", "0.01");
  form.set("total", "0.01");
  form.set("stock", "999999");
  form.set("userId", "another-customer");
  form.set("customerId", "another-customer-record");
  form.set("ownerId", "another-owner");
  const parsed = parseCheckoutInput(form);
  assert.equal(parsed.ok, true);
  assert.equal("price" in parsed.value, false);
  assert.equal("total" in parsed.value, false);
  assert.equal("stock" in parsed.value, false);
  assert.equal("userId" in parsed.value, false);
  assert.equal("customerId" in parsed.value, false);
  assert.equal("ownerId" in parsed.value, false);
});
