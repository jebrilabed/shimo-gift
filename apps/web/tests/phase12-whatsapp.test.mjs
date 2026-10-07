import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getOrderNotificationEventType, buildOrderNotificationEvent } from "../src/lib/notifications/order-events.mjs";
import { isAuthorizedNotificationCron } from "../src/lib/notifications/cron-auth.mjs";
import { readWhatsAppConfig } from "../src/lib/whatsapp/config.mjs";
import { dispatchNotificationBatch, MAX_NOTIFICATION_ATTEMPTS, retryDelayMs } from "../src/lib/whatsapp/dispatcher-core.mjs";
import { createWhatsAppProvider } from "../src/lib/whatsapp/provider.mjs";
import { buildWhatsAppTemplateRequest, normalizeWhatsAppRecipient } from "../src/lib/whatsapp/template-request.mjs";
import { authorizeRole } from "../src/lib/auth/authorization-policy.mjs";
import { executeAdminMutation } from "../src/lib/admin/execute-admin-mutation.mjs";

function config(overrides = {}) {
  return {
    issues: [], accessToken: "test-token-never-log", phoneNumberId: "1234567890", apiVersion: "v99.0", languageCode: "ar",
    defaultCountryCode: "", templates: { ORDER_CREATED: "order_created" }, ...overrides,
  };
}

function notification(overrides = {}) {
  return {
    id: "notification_123", eventType: "ORDER_CREATED", recipient: "+1 (202) 555-0123", retryCount: 1,
    payload: { customerName: "Mona", orderNumber: "FAR-ABC", total: "42.50", currency: "SAR" }, ...overrides,
  };
}

function repositoryFor(record = notification()) {
  const state = { notification: { ...record }, sent: [], failed: [], retries: [], stale: 0, claims: 0 };
  return {
    state,
    async failStaleProcessing() { return state.stale; },
    async claimNext() {
      state.claims += 1;
      if (state.notification.status && state.notification.status !== "PENDING") return null;
      if (state.claimed) return null;
      state.claimed = true;
      state.notification.retryCount += 1;
      return { ...state.notification };
    },
    async markSent(id, messageId) { state.sent.push({ id, messageId }); state.notification.status = "SENT"; },
    async markFailed(id, error, deliveryUnknown) { state.failed.push({ id, error, deliveryUnknown }); state.notification.status = "FAILED"; },
    async scheduleRetry(id, error, nextAttemptAt) { state.retries.push({ id, error, nextAttemptAt }); state.notification.status = "PENDING"; },
  };
}

test("order events use deterministic unique keys and contain only template-safe order fields", () => {
  const order = { id: "order-1", orderNumber: "FAR-001", contactName: " Mona ", contactPhone: "+966501234567", total: { toString: () => "100.25" }, currency: "SAR", password: "must-not-copy" };
  const first = buildOrderNotificationEvent("ORDER_CREATED", order);
  const duplicate = buildOrderNotificationEvent("ORDER_CREATED", order);
  assert.deepEqual(first, duplicate);
  assert.equal(first.eventKey, "ORDER_CREATED:order-1");
  assert.equal(first.orderId, "order-1");
  assert.equal(first.payload.customerName, "Mona");
  assert.equal(first.payload.total, "100.25");
  assert.equal("password" in first.payload, false);
  assert.equal(buildOrderNotificationEvent("ORDER_UNKNOWN", order), null);
  assert.equal(getOrderNotificationEventType("CONFIRMED"), "ORDER_CONFIRMED");
  assert.equal(getOrderNotificationEventType("PENDING"), null);
});

test("configuration stays optional for app startup and accepts only explicit server variables", () => {
  const missing = readWhatsAppConfig({});
  assert.ok(missing.issues.includes("WHATSAPP_ACCESS_TOKEN"));
  assert.ok(missing.issues.includes("WHATSAPP_API_VERSION"));
  const env = {
    WHATSAPP_ACCESS_TOKEN: "private-token", WHATSAPP_PHONE_NUMBER_ID: "1234567890", WHATSAPP_API_VERSION: "v99.0",
    WHATSAPP_TEMPLATE_LANGUAGE_CODE: "ar", WHATSAPP_DEFAULT_COUNTRY_CODE: "966",
    WHATSAPP_TEMPLATE_ORDER_CREATED: "order_created",
  };
  const valid = readWhatsAppConfig(env);
  assert.deepEqual(valid.issues, []);
  assert.equal(valid.accessToken, "private-token");
  assert.equal(valid.templates.ORDER_CREATED, "order_created");
});

test("phone normalization requires explicit international format or configured country code", () => {
  assert.equal(normalizeWhatsAppRecipient("+1 (202) 555-0123"), "12025550123");
  assert.equal(normalizeWhatsAppRecipient("00442079460000"), "442079460000");
  assert.equal(normalizeWhatsAppRecipient("501234567", "966"), "966501234567");
  assert.equal(normalizeWhatsAppRecipient("0501234567", "966"), null);
  assert.equal(normalizeWhatsAppRecipient("0501234567"), null);
  assert.equal(normalizeWhatsAppRecipient("+123"), null);
});

test("template request sends only four configured order variables", () => {
  const request = buildWhatsAppTemplateRequest({
    recipient: "12025550123", templateName: "order_created", languageCode: "ar",
    payload: { customerName: "Mona", orderNumber: "FAR-001", total: "10.00", currency: "SAR", orderId: "private-id", address: "private address" },
  });
  assert.equal(request.messaging_product, "whatsapp");
  assert.equal(request.to, "12025550123");
  assert.deepEqual(request.template.components[0].parameters.map(({ text }) => text), ["Mona", "FAR-001", "10.00", "SAR"]);
  assert.equal(JSON.stringify(request).includes("private-id"), false);
  assert.equal(buildWhatsAppTemplateRequest({ recipient: "bad", templateName: "x", languageCode: "ar", payload: {} }), null);
});

test("Cloud API provider uses template POST and returns only the provider message ID", async () => {
  let captured;
  const provider = createWhatsAppProvider({ fetchImpl: async (url, options) => {
    captured = { url, options };
    return { ok: true, status: 200, json: async () => ({ messages: [{ id: "wamid.test" }] }) };
  } });
  const req = provider.buildRequest({ notification: notification(), recipient: notification().recipient, templateName: "order_created", config: config() });
  const result = await provider.sendTemplate(req, config());
  assert.equal(captured.url, "https://graph.facebook.com/v99.0/1234567890/messages");
  assert.equal(captured.options.method, "POST");
  assert.equal(captured.options.headers.authorization, "Bearer test-token-never-log");
  assert.equal(result.messageId, "wamid.test");
});

test("provider errors are classified safely without retaining response text or credentials", async () => {
  const rateLimited = createWhatsAppProvider({ fetchImpl: async () => ({ ok: false, status: 429, headers: new Headers({ "retry-after": "30" }), json: async () => ({ secret: "private" }) }) });
  await assert.rejects(rateLimited.sendTemplate({}, config()), (error) => error.category === "rate-limited" && error.retryAfterMs === 30_000 && !error.message.includes("private"));
  const temporary = createWhatsAppProvider({ fetchImpl: async () => ({ ok: false, status: 503, headers: new Headers(), json: async () => ({}) }) });
  await assert.rejects(temporary.sendTemplate({}, config()), (error) => error.category === "ambiguous" && !error.message.includes("test-token"));
  const rejected = createWhatsAppProvider({ fetchImpl: async () => ({ ok: false, status: 400, headers: new Headers(), json: async () => ({ error: "private provider body" }) }) });
  await assert.rejects(rejected.sendTemplate({}, config()), (error) => error.category === "rejected" && !error.message.includes("private provider body"));
  const malformedSuccess = createWhatsAppProvider({ fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ messages: [] }) }) });
  await assert.rejects(malformedSuccess.sendTemplate({}, config()), (error) => error.category === "ambiguous");
  const networkFailure = createWhatsAppProvider({ fetchImpl: async () => { throw new Error("sensitive underlying error"); } });
  await assert.rejects(networkFailure.sendTemplate({}, config()), (error) => error.category === "ambiguous" && !error.message.includes("sensitive"));
  assert.equal(retryDelayMs(100, 99 * 60 * 60_000), 60 * 60_000);
  assert.equal(MAX_NOTIFICATION_ATTEMPTS, 5);
});

test("dispatcher claims and marks a successful notification SENT", async () => {
  const repository = repositoryFor();
  const provider = { buildRequest: () => ({ safe: true }), sendTemplate: async () => ({ messageId: "wamid.ok" }) };
  const result = await dispatchNotificationBatch({ repository, provider, config: config(), now: () => new Date("2026-10-03T12:00:00Z") });
  assert.equal(result.processed, 1);
  assert.equal(repository.state.notification.status, "SENT");
  assert.deepEqual(repository.state.sent, [{ id: "notification_123", messageId: "wamid.ok" }]);
  assert.equal(repository.state.notification.retryCount, 2);
});

test("rate limits schedule bounded retries and stop after the attempt limit", async () => {
  const now = () => new Date("2026-10-03T12:00:00Z");
  const first = repositoryFor(notification({ retryCount: 0 }));
  const limitedProvider = { buildRequest: () => ({}), sendTemplate: async () => { throw { category: "rate-limited", safeMessage: "rate limit", retryAfterMs: 30_000 }; } };
  const retryResult = await dispatchNotificationBatch({ repository: first, provider: limitedProvider, config: config(), now });
  assert.equal(retryResult.results[0].status, "PENDING");
  assert.equal(first.state.retries[0].nextAttemptAt.toISOString(), "2026-10-03T12:00:30.000Z");

  const exhausted = repositoryFor(notification({ retryCount: MAX_NOTIFICATION_ATTEMPTS - 1 }));
  await dispatchNotificationBatch({ repository: exhausted, provider: limitedProvider, config: config(), now });
  assert.equal(exhausted.state.notification.status, "FAILED");
  assert.equal(exhausted.state.retries.length, 0);
});

test("ambiguous delivery fails without automatic retry; missing config does not claim work", async () => {
  const repository = repositoryFor();
  const provider = { buildRequest: () => ({}), sendTemplate: async () => { throw { category: "ambiguous", safeMessage: "delivery unknown" }; } };
  await dispatchNotificationBatch({ repository, provider, config: config() });
  assert.equal(repository.state.notification.status, "FAILED");
  assert.equal(repository.state.failed[0].deliveryUnknown, true);
  assert.equal(repository.state.retries.length, 0);

  const unconfigured = repositoryFor();
  const result = await dispatchNotificationBatch({ repository: unconfigured, provider, config: config({ issues: ["WHATSAPP_ACCESS_TOKEN"] }) });
  assert.equal(result.status, "unavailable");
  assert.equal(unconfigured.state.claims, 0);

  const invalidRecipient = repositoryFor(notification({ recipient: "not a phone" }));
  const rejectBuild = { buildRequest: () => null, sendTemplate: async () => { throw new Error("should not send"); } };
  await dispatchNotificationBatch({ repository: invalidRecipient, provider: rejectBuild, config: config() });
  assert.equal(invalidRecipient.state.notification.status, "FAILED");
  assert.equal(invalidRecipient.state.failed[0].deliveryUnknown, false);
});

test("cron bearer secret check is constant-shape, strict, and rejects missing credentials", () => {
  const secret = "x".repeat(48);
  assert.equal(isAuthorizedNotificationCron(`Bearer ${secret}`, secret), true);
  assert.equal(isAuthorizedNotificationCron(`Bearer ${"y".repeat(48)}`, secret), false);
  assert.equal(isAuthorizedNotificationCron(secret, secret), false);
  assert.equal(isAuthorizedNotificationCron(`Bearer ${secret}`, ""), false);
});

test("order transactions enqueue durable events without calling the provider in checkout", async () => {
  const source = await readFile(new URL("../src/lib/storefront/orders.ts", import.meta.url), "utf8");
  assert.match(source, /tx\.notificationOutbox\.create\(\{ data: createdNotification \}\)/);
  assert.match(source, /tx\.notificationOutbox\.create\(\{ data: notification \}\)/);
  assert.doesNotMatch(source, /dispatchWhatsAppNotifications|graph\.facebook\.com|fetch\(/);
});

test("admin retry remains server-authorized and the scheduled endpoint is secret protected", async () => {
  const action = await readFile(new URL("../src/app/(admin)/admin/notifications/actions.ts", import.meta.url), "utf8");
  const route = await readFile(new URL("../src/app/api/internal/notifications/dispatch/route.ts", import.meta.url), "utf8");
  assert.match(action, /requireAdmin\(\)/);
  assert.match(action, /retryFailedWhatsAppNotification\(id, admin\.id\)/);
  assert.match(route, /isAuthorizedNotificationCron/);
  assert.match(route, /process\.env\.CRON_SECRET/);
});

test("notification retry mutation does not run for anonymous or CUSTOMER actors", async () => {
  let ran = 0;
  const runFor = async (user) => executeAdminMutation(
    async () => authorizeRole(user, ["ADMIN"]),
    async () => { ran += 1; return "retried"; },
  );
  assert.deepEqual(await runFor(null), { ok: false, reason: "unauthenticated" });
  assert.deepEqual(await runFor({ id: "customer-1", role: "CUSTOMER" }), { ok: false, reason: "forbidden" });
  assert.deepEqual(await runFor({ id: "admin-1", role: "ADMIN" }), { ok: true, value: "retried" });
  assert.equal(ran, 1);
});
