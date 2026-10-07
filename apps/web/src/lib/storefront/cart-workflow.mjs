/** Keep a merged line at or below the current SKU stock. A zero stock removes it. */
export function mergeCartQuantity(currentQuantity, incomingQuantity, stockQuantity) {
  if (![currentQuantity, incomingQuantity, stockQuantity].every(Number.isSafeInteger) ||
    currentQuantity < 0 || incomingQuantity < 0 || stockQuantity < 0) return 0;
  return Math.min(currentQuantity + incomingQuantity, stockQuantity);
}
