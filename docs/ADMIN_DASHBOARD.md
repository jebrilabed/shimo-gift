# Admin dashboard and catalog management

Phase 5 adds a protected Arabic RTL workspace at `/admin`. It uses the existing
Next.js App Router, Prisma schema, PostgreSQL connection, Auth.js session, and UI
tokens. The current locale setup supports Arabic only; admin labels are grouped in
`apps/web/src/lib/admin/messages.ts` so another locale can be added with the existing
localization work.

## Phase 11 audit

| Area | Status | Evidence | Phase 11 action |
| --- | --- | --- | --- |
| Admin authentication / authorization | COMPLETE | Shared layout re-reads the session user and role; pages/actions use `requireAdminPage` / `requireAdmin`. | Preserved; dashboard remains server-protected. |
| Admin layout | COMPLETE | Shared Arabic RTL layout, admin identity, logout, responsive shell, and generic error boundary exist. | Added dynamic rendering to prevent private dashboard data from being shared/cached. |
| Admin navigation | PARTIAL | Real product, category, inventory, order, and settings links existed; no current-page state. | Added current route indication with `aria-current` on desktop and mobile. |
| Dashboard overview | PARTIAL | Previously showed catalog counts, low/out-of-stock product counts, and recent products only. | Added live order/customer/SKU counts, status breakdown, order values, recent orders, SKU low-stock table, and existing audit activity. |
| Product management | COMPLETE | Search, status filters, pagination, create/edit, translations, SKU/default stock, image URLs, status/archive actions. | Preserved; dashboard links to existing product pages. |
| Category management | COMPLETE | Search, pagination, hierarchy, create/edit, safe delete. | Preserved; dashboard links to existing category pages. |
| SKU / variant management | PARTIAL | SKU pricing/stock and options exist; create simple-product workflow does not provide a full variant builder. | Preserved; dashboard displays each low-stock SKU and variant options. Full variant builder remains outside dashboard scope. |
| Inventory | COMPLETE | SKU-level listing, search, low/out filters, bounded updates, server authorization, transaction/audit. | Preserved; low-stock snapshot uses active SKUs under active products and the existing setting/default threshold. |
| Orders | COMPLETE | Search/filter/pagination, detail, centralized state transitions, cancellation/restocking. | Preserved; recent orders link to existing detail route. |
| Customers | PARTIAL | Storefront accounts/order history exist; no admin customer list is present. | No CRM was added; dashboard shows an aggregate count only and exposes no contact/authentication data. |
| Store settings | COMPLETE | Protected persisted settings form and audit entry exist. | Preserved; configured store name is used on dashboard where available. |
| Audit logs | PARTIAL | `AdminAuditLog` is written by existing mutations; no separate admin audit page exists. | Dashboard shows a bounded recent-activity view with safe labels and actor name, without raw metadata/IDs. |
| Search / filtering | COMPLETE | Existing catalog, category, inventory, and orders lists filter server-side and paginate. | Preserved; one simple dashboard period applies to period-dependent order/activity queries. |
| Responsive behavior / accessibility | PARTIAL | RTL responsive shell, semantic existing tables/forms and shared UI controls existed; nav lacked active indication. | Added active nav announcement and responsive dashboard cards/lists. Existing tables remain horizontally contained. |
| Loading / empty / error states | PARTIAL | Admin loading skeleton and generic Arabic error boundary existed; several catalog empty states existed. | Dashboard has explicit no-orders, no-low-stock, no-activity, and no-products states; shared generic error/loading boundaries preserved. |
| Security / caching | COMPLETE with dashboard cache gap | Server role checks and protected mutations existed; dashboard is private server data. | Added force-dynamic layout rendering. Activity excludes metadata; no public API or client query was added. |
| Tests | PARTIAL | Focused auth, admin, order, cart, checkout, Phase 7 and Phase 10 tests existed. | Added Phase 11 period, currency totals, SKU query, and safe audit-label tests. |

There were no identified broken admin workflows or implemented-early Phase 11 modules. The established admin route is `/admin`; it remains unchanged. No customer CRM or separate audit-log product page was introduced because those modules did not exist.

## Routes

- `/admin` — live operational dashboard with order-period filter, status counts, per-currency order values, customer total, current SKU stock indicators, recent orders, recent audit activity, and catalog summary.
- `/admin/products` — searchable, status-filtered product table with pagination.
- `/admin/products/new` — create a simple product.
- `/admin/products/[id]` — edit product translations, slug, price, compare-at price,
  default SKU, stock, category, images, and active status.
- `/admin/categories` — searchable category list, parent relationships, and safe
  deletion controls.
- `/admin/categories/new` and `/admin/categories/[id]` — create and edit categories.
- `/admin/inventory` — SKU-level stock table, search, low/out-of-stock filters, and
  transactional quantity updates.
- `/admin/orders` and `/admin/orders/[id]` — existing order search, filters, detail,
  status transitions, cancellation, and restocking behavior.
- `/admin/settings` — persisted store settings.

## Dashboard data rules

The dashboard uses bounded server-side Prisma queries. Its rolling period filter
(last 24 hours, 7 days, 30 days, or all time) is applied to order counts, status
counts, order values, recent orders, and recent audit activity. Customer count and
stock indicators are explicitly current/all-time snapshots and are not affected by
that filter. Low-stock rows use active `ProductSku` records, active products, and the
existing configurable threshold. Out-of-stock units are counted separately.

Order values exclude cancelled orders and are grouped by currency; delivered-order
values include the `DELIVERED` order status. These are order totals, not proof of
payment collection. The activity view uses the existing `AdminAuditLog`, shows a
bounded list of known safe action labels and actor names, and never renders metadata,
request IDs, or entity IDs.

## Authorization and data safety

The admin route layout uses `getCurrentUser()` from
`apps/web/src/lib/auth/authorization.ts`; that helper reloads the current user and
role from PostgreSQL. Every catalog and inventory server action calls the existing
`requireAdmin()` helper before reading or changing catalog data. A browser-supplied
role or user ID is never used to grant permission. Changes write an entry to the
existing `AdminAuditLog` model in the same transaction as the corresponding update.

Products are created as `SIMPLE` products with one default SKU. Existing translated
products can store Arabic and optional English names and descriptions. Editing the
product form updates the default SKU; inventory is maintained separately for every
SKU, including variants. Product removal uses the existing `ARCHIVED` status and
deactivates all its SKUs to preserve cart and order references. Category deletion is
blocked while products or child categories reference it; no products are detached
or deleted by that operation.

All names, slugs, prices, compare-at prices, SKUs, stock quantities, image URLs,
category relationships, and parent relationships are validated on the server.
Database uniqueness constraints remain the final protection against concurrent
duplicate slugs and SKUs. Technical database errors are logged without sending raw
details to the browser.

## Images and low-stock threshold

The existing `ProductImage` model stores image URLs. The product form accepts up to
eight HTTPS URLs, one per line; the first is the primary image. It does not upload or
store binary files. Connect an approved image-storage service in a later phase if
uploads are required.

The low-stock threshold is read from `StoreSettings.configuration.lowStockThreshold`
when it is an integer from 1 through 1000. If the setting is absent or invalid, the
centralized default is 10 units. Dashboard low-stock and out-of-stock product counts
are based on active SKUs belonging to active products.

## Local setup and checks

Configure `DATABASE_URL` and `AUTH_SECRET` in `apps/web/.env.local`, apply the existing
Prisma migrations, and create an administrator with the documented one-time
`npm run auth:bootstrap-admin` command. From the repository root:

```powershell
npm run dev:web
npm run lint:web
npm run typecheck:web
npm run build:web
npm run test:auth
npm run test:admin
npm run test:phase11
```

The development database must be reachable to render admin data and exercise
database-backed actions. `npm run test:admin` covers server-side input validation and
the authorization gate. The Phase 5 implementation was also exercised against an
isolated in-memory PostgreSQL-compatible database; live credentials and production
database behavior must be verified in the deployment environment.

Phase 11 dashboard aggregation helpers are covered by `npm run test:phase11`.

## Deferred scope

This phase does not add uploads, variant-configuration editing, order workflows,
checkout, payments, shipping, customer accounts, notifications, coupons, reviews,
or AI features. There is no new schema migration; the existing product, SKU, image,
category, and audit models are reused.
