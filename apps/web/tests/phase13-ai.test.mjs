import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { AI_TOOL_NAMES, buildConversationOwnershipFilter, buildOwnedOrderFilter, hasMatchingOrigin, validateAIToolRequest } from "../src/lib/ai/tool-contract.mjs";
import { isAuthorizedAIService } from "../src/lib/ai/tool-auth.mjs";
import { verifyAIIdentityToken } from "../src/lib/ai/identity-verify.mjs";

test("the browser-facing tool contract is a fixed allowlist with strict argument validation", () => {
  assert.deepEqual(AI_TOOL_NAMES, ["search_products", "get_product", "get_product_stock", "get_faq", "get_shipping_policy", "get_return_policy", "get_order_status"]);
  assert.deepEqual(validateAIToolRequest({ tool: "search_products", arguments: { query: "عباءة" }, locale: "ar" }), {
    tool: "search_products", arguments: { query: "عباءة" }, locale: "ar",
  });
  assert.equal(validateAIToolRequest({ tool: "execute_sql", arguments: { query: "select * from users" }, locale: "ar" }), null);
  assert.equal(validateAIToolRequest({ tool: "search_products", arguments: { query: "a", sql: "select 1" }, locale: "ar" }), null);
  assert.equal(validateAIToolRequest({ tool: "get_order_status", arguments: { orderNumber: "user-b-order" }, locale: "ar" }), null);
  assert.equal(validateAIToolRequest({ tool: "get_shipping_policy", arguments: { shippingCost: 0 }, locale: "ar" }), null);
  assert.equal(validateAIToolRequest({ tool: "get_product", arguments: { slug: "../admin" }, locale: "ar" }), null);
});

test("conversation and order queries always include authenticated owner", () => {
  assert.deepEqual(buildConversationOwnershipFilter({ userId: "user-a", guestTokenHash: null }, "thread-bait"), { id: "thread-bait", userId: "user-a" });
  assert.deepEqual(buildConversationOwnershipFilter({ userId: null, guestTokenHash: "a".repeat(64) }, "guest-thread"), { id: "guest-thread", guestTokenHash: "a".repeat(64) });
  assert.deepEqual(buildOwnedOrderFilter("user-a", "FAR-0123456789ABCDEF0123456789ABCDEF"), {
    userId: "user-a", orderNumber: "FAR-0123456789ABCDEF0123456789ABCDEF",
  });
  assert.equal(buildOwnedOrderFilter("user-a", "arbitrary-db-id"), null);
  assert.equal(buildConversationOwnershipFilter({ userId: "", guestTokenHash: null }, "thread"), null);
  assert.equal(buildConversationOwnershipFilter({ userId: "user-a", guestTokenHash: "a".repeat(64) }, "thread"), null);
});

test("internal service authentication uses a constant-time exact bearer credential", () => {
  const secret = "development-internal-service-secret-value";
  assert.equal(isAuthorizedAIService(`Bearer ${secret}`, secret), true);
  assert.equal(isAuthorizedAIService(`Bearer ${secret}x`, secret), false);
  assert.equal(isAuthorizedAIService(null, secret), false);
  assert.equal(isAuthorizedAIService(`Bearer ${secret}`, "short"), false);
});

test("identity JWT validates HS256 signature, issuer, audience, customer role, thread, and expiry", () => {
  const secret = "development-internal-service-secret-value";
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const claims = Buffer.from(JSON.stringify({
    iss: "farasha-web", aud: "farasha-ai", sub: "user-a", role: "CUSTOMER", conversation_id: "thread-a",
    locale: "ar", iat: 1000, exp: 1120,
  })).toString("base64url");
  const unsigned = `${header}.${claims}`;
  const sig = createHmac("sha256", secret).update(unsigned).digest("base64url");
  const token = `${unsigned}.${sig}`;
  assert.deepEqual(verifyAIIdentityToken(token, secret, 1001), { sub: "user-a", conversationId: "thread-a", locale: "ar", role: "CUSTOMER" });
  assert.equal(verifyAIIdentityToken(token, secret, 1120), null);
  const guestClaims = Buffer.from(JSON.stringify({
    iss: "farasha-web", aud: "farasha-ai", sub: "a".repeat(64), role: "GUEST", conversation_id: "guest-thread",
    locale: "ar", iat: 1000, exp: 1120,
  })).toString("base64url");
  const guestUnsigned = `${header}.${guestClaims}`;
  const guestSignature = createHmac("sha256", secret).update(guestUnsigned).digest("base64url");
  assert.equal(verifyAIIdentityToken(`${guestUnsigned}.${guestSignature}`, secret, 1001)?.role, "GUEST");
  assert.equal(verifyAIIdentityToken(`${unsigned}.bad`, secret, 1001), null);
});

test("AI proxy and internal routes keep credentials server-side and fail safely", async () => {
  const proxy = await readFile(new URL("../src/lib/ai/chat-client.ts", import.meta.url), "utf8");
  const messagesRoute = await readFile(new URL("../src/app/api/ai/threads/[threadId]/messages/route.ts", import.meta.url), "utf8");
  const toolsRoute = await readFile(new URL("../src/app/api/internal/ai/tools/route.ts", import.meta.url), "utf8");
  assert.match(proxy, /import "server-only"/);
  assert.match(proxy, /AI_INTERNAL_SERVICE_TOKEN/);
  assert.doesNotMatch(proxy, /NEXT_PUBLIC_/);
  assert.match(messagesRoute, /getChatActor\(\)/);
  assert.match(messagesRoute, /buildConversationOwnershipFilter/);
  assert.match(messagesRoute, /role: actor\.role/);
  assert.match(messagesRoute, /assistant-unavailable/);
  assert.match(toolsRoute, /isAuthorizedAIService/);
  assert.match(toolsRoute, /verifyAIIdentityToken/);
  assert.match(toolsRoute, /executeStoreAssistantTool/);
  const actor = await readFile(new URL("../src/lib/ai/chat-actor.ts", import.meta.url), "utf8");
  assert.match(actor, /httpOnly: true/);
  assert.match(actor, /guestTokenHash/);
  assert.match(actor, /sameSite: "lax"/);
  assert.equal(hasMatchingOrigin("https://shop.example", "https://shop.example/path"), true);
  assert.equal(hasMatchingOrigin("https://attacker.example", "https://shop.example"), false);
});
