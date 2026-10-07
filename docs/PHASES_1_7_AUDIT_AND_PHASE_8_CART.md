# Phases 1–7 audit and Phase 8 cart

This document records the source review and the Phase 8 changes. Code and checked-in
migrations were reviewed directly; Phase reports were treated as context only.

## Audit summary

| Phase | Status | Findings |
| --- | --- | --- |
| 1 — Foundation | COMPLETE | Next.js App Router, strict TypeScript, Tailwind, ESLint, `/ar` redirect/routing, environment checks, global errors, web health, FastAPI health/configuration, and setup docs exist. |
| 2 — Brand and RTL system | COMPLETE | Central tokens, Arabic-friendly typography, RTL-aware shared controls, focus and reduced-motion behavior, showcase, and supplied reference logo exist. Storefront footer was missing and has been added in this pass. |
| 3 — Database | COMPLETE | Prisma schema/migrations include the expected auth, catalog, SKU inventory, carts, order snapshots, settings, content, outbox, audit, redirects, and chat foundation. No seed data was found. Live PostgreSQL remains unverified because `DATABASE_URL` is not configured in this workspace. |
| 4 — Auth and authorization | COMPLETE | Auth.js Prisma adapter, CUSTOMER/ADMIN roles, server-side current-user/role checks, protected admin layout/actions, and safe bootstrap are present. |
| 5 — SEO and locale | PARTIAL | Arabic metadata, product fields, server-rendered content, and Arabic RTL routing existed. Canonicals, social metadata, robots/sitemap, noindex rules, and filter noindex behavior were missing and are now added. `/en` is not enabled: the UI copy and storefront queries are Arabic-only; the locale configuration and public metadata advertise Arabic only, avoiding a false English storefront/hreflang. |
| 6 — Storefront | COMPLETE after corrections | Arabic catalog, product details, search/filter, cards, add-to-cart entry point, states, and responsive RTL components existed. Dedicated `/ar/products`, category detail routes, category links, and footer were missing and are now present. |
| 7 — Products, categories, inventory, admin | PARTIAL before corrections; COMPLETE for the approved Arabic catalog scope | CRUD, status/archive, translations, SKU variants, image ordering, stock validation, and audit logging existed. SEO columns were not editable from admin and are now exposed with bounded validation and persisted for both available translation records. English UI/public catalog is still not enabled. |

No BROKEN Phase 1–7 behavior was found in the inspected flows. Checkout, orders,
customer accounts/addresses, store settings, and order administration already existed
ahead of their roadmap phase. They are preserved as IMPLEMENTED EARLY; checkout/order
creation UI and behavior were not expanded in this work. The cart integration was
adapted so the existing early checkout can still resolve a signed-in customer's cart.

## Cart ownership and behavior

- Guests keep using the existing random HTTP-only cookie and SHA-256 token hash. The
  browser never selects a cart by ID.
- A CUSTOMER cart is selected from the authenticated server session's user ID. Admin
  sessions use guest-cart behavior on the public store.
- The first authenticated cart read/action merges the current guest cart into the
  customer's persistent cart. Matching SKU lines combine and clamp to the SKU's
  current stock; zero-stock items are removed. A row lock on the user serializes cart
  creation/merge without changing the Phase 3 schema.
- Mutations resolve their cart server-side and scope item IDs to that cart. Active SKU,
  product, category, price, and stock are read from PostgreSQL. Price is displayed from
  the current SKU record; no price/stock/subtotal is accepted from the browser.
- Adding/updating a cart does not reserve or decrement inventory. Existing checkout is
  kept operational and remains outside the scope of new Phase 8 functionality.
- `/ar/cart` calculates subtotal with Prisma Decimal, and displays line count, unit
  quantities, current price, and current availability. The header count reads the same
  server-side cart after add/update/remove/clear and after a merge.
- No migration or schema change was needed.

## Validation and limits

Focused cart tests cover stock-clamped merging and malformed quantities; Phase 7 tests
also cover the new SEO input bounds. Existing auth/admin/order/Phase 7 suites remain in
the regression set. Node's test runner and Next build spawn child processes, which are
blocked by the default Windows sandbox in this environment; rerun those commands with
the allowed process execution. Python tests and source-only lint/type checks run in
the current environment. No live PostgreSQL credentials or service are configured, so
account-isolation, migration status, and database-backed route rendering require a
PostgreSQL-backed environment for end-to-end verification.

English storefront/hreflang, checkout/order functionality as a newly approved phase,
payment, inventory reservation, and all later roadmap phases remain outside this work.
