# Database foundation

Phase 3 establishes PostgreSQL as the system of record. The schema is maintained in
`prisma/schema.prisma`; committed migrations under `prisma/migrations` are the ordered,
reviewable database history. Prisma 7 CLI settings live in the root `prisma.config.ts`.
The generated Prisma Client is ignored under `apps/web/src/generated/prisma` and is
regenerated from the schema.

## Local setup and workflow

1. Copy `apps/web/.env.example` to `apps/web/.env.local` and set `DATABASE_URL` to a
   PostgreSQL database you control. Keep credentials out of source control.
2. Install dependencies from the repository root with `npm install`.
3. Format and validate the schema and generate the client:

   ```powershell
   npm run db:format
   npm run db:validate
   npm run db:generate
   ```

4. During schema development, create and apply a named migration against a development
   database:

   ```powershell
   npm run db:migrate:dev -- --name descriptive_change
   npm run db:migrate:status
   ```

   Review the generated SQL before committing it. For deployment, apply only checked-in
   migrations using `npm run db:migrate:deploy`; do not use `migrate dev` against
   production. `migrate deploy` does not generate Prisma Client, so run generation as
   part of the application build/install pipeline.

No seed is configured or run. Phase 3 does not require a database for the existing
foundation routes or builds; database commands and database-backed code require a valid
PostgreSQL URL.

## Data ownership and integrity

- `Product` owns catalog identity and publication metadata. It has no inventory count.
- `ProductSku` is the only inventory and sellable-price source. Prices, compare-at
  prices, order totals, shipping, discounts, and line totals use `Decimal(12,2)`. Never
  convert money through JavaScript floating-point arithmetic.
- A simple product must have one default SKU; a variant product has one SKU per
  purchasable variant. The schema has `Product.kind` and `ProductSku.isDefault`; a
  PostgreSQL partial unique index, preventing multiple default SKUs, is modeled in the
  schema. A deferred PostgreSQL constraint trigger enforces exactly one default SKU for
  simple products at transaction commit. Variant option completeness and SKU creation
  for each purchasable variant must be maintained by the future catalog service.
- Cart items reference SKUs and deliberately store no price. Future checkout must
  re-read current SKU price and stock within its transaction.
- Orders are guest-compatible: both `userId` and `customerId` may be null. Contact,
  shipping address, SKU, product name, variant, and price snapshots preserve order
  meaning if customer/catalog records later change. Order deletion is restricted while
  items exist; business history must be retained.
- Optional Customer/User relations support both guests and signed-in customers.
- Product/category/page/FAQ translations have scoped locale uniqueness. Arabic and
  English are supported without requiring both translations to exist.
- `createdAt`/`updatedAt` fields use PostgreSQL `timestamptz(3)`; store and pass UTC
  instants. Localized display formatting belongs at the application boundary.
- IDs use Prisma-generated CUIDs consistently. Prisma generates these before inserts;
  SQL writers must supply IDs.
- Deletion cascades are limited to dependent, non-historical data such as translations,
  product images, cart items, and chat messages. Catalog SKUs cannot be removed while
  referenced by carts/orders; order line snapshots survive a SKU deletion via `SET NULL`
  when it is otherwise eligible.

There is no production seed data, business settings row, assumed currency, or invented
contact/address information. Store settings use a technical singleton key and optional
values; SEO settings hold one optional record per locale.

Category foreign keys prevent orphaned parents and a database check disallows direct
self-parenting. Future category services must also reject longer hierarchy cycles.

The initial migration SQL is generated from the Prisma schema. A following small,
documented PostgreSQL migration adds row-level `CHECK` constraints and a deferred
constraint trigger that Prisma's schema DSL cannot express; it is intentionally
separate from the generated baseline.

## Future phase boundaries

Phase 4 authentication should use the Auth.js-compatible `User`, `Account`, `Session`,
and `VerificationToken` shapes. Future features should access the shared server-only
client at `apps/web/src/lib/db/prisma.ts`, add schema changes through Prisma migrations,
and keep writes that maintain cross-row rules inside transactions. Do not import Prisma
in client components or treat request-supplied prices, stock, role/owner references, or
totals as authoritative.
