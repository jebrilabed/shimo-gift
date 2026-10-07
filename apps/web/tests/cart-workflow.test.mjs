import test from "node:test";
import assert from "node:assert/strict";
import { mergeCartQuantity } from "../src/lib/storefront/cart-workflow.mjs";

test("cart merge adds distinct quantities when stock is sufficient", () => {
  assert.equal(mergeCartQuantity(2, 3, 8), 5);
});

test("cart merge clamps combined quantity to current stock", () => {
  assert.equal(mergeCartQuantity(4, 5, 6), 6);
});

test("cart merge removes items when stock is zero", () => {
  assert.equal(mergeCartQuantity(2, 1, 0), 0);
});

test("cart merge rejects malformed quantities", () => {
  assert.equal(mergeCartQuantity(-1, 1, 5), 0);
  assert.equal(mergeCartQuantity(1.5, 1, 5), 0);
});
