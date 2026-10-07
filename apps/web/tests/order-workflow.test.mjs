import assert from "node:assert/strict";
import test from "node:test";
import {
  allowedOrderTransitions,
  canTransitionOrder,
  parseCartQuantity,
  parseCheckoutInput,
} from "../src/lib/storefront/order-workflow.mjs";

function validForm(overrides = {}) {
  const form = new FormData();
  form.set("contactName", "  سارة  ");
  form.set("contactPhone", "+966 50 123 4567");
  form.set("address", "شارع النخيل ١");
  form.set("city", "الرياض");
  form.set("customerNote", "اتصل قبل الوصول");
  for (const [key, value] of Object.entries(overrides)) form.set(key, value);
  return form;
}

test("checkout trims contact details and accepts a neutral international phone format", () => {
  const parsed = parseCheckoutInput(validForm());
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.value, {
    contactName: "سارة",
    contactPhone: "+966 50 123 4567",
    address: "شارع النخيل ١",
    city: "الرياض",
    customerNote: "اتصل قبل الوصول",
  });
});

test("checkout rejects missing fields, invalid phones, long text, and file values", () => {
  assert.deepEqual(parseCheckoutInput(validForm({ contactName: " " })).errors, { contactName: "validationName" });
  assert.deepEqual(parseCheckoutInput(validForm({ contactPhone: "++++123456" })).errors, { contactPhone: "validationPhone" });
  assert.deepEqual(parseCheckoutInput(validForm({ address: "x".repeat(501) })).errors, { address: "validationAddress" });
  assert.deepEqual(parseCheckoutInput(validForm({ customerNote: "x".repeat(2001) })).errors, { customerNote: "validationNote" });
  const fileForm = validForm();
  fileForm.set("contactName", new File(["ignored"], "name.txt"));
  assert.deepEqual(parseCheckoutInput(fileForm).errors, { contactName: "validationName" });
});

test("cart quantity is a positive safe integer", () => {
  assert.deepEqual(parseCartQuantity("1"), { ok: true, quantity: 1 });
  for (const value of ["0", "-1", "1.5", " 2", "9007199254740992", new File(["2"], "quantity.txt")]) {
    assert.deepEqual(parseCartQuantity(value), { ok: false });
  }
});

test("order transitions enforce a simple terminal cancellation and delivery lifecycle", () => {
  assert.equal(canTransitionOrder("PENDING", "CONFIRMED"), true);
  assert.equal(canTransitionOrder("PROCESSING", "CANCELLED"), true);
  assert.equal(canTransitionOrder("SHIPPED", "CANCELLED"), false);
  assert.equal(canTransitionOrder("DELIVERED", "CANCELLED"), false);
  assert.equal(canTransitionOrder("CANCELLED", "PENDING"), false);
  assert.deepEqual(allowedOrderTransitions("unknown"), []);
});
