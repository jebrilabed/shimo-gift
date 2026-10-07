# Store configuration, customer accounts, and catalog options

Phase 7 adds configurable store information, customer registration and profile management, saved addresses, SKU variant administration, and URL-based product image management.

## Store settings and currency

Administrators manage the singleton store record at `/admin/settings`. The page accepts the store name and description, contact phone and email, address, active state, Arabic default locale, and a controlled currency code (`SAR`, `USD`, `EUR`, `ILS`, or `JOD`). Updates require the server-side ADMIN authorization helper and are recorded in the existing audit log without putting contact values in audit metadata.

Currency formatting is centralized in `apps/web/src/lib/storefront/format.ts`. Current product, cart, and checkout prices use `StoreSettings.currency`. If no supported currency is configured, the storefront marks prices unavailable and checkout/order creation is blocked; it never substitutes a production SAR value. Configure a currency in the admin page before taking real orders. Existing orders retain their stored currency snapshot.

The store active flag hides the catalog and prevents checkout while inactive. Only Arabic is currently enabled, so the default locale selector has Arabic only.

## Customer accounts and addresses

Customers register at `/ar/register` and sign in through the existing Auth.js Credentials provider at `/ar/login`. Registration normalizes email, validates the password, and reuses the salted scrypt password hash. The server always creates a `CUSTOMER`; the registration form does not accept a role. Email stays immutable in this phase. `/ar/account` allows the signed-in customer to edit their name and links to order history and saved addresses.

At `/ar/account/addresses`, a customer can create, edit, delete, and choose a default address. Address queries and writes always use the authenticated user ID; a browser-supplied owner ID is never accepted. The database foreign key cascades addresses with their user, and a PostgreSQL partial unique index enforces at most one default address per user. Default changes and deletion/default reassignment are transactional.

Signed-in customers can select one of their own saved addresses during checkout. Guest checkout and manual address entry remain available. Saved address values are copied into the order shipping-address snapshot. Orders for registered users retain both the authenticated `userId` and related customer record where available.

## Product variants and images

The existing `ProductSku` model remains the source of SKU, price, stock, active state, and JSON option data. On an admin product edit page, administrators can add/edit/deactivate SKUs and set a small object of scalar options. Adding a second SKU changes the product kind to `VARIANT` and clears the simple-product default marker. SKU uniqueness, nonnegative price/stock, JSON shape, and SKU-to-product ownership are validated server-side. Cart availability and checkout inventory continue to use the selected SKU; purchased SKU/options and price remain in the order snapshot.

Product images use the existing `ProductImage` records and HTTPS URLs. Admins can add/edit/remove images and move one to primary (the first display position). Product editors keep image maintenance in the separate image manager so saving product text does not erase images. Missing and failed images render a fallback. No binary image data is stored in PostgreSQL.

There is no upload provider configured. Production file uploads require a separately approved and configured storage provider; Phase 7 does not add provider credentials or infrastructure.

## Production environment and database

Web runtime configuration requires:

- `DATABASE_URL`: a PostgreSQL connection URL.
- `AUTH_SECRET`: at least 32 characters; store it only in the hosting secret configuration.
- `SITE_URL`: set to the canonical HTTPS origin in production.

The `/api/health` response validates environment shape and reports only configuration status/issues; it does not expose secret values and does not perform a live database query. `.env.local` remains ignored. Example environment files contain blank placeholders only. Set the store currency separately through the protected settings page.

The new migration is `prisma/migrations/20261002170000_phase7_store_accounts`. It adds the minimal store fields and customer addresses; older migrations are unchanged. Live PostgreSQL migration status and connection behavior remain unverified until a PostgreSQL service and `DATABASE_URL` are available.

## Security and validation

- Admin settings, SKU, and image mutations call the existing ADMIN helper and write important changes to the existing audit log.
- Profile and address actions require a CUSTOMER session. Role, user ID, email, and password hash are not editable in profile forms.
- Registration uses generic failure text for duplicate or otherwise failed account creation.
- Settings, addresses, SKU options, and image URLs are validated on the server. Image URLs must be HTTPS and cannot contain embedded credentials.
- Errors sent to customers do not include raw database exceptions. Server logs contain error codes but no passwords, secrets, or session payloads.

## Checks

Run from the repository root:

```powershell
npm run db:validate
npm run db:generate
npm run test:auth
npm run test:admin
npm run test:orders
npm run test:phase7
npm run typecheck:web
npm run lint:web
npm run build:web
```

Migration SQL and address ownership/default constraints can be exercised in the disposable PGlite database used during Phase 7 validation. This does not substitute for live PostgreSQL verification.

## Known limitations and deferred scope

- Production image file uploads need a configured storage provider; only safe HTTPS URL records are managed here.
- Locale support remains Arabic only. The shared money formatter accepts a locale parameter for future locale support.
- The health route validates environment configuration but does not prove that PostgreSQL is reachable.
- Payment providers, messaging/email/SMS, chatbot and AI, shipping integrations/calculations, coupons, reviews, loyalty, analytics, recommendations, OAuth, and password reset remain deferred to Phase 8 or later.
