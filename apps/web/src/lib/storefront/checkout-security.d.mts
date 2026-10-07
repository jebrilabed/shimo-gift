export type CheckoutQuoteLine = { skuId: string; quantity: number; unitPrice: string };
export type CheckoutQuote = {
  v: 1;
  ownerBinding: string;
  cartBinding: string;
  currency: string;
  items: CheckoutQuoteLine[];
  issuedAt: number;
  expiresAt: number;
  nonce: string;
};
export function checkoutOwnerBinding(secret: string, ownerType: "customer" | "guest", ownerIdentity: string): string | null;
export function checkoutCartBinding(secret: string, cartId: string): string | null;
export function createCheckoutAttemptToken(input: { secret: string; ownerBinding: string; cartId: string; currency: string; items: CheckoutQuoteLine[]; now?: number }): { token: string; fingerprint: string; expiresAt: number } | null;
export function verifyCheckoutAttemptToken(token: string, secret: string, expectedOwnerBinding: string, now?: number): { quote: CheckoutQuote; fingerprint: string; idempotencyKey: string } | null;
export function checkoutQuoteMatches(quotedItems: CheckoutQuoteLine[], currentItems: CheckoutQuoteLine[]): boolean;
