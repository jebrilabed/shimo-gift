# SEO and public content

Phase 14 uses the existing `ContentPage`, `ContentPageTranslation`, `FAQ`,
`FAQTranslation`, `SlugRedirect`, `StoreSettings`, and `StoreSeoSettings` models. It adds
no database models or migration.

## Public routes and publishing

- `/ar` is the Arabic storefront home.
- `/ar/products` and `/ar/categories/[slug]` show active catalog records with an Arabic translation.
- `/ar/faq` shows only active FAQs with an Arabic translation. It is omitted from the sitemap and marked noindex while there are no public FAQ entries.
- `/ar/[slug]` resolves only active content pages with an Arabic translation. The stable page key supports `shipping-policy`, `return-policy`, `privacy-policy`, `terms`, `contact`, and other existing content records.
- `/ar/contact` can display a published contact page and configured public store contact fields; it does not expose private credentials.
- Draft pages and FAQs are excluded from storefront output, AI tools, metadata, and sitemap results.

Create and edit these records at `/admin/content`. Content pages contain plain text; HTML is not accepted or rendered. FAQ order is managed through its existing `sortOrder` field. Unpublishing is a reversible archive action, so content history is retained. Mutations use the server-side `requireAdmin` authorization path and write audit events without copying page bodies into audit metadata.

English fields can be saved as an explicit complete translation, but `/en` remains disabled. The application currently supports only Arabic in the storefront locale configuration; English translations are not emitted as routes, canonical alternates, hreflang entries, or sitemap URLs.

## Metadata and structured data

Canonical URLs are built from `SITE_URL` and the actual public route. In production, missing, non-HTTPS, credential-bearing, query-bearing, or localhost site URLs cause absolute canonical URLs and the sitemap reference to be omitted instead of emitting localhost URLs. Set a real HTTPS `SITE_URL` before publishing. In local development, the default is `http://localhost:3000`.

Page titles and descriptions use configured SEO fields first, then available Arabic names/descriptions, then configured store identity. Product metadata uses the current active SKU set, available currency, and visible primary image. A product with multiple prices uses `AggregateOffer` price bounds; single-price products use `Offer`. Inventory quantities, ratings, reviews, and unconfigured brand claims are not included. Product and category slugs are validated for Arabic or Latin letters and numbers, and their previous public paths redirect permanently after changes.

Visible breadcrumbs and their `BreadcrumbList` data are built from the same labels and paths. The homepage emits `WebSite` and `Organization` data only from the configured store identity and public contact fields. JSON-LD is serialized safely. FAQ content is visible on the FAQ page, but no `FAQPage` markup is emitted because Google currently limits FAQ rich-result display to authoritative government and health sites. Product structured data supports offers; see [Google's Product structured data guidance](https://developers.google.com/search/docs/appearance/structured-data/product).

Search and filtered catalog URLs remain crawlable so search engines can observe `noindex,follow`. Robots disallows admin and API paths only; it does not block cart, checkout, account, login, or search paths that carry noindex directives. Sitemap entries are restricted to the Arabic homepage/catalog, active products/categories, published content pages, configured contact content, and FAQ pages with active translated entries.

## Validation

Run `npm run test:phase14`, `npm run lint:web`, `npm run typecheck:web`,
`npm run build:web`, `npm run db:format`, `npm run db:validate`, and
`npm run db:generate`. Database-backed HTTP rendering requires valid PostgreSQL
credentials in `apps/web/.env.local`.
