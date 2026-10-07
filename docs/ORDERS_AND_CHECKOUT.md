# Shopping, checkout, and orders

Checkout and order behavior was implemented ahead of the approved roadmap and audited
for Phase 9. Existing order management remains preserved; Phase 9 changes checkout
consistency and confirmation security only. The only supported UI locale is Arabic
(`/ar`).

## Routes

- `/ar` — searchable and category-filtered active catalog, paginated at 20 items.
- `/ar/products/[slug]` — product details, available SKU options, stock and price.
- `/ar/cart` — guest or customer cart, current database prices, quantity controls,
  removal, clear, and subtotal.
- `/ar/checkout` — guest or authenticated checkout, saved addresses, signed price
  review, shipping/total preview, and payment-state notice.
- `/ar/order-confirmation/[orderNumber]` — noindex confirmation with order and shipping
  summary. Authenticated orders are restricted to their customer; guest confirmations
  use a cryptographically random 128-bit order number as a capability.
- `/ar/orders` and `/ar/orders/[orderNumber]` — authenticated order history, scoped in
  every query to the signed-in user's database ID.
- `/admin/orders` and `/admin/orders/[id]` — paginated/filterable admin order list and
  order details/status control.

The customer order history works for existing authenticated users. This phase does
not add customer registration; guest orders are not automatically linked to a later
account. The existing credentials login does not preserve a return destination, so a
signed-out user who opens `/ar/orders` must navigate back after logging in.

## Cart architecture and validation

The existing `Cart` and `CartItem` models are reused. A guest receives a random
32-byte browser token in an HTTP-only, SameSite=Lax cookie. The raw token is never
stored in the database; `Cart.guestTokenHash` stores its SHA-256 digest. Guest carts
expire after 30 days. Customer carts are selected by the authenticated server
session's user ID. The first authenticated cart access merges any current guest cart
into the customer cart, joins matching SKU lines, and clamps merged quantities to
current stock.

Cart rows contain only SKU IDs and positive integer quantities. Add/update operations
re-read active product/SKU/category state and stock on the server. Each operation
resolves its cart from the guest token or authenticated session; item IDs supplied by
the browser are always scoped to that cart. Cart-mutating transactions lock the cart
row. The UI displays
fresh SKU prices; it never supplies authoritative price, product name, ownership, or
stock values.

Products must have an active status, an Arabic translation, an active SKU, and either
no category or an active category to be purchasable. Out-of-stock products remain
visible with an unavailable indicator when otherwise published. Archived/inactive
items already in a cart are marked unavailable and block checkout until removed.

## Checkout, snapshots, and inventory

### Phase 9 checkout audit

| Area | Status before Phase 9 | Evidence | Required action / Phase 9 result |
| --- | --- | --- | --- |
| Cart loading | IMPLEMENTED EARLY — PARTIAL / BROKEN for a fresh guest | Existing guest lookup tried to create a cookie during page rendering when no cart token existed. | Make guest page reads read-only; create cookies only in cart actions; bind quote to cart identity. |
| Customer information | IMPLEMENTED EARLY — PARTIAL | Contact fields validated, but profile/default-address prefill was absent. | Add safe profile/default-address prefill. |
| Guest checkout | IMPLEMENTED EARLY — COMPLETE | Guest token ownership and contact/shipping input worked. | Preserve guest flow and secure retry/confirmation. |
| Authenticated checkout | IMPLEMENTED EARLY — PARTIAL | Session-derived user/cart and saved addresses worked; confirmation lacked an owner guard. | Add confirmation ownership guard. |
| Address handling | IMPLEMENTED EARLY — COMPLETE | Address IDs were checked against the signed-in user's addresses. | Preserve the ownership check. |
| Shipping information | IMPLEMENTED EARLY — PARTIAL | Destination snapshot existed, but no rate policy was configured. | Keep zero shipping explicit until a policy is configured. |
| Price calculation | IMPLEMENTED EARLY — PARTIAL | Transaction used live Decimal prices but did not detect changes since review. | Add signed quote validation and Decimal totals. |
| Stock validation | IMPLEMENTED EARLY — COMPLETE | Product/SKU locks and conditional decrement prevented overselling. | Preserve transactional stock checks. |
| Order creation | IMPLEMENTED EARLY — COMPLETE | Transaction created PENDING/UNPAID orders. | Add an attempt key for idempotent retries. |
| Order snapshots | IMPLEMENTED EARLY — COMPLETE | Product, SKU, variant, unit price, quantity, and line subtotal snapshots existed. | Preserve snapshots. |
| Idempotency | MISSING | No persistent attempt association existed. | Add signed per-attempt token and unique nullable Order key. |
| Inventory decrement | IMPLEMENTED EARLY — COMPLETE | Conditional decrement was atomic with order creation. | Preserve the atomic decrement. |
| Payment status | IMPLEMENTED EARLY — COMPLETE | New orders used UNPAID without an external provider. | Preserve and surface the unpaid state. |
| Order status | IMPLEMENTED EARLY — COMPLETE | New orders used PENDING. | Preserve the established initial state. |
| Cart clearing | IMPLEMENTED EARLY — COMPLETE | Cart conversion/clearing was in the order transaction. | Preserve transaction-bound clearing. |
| Error handling | IMPLEMENTED EARLY — PARTIAL | Stock/address/store errors existed; stale quote and duplicate recovery did not. | Add stale-cart messaging and retry recovery. |
| Security | IMPLEMENTED EARLY — PARTIAL | Cart/address checks were server-side and order numbers random, but customer confirmation did not enforce ownership. | Add authenticated order-owner guard. |
| Checkout UI | IMPLEMENTED EARLY — PARTIAL | Pending state existed; totals/shipping/payment/default-address details were absent. | Add these checkout review details. |
| Validation | IMPLEMENTED EARLY — COMPLETE | Server-side contact/address/note validation existed. | Preserve validation and add signed quote validation. |
| Tests | IMPLEMENTED EARLY — PARTIAL | Existing tests covered fields/transitions, not quote security or Decimal totals. | Add focused quote/idempotency/totals tests. |

The fresh-guest cart read was the broken checkout-adjacent behavior found during
route smoke testing; it now returns an empty snapshot without attempting a render-time
cookie write. Existing transaction/order behavior was preserved.

No WhatsApp, payment gateway, order-management, or shipping-management behavior was
added.

Checkout validates and trims the name, phone, address, city, and optional note on the
server. Saved addresses are verified against the current customer's user ID. No
customer ID, price, currency, stock, subtotal, or total is accepted from the browser.
A short-lived HMAC-signed quote binds the owner, cart, currency, current SKU prices,
and quantities. If a price, quantity, currency, or cart changes before submit, the
customer must review the updated cart and try again.

The order transaction checks the idempotency key, locks the cart, then product and SKU
rows in stable order, re-reads current catalog/stock/price, compares the signed quote,
and conditionally decrements stock. A unique order key plus the cart lock makes a
repeated submission return the same order. If any SKU is inactive, hidden, or short on
stock, the transaction aborts; no order or stock change remains and the cart stays
intact. Order items and cart conversion/clearing commit in that transaction.

`OrderItem.productNameSnapshot`, `skuCodeSnapshot`, `variantSnapshot`, `unitPrice`,
`quantity`, and `subtotal` preserve the purchase-time details. The current product
price is never used to render historical orders. The existing cryptographically
random `orderNumber` field provides the public confirmation reference. Order number,
items, stock decrements, and cart conversion/clearing commit together.

There is no shipping-rate policy in the current store-settings UI, so shipping is
calculated as zero and shown in checkout and confirmation. The Order model records
`shippingCost`, ready for a later configured policy. There is no payment gateway;
orders remain UNPAID. `Order.total` is the Decimal-safe server-calculated subtotal
plus shipping. The store currency comes from `StoreSettings.currency`. If it is absent or unsupported,
prices are marked unavailable and checkout/order creation is blocked; the application
does not substitute a production SAR value. Configure the store setting before accepting
orders. Currency is stored on every order
so history remains stable.

## Order statuses and cancellation

The schema's existing statuses are reused:

- `PENDING` → `CONFIRMED` or `CANCELLED`
- `CONFIRMED` → `PROCESSING` or `CANCELLED`
- `PROCESSING` → `SHIPPED` or `CANCELLED`
- `SHIPPED` → `DELIVERED`
- `DELIVERED` and `CANCELLED` are terminal

An admin transition is authorized with the existing live database role check and
applied with a compare-and-set update inside a transaction. On cancellation, every
SKU quantity is restored in that same transaction and an existing `AdminAuditLog`
entry records the transition and restoration. The `CANCELLED` terminal state plus
the conditional status update ensures concurrent/repeated cancellation cannot
restock twice. If an order item has lost its SKU relation, cancellation is blocked
with a safe message so inventory is not silently left inconsistent. Shipped orders
cannot be cancelled through this workflow.

## Authorization and privacy

Customer order list/detail queries include `userId` from `getCurrentUser()` on the
server. The URL order number alone cannot grant access to account history. Guest
confirmation uses a 128-bit random order number as a capability reference and shows
the contact name and delivery destination while withholding phone and internal IDs.
Authenticated confirmation is also scoped to the signed-in user. Admin list/detail
pages call the existing page guard;
the status server action independently calls `requireAdmin()` and validates the
transition. Role, ownership, prices, and totals from the browser are ignored.

Order audit entries use the existing `AdminAuditLog` model and omit contact details.
Unexpected database failures are logged with a code only and mapped to safe Arabic
messages.

## Development and testing

Set `DATABASE_URL` and `AUTH_SECRET` in `apps/web/.env.local`, apply the existing
migrations, and start the app from the repository root:

```powershell
npm run db:migrate:dev
npm run db:generate
npm run dev:web
```

Run checks with:

```powershell
npm run typecheck:web
npm run lint:web
npm run db:validate
npm run db:generate
npm run test:auth
npm run test:admin
npm run test:orders
npm run test:cart
npm run test:checkout
npm run test:phase10
npm run build:web
```

`test:orders` covers checkout field/quantity validation and allowed status
transitions. `test:checkout` covers signed quote ownership, expiry/tampering,
idempotency-attempt identity, quote changes, and Decimal-safe totals. A disposable
PGlite smoke run from earlier phases applied the then-existing migrations and
exercised order creation, snapshot pricing, rollback on stock failure, and a single
restock on cancellation. PGlite's socket server did not support the multi-client
HTTP/Auth.js run used here, so concurrent transactions and signed-in page rendering
still need verification against live PostgreSQL. The Phase 9 idempotency migration
requires a database-backed migration check before production use. No live connection
is required for the unit tests or production build.

## Phase 10 orders and inventory audit

Orders and inventory already had operational functionality implemented early. This
audit preserves it and fills the missing admin search/filter and inventory audit
details.

| Area | Status before Phase 10 | Evidence | Phase 10 action |
| --- | --- | --- | --- |
| Order creation | IMPLEMENTED EARLY — COMPLETE | Phase 9 transaction creates order and items. | Preserved. |
| Order snapshots | IMPLEMENTED EARLY — COMPLETE | Product/SKU/variant/price/quantity snapshots are stored. | Preserved; customer/admin detail views use snapshots. |
| Order number | IMPLEMENTED EARLY — COMPLETE | Random 128-bit `FAR-` reference with unique constraint. | Preserved. |
| Order ownership | IMPLEMENTED EARLY — COMPLETE | Customer detail query scopes by session user ID; guest confirmation uses random capability reference. | Preserved and rechecked. |
| Guest order access | IMPLEMENTED EARLY — COMPLETE | No guest order history; confirmation reference is not predictable. | Preserved; no guest history added. |
| Customer order access | IMPLEMENTED EARLY — COMPLETE | Paginated history and owner-scoped detail route existed. | Added payment/shipping summary to details. |
| Order details | IMPLEMENTED EARLY — PARTIAL | Admin detail used snapshots but omitted payment status. | Added payment status; customer details now show status and shipping summary. |
| Order status | IMPLEMENTED EARLY — COMPLETE | Existing enum and centralized lifecycle allow adjacent transitions and cancellation through PROCESSING. | Preserved as the established cancellation policy. |
| Status transitions | IMPLEMENTED EARLY — COMPLETE | Server action requires admin; compare-and-set update and audit run in a transaction. | Preserved; duplicate cancellation now has a clear result. |
| Cancellation | IMPLEMENTED EARLY — COMPLETE | PENDING, CONFIRMED, and PROCESSING could be cancelled; SHIPPED/DELIVERED are terminal. | Preserved; explicit duplicate-cancel handling. |
| Restocking | IMPLEMENTED EARLY — COMPLETE | Cancellation restored SKU quantities in the same transaction after status compare-and-set. | Added bounded atomic increments and specific safe failure handling. |
| Inventory consistency | IMPLEMENTED EARLY — PARTIAL | Checkout and cancellation were transactional; manual inventory edits lacked a locked before-value for audit. | Serialize SKU quantity edits and record old/new values. |
| Admin order access | IMPLEMENTED EARLY — COMPLETE | List/detail pages use server-side admin page guards; actions call `requireAdmin`. | Preserved. |
| Customer order history | IMPLEMENTED EARLY — COMPLETE | Paginated, noindex history already existed. | Preserved. |
| Order search/filter | IMPLEMENTED EARLY — PARTIAL | Search and status filter existed; payment/date filters did not. | Added payment-state and inclusive date-range filters; pagination preserves filters. |
| Audit logging | IMPLEMENTED EARLY — PARTIAL | Status events and inventory edits were logged, but inventory events lacked before quantity and cancellation lacked SKU quantities. | Add before/after stock and restocked SKU/quantity metadata. |
| Validation | IMPLEMENTED EARLY — COMPLETE | Admin inventory validates scoped SKU/product and bounded integer; order actions validate enum transitions. | Preserved and covered by Phase 10 tests. |
| Tests | IMPLEMENTED EARLY — PARTIAL | Existing tests covered basic transitions and admin stock input, not search/date filters. | Added focused Phase 10 policy/filter/input tests. |

The Phase 10 admin order list remains paginated. Search is limited to 120 characters;
date bounds are parsed as UTC calendar dates and the end date is inclusive. An index
on `orders.createdAt` supports chronological listing and date filtering. Payment
status is display/filter only; this phase does not change payment state.

Admin stock adjustments still write the authoritative `ProductSku.stockQuantity`.
The SKU row is locked during manual stock edits, and audit metadata records the old
and new quantities. Cancellation updates the order status with a compare-and-set,
restocks each SKU with a bounded atomic increment, and writes the audit event in the
same transaction. If any SKU is missing or cannot be safely incremented, the
transaction rolls back the status and all stock changes.

## Scope limits

Phase 9 added one nullable unique idempotency key to `Order`; Phase 10 adds one
`createdAt` index for admin order listing/filtering. The existing guest-capable
cart/order schema supplies order numbers, status, SKU relationships, snapshots,
address/contact fields, and audit logging. There is no payment gateway, refund flow,
shipment provider, shipping-price calculation, customer registration, account
linking for guest orders, variant editor, upload, email, SMS, WhatsApp, coupon,
review, advanced analytics, or AI implementation. Customer order history and basic
admin order operations are supported; no full Admin Dashboard work was added.
