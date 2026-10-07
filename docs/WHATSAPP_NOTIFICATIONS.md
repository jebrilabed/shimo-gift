# WhatsApp order notifications — Phase 12

## Audit

| Area | Status | Evidence / action |
| --- | --- | --- |
| `NotificationOutbox` model | PARTIAL | Existing unique `eventKey`, status, attempts, last-attempt time, safe-error field, and provider ID were unused. Added order link, retry schedule, ambiguity flag, and query indexes in a new migration. |
| Outbox creation | MISSING | Added deterministic order-created and successful status-transition events inside the existing order transaction. |
| WhatsApp provider/config | MISSING | Added server-only official Cloud API template provider, strict environment configuration, and an injectable provider abstraction. |
| Order-created/status/cancel events | MISSING | Added `ORDER_CREATED` and confirmed/processing/shipped/delivered/cancelled event insertion after the relevant order write succeeds. |
| Dispatcher/claiming | MISSING | Added a bounded cron endpoint and PostgreSQL `FOR UPDATE SKIP LOCKED` claim within a short transaction. Provider HTTP happens after commit. |
| Retry/idempotency | MISSING | Unique event key prevents duplicate business events; bounded attempt count and scheduled retry are used for explicit provider 429 responses. |
| Failure/timeout handling | MISSING | Invalid/configuration failures are safe. Timeouts, network failures, malformed success bodies, 408 and 5xx are marked delivery-unknown and stop automatic retry. Stale claims receive the same conservative handling. |
| Admin visibility/retry | MISSING | Added a protected, paginated outbox page and audited admin retry action. Phone numbers and provider payloads are not shown. |
| Security | PARTIAL | No prior provider or endpoint existed. Cron uses a constant-time bearer-secret comparison; admin actions use the existing live `requireAdmin()` check. |
| Tests | MISSING | Added mock-provider and outbox lifecycle tests; database-level locking still requires PostgreSQL. |

No broken or implemented-early WhatsApp behavior was found. Existing checkout, inventory, order transitions, and restocking remain the source of truth.

## Event and transaction flow

Checkout writes `ORDER_CREATED` to the outbox in the same transaction as order,
items, inventory decrement, and cart conversion. The centralized transition service
adds one deterministic `ORDER_<STATUS>:<order-id>` event only after a compare-and-set
status update succeeds; cancellation notification is inserted only after the existing
restock operations succeed. Unique `eventKey` is the final duplicate guard.

The outbox retains only a recipient phone and the order snapshot variables needed by
templates: customer name, public order number, amount, and currency. No address,
customer note, internal order ID, credentials, or audit metadata are sent in the
WhatsApp request. Recipient normalization accepts explicit international `+`/`00`
numbers; national significant numbers can use the optional configured country code.
No country code is assumed by the application.

The dispatcher atomically claims due `PENDING` rows with PostgreSQL
`FOR UPDATE SKIP LOCKED`, increments `retryCount`, sets `PROCESSING`, and commits.
Only then does it call the provider. It updates to `SENT`, schedules a bounded retry,
or marks `FAILED`. Concurrent dispatchers cannot claim the same row. A worker that
leaves a `PROCESSING` row stale is marked `FAILED` with `deliveryUnknown`; it is never
automatically resent because Meta may already have accepted the message.

Automatic retry is bounded to five total attempts and is currently limited to an
explicit provider `429` response, respecting a bounded `Retry-After` value or the
central backoff schedule. Timeouts, network errors, `408`, `5xx`, and malformed
success responses have ambiguous delivery and require admin review. Cloud API send
does not provide a provider idempotency key for these requests, so delivery is
at-least-once with duplicate risk on a deliberate manual retry after an ambiguous
result; exactly-once delivery is not claimed.

## Provider and templates

The sender uses `POST https://graph.facebook.com/{WHATSAPP_API_VERSION}/{WHATSAPP_PHONE_NUMBER_ID}/messages`
with Bearer authorization and a template message. `WHATSAPP_API_VERSION` has no
hardcoded fallback; set a currently supported Meta Graph version in server
configuration. Templates are mapped by event through the six
`WHATSAPP_TEMPLATE_ORDER_*` variables. Each configured template must be approved and
enabled in the connected account, use the configured language, and have four text
body parameters in this order: customer name, order number, order total, currency.
Template approval and existence are not checked by this application.

The API follows Meta's official [WhatsApp Cloud API collection](https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api), which documents the Graph `/{Version}/{Phone-Number-ID}/messages` template request.

## Operations

- Admin outbox: `/admin/notifications` (server-protected, paginated, status filter).
- Scheduled dispatcher: `GET /api/internal/notifications/dispatch` with
  `Authorization: Bearer $CRON_SECRET`; execution is limited to three notifications.
- The application does not configure a hosting cron schedule. Configure the host's
  scheduler to call the endpoint after the application and secrets are deployed.
- Missing credentials leave queued notifications pending and return a safe
  `503 not-configured`/`unavailable`; checkout continues to work. Missing per-event
  templates fail that event safely with no provider call.
- Admin retry requeues only a `FAILED` row, resets its bounded attempt cycle, writes
  `notifications.retry` to `AdminAuditLog`, and invokes the same dispatcher once.
- Logs contain dispatch outcomes only; no access token, authorization header, phone,
  raw provider body, or complete customer payload is logged.

## Local configuration and tests

Set the relevant blank values in `apps/web/.env.local`; keep credentials out of
`.env.example` and client bundles. National phone support is opt-in through
`WHATSAPP_DEFAULT_COUNTRY_CODE`. No Meta request is made by tests. Configure approved
templates before a real scheduled or admin-triggered dispatch.

```powershell
npm run db:migrate:dev
npm run db:generate
npm run test:phase12
```

Migration, `SKIP LOCKED` concurrency, order/outbox atomicity, and live WhatsApp
delivery require a configured PostgreSQL database and Meta credentials; those checks
must be reported separately from mock-provider test results.
