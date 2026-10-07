export type CheckoutPricedLine = { unitPrice: string; quantity: number };
export function calculateCheckoutAmounts(items: CheckoutPricedLine[], shippingAmount?: string): {
  lineSubtotals: string[];
  subtotal: string;
  shipping: string;
  total: string;
} | null;
