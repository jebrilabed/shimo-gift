import { Decimal } from "@prisma/client/runtime/client";

const moneyPattern = /^(?:0|[1-9]\d{0,9})\.\d{2}$/;

export function calculateCheckoutAmounts(items, shippingAmount = "0.00") {
  if (!Array.isArray(items) || !items.length || !moneyPattern.test(shippingAmount)) return null;
  let subtotal = new Decimal(0);
  const lineSubtotals = [];
  for (const item of items) {
    if (!item || typeof item.unitPrice !== "string" || !moneyPattern.test(item.unitPrice) ||
      !Number.isSafeInteger(item.quantity) || item.quantity < 1) return null;
    const lineSubtotal = new Decimal(item.unitPrice).mul(item.quantity);
    lineSubtotals.push(lineSubtotal.toFixed(2));
    subtotal = subtotal.add(lineSubtotal);
  }
  const shipping = new Decimal(shippingAmount);
  return {
    lineSubtotals,
    subtotal: subtotal.toFixed(2),
    shipping: shipping.toFixed(2),
    total: subtotal.add(shipping).toFixed(2),
  };
}
