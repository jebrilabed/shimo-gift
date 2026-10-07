import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const moneyPattern = /^(?:0|[1-9]\d{0,9})\.\d{2}$/;
const bindingPattern = /^[a-f0-9]{64}$/;
const maxQuoteLines = 500;
const attemptLifetimeMs = 2 * 60 * 60 * 1000;

function hmac(secret, value) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function checkoutOwnerBinding(secret, ownerType, ownerIdentity) {
  if (typeof secret !== "string" || secret.length < 32 || !ownerIdentity || !["customer", "guest"].includes(ownerType)) return null;
  return sha256(hmac(secret, `owner\0${ownerType}\0${ownerIdentity}`));
}

export function checkoutCartBinding(secret, cartId) {
  if (typeof secret !== "string" || secret.length < 32 || typeof cartId !== "string" || !cartId) return null;
  return sha256(hmac(secret, `cart\0${cartId}`));
}

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0 || items.length > maxQuoteLines) return null;
  const normalized = [];
  for (const item of items) {
    if (!item || typeof item.skuId !== "string" || !item.skuId || item.skuId.length > 64 ||
      !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 1_000_000_000 ||
      typeof item.unitPrice !== "string" || !moneyPattern.test(item.unitPrice)) return null;
    normalized.push({ skuId: item.skuId, quantity: item.quantity, unitPrice: item.unitPrice });
  }
  normalized.sort((left, right) => left.skuId.localeCompare(right.skuId));
  if (new Set(normalized.map((item) => item.skuId)).size !== normalized.length) return null;
  return normalized;
}

function quoteFingerprint(quote) {
  return sha256(JSON.stringify({
    ownerBinding: quote.ownerBinding,
    cartBinding: quote.cartBinding,
    currency: quote.currency,
    items: quote.items,
  }));
}

export function createCheckoutAttemptToken({ secret, ownerBinding, cartId, currency, items, now = Date.now() }) {
  if (typeof secret !== "string" || secret.length < 32 || !bindingPattern.test(ownerBinding ?? "") ||
    typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency) || !Number.isSafeInteger(now)) return null;
  const cartBinding = checkoutCartBinding(secret, cartId);
  const normalizedItems = normalizeItems(items);
  if (!cartBinding || !normalizedItems) return null;

  const quote = {
    v: 1,
    ownerBinding,
    cartBinding,
    currency,
    items: normalizedItems,
    issuedAt: now,
    expiresAt: now + attemptLifetimeMs,
    nonce: randomBytes(32).toString("base64url"),
  };
  const payload = Buffer.from(JSON.stringify(quote)).toString("base64url");
  const token = `${payload}.${hmac(secret, payload)}`;
  return { token, fingerprint: quoteFingerprint(quote), expiresAt: quote.expiresAt };
}

export function verifyCheckoutAttemptToken(token, secret, expectedOwnerBinding, now = Date.now()) {
  if (typeof token !== "string" || token.length > 64_000 || typeof secret !== "string" || secret.length < 32 ||
    !bindingPattern.test(expectedOwnerBinding ?? "") || !Number.isSafeInteger(now)) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const expectedSignature = Buffer.from(hmac(secret, parts[0]));
  const receivedSignature = Buffer.from(parts[1]);
  if (expectedSignature.length !== receivedSignature.length || !timingSafeEqual(expectedSignature, receivedSignature)) return null;

  let quote;
  try {
    quote = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!quote || quote.v !== 1 || quote.ownerBinding !== expectedOwnerBinding ||
    !bindingPattern.test(quote.cartBinding ?? "") || typeof quote.currency !== "string" || !/^[A-Z]{3}$/.test(quote.currency) ||
    !Number.isSafeInteger(quote.issuedAt) || !Number.isSafeInteger(quote.expiresAt) ||
    quote.issuedAt > now + 60_000 || quote.expiresAt <= now || quote.expiresAt - quote.issuedAt !== attemptLifetimeMs ||
    typeof quote.nonce !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(quote.nonce)) return null;
  const items = normalizeItems(quote.items);
  if (!items) return null;
  const normalizedQuote = { ...quote, items };
  return {
    quote: normalizedQuote,
    fingerprint: quoteFingerprint(normalizedQuote),
    idempotencyKey: sha256(token),
  };
}

export function checkoutQuoteMatches(quotedItems, currentItems) {
  const quoted = normalizeItems(quotedItems);
  const current = normalizeItems(currentItems);
  return !!quoted && !!current && JSON.stringify(quoted) === JSON.stringify(current);
}
