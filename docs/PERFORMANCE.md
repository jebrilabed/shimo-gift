# Performance notes

Phase 15 keeps the current Next.js, Prisma, and FastAPI architecture. It adds no runtime dependency, database migration, or shared cache.

## Rendering and JavaScript

- Storefront pages and product cards remain Server Components. The product image wrapper stays a small Client Component because its image-load failure fallback is visible user behavior; it adds only the existing error-state behavior and keeps that localized placeholder for invalid/non-HTTPS URLs.
- The store assistant launcher is a small client component. The conversation panel is a separate lazy chunk, loaded only when a visitor opens the assistant. Its thread/history requests also start on panel open. Chat remains independent of catalog, cart, and checkout rendering.
- Existing local Arabic/system font stack is retained. The application makes no remote font requests.

## Images

- Product cards remain lazy-loaded and reserve square space through the existing aspect-ratio containers. Only the first product-detail image is marked as the likely LCP image; thumbnails and cards are not preloaded.
- Direct, untransformed `res.cloudinary.com` image URLs receive request-sized `f_auto,q_auto,w_<width>` delivery transforms through a Next Image loader. Existing Cloudinary transformations and non-Cloudinary URLs are passed through unchanged; saved database URLs are never rewritten.
- Small admin product and inventory thumbnails use the same Cloudinary loader at their rendered dimensions. Existing transformed and other-host images remain unchanged.
- Other remote image providers currently expose no known resizing API in this project, so their original asset payload size remains provider-dependent.

## Queries and caching

- Public site settings, FAQs, published product details, and categories use React request memoization to reuse the same query within one server render/request. This is not a persistent or cross-request cache.
- Product and category metadata now share the rendered page's catalog read. The product read includes current active SKU prices and stock once for that request; it is not cached for later requests.
- The category breadcrumb trail uses one bounded recursive PostgreSQL query rather than one sequential query per ancestor (maximum depth remains 12).
- FAQ metadata and the FAQ page share the same published FAQ query. Contact rendering reuses the public store-settings query instead of reading settings again.
- Product listings already use server-side pagination (`STOREFRONT_PAGE_SIZE`); product, order, category, inventory, and notification admin lists retain their existing page limits.
- The admin dashboard's five recent products now select only the ID, slug, status, Arabic name, default SKU price/stock, and category name used by the table.
- Cart, checkout, account, orders, inventory-sensitive data, admin data, and private AI conversations remain uncached. Existing mutation `revalidatePath` calls remain the public page refresh mechanism.
- No index was added: current schema indexes cover the reviewed access paths, and there is no live database/query plan available to justify another index.

## AI and loading

- The AI HTTP call remains bounded by the existing 25-second web timeout; the AI service has its existing 20-second model timeout, 10-message history bound, four-tool-call limit, and 8-second store-tool timeout. These protections were audited and left unchanged.
- The storefront does not call the AI service while rendering. Loading the assistant code or opening a chat is separate from normal storefront navigation and commerce requests.
- Existing storefront and admin `loading.tsx` boundaries are retained; no extra Suspense boundaries were added without route-specific evidence.

## Measurement and limitations

- Before/after JavaScript measurements use each route's layout and page entry chunks recorded in Next's client-reference manifests and their generated file byte sizes. The baseline was the Phase 14 build present before these edits. They describe emitted entry chunk bytes, not compressed transfer size or Core Web Vitals.

| Route | Before | After | Change |
|---|---:|---:|---:|
| `/ar` | 37,821 bytes | 34,451 bytes | −3,370 bytes (8.9%) |
| `/ar/products/[slug]` | 40,164 bytes | 36,794 bytes | −3,370 bytes (8.4%) |

- The conversation panel is loaded on first open and is intentionally absent from the initial route manifest. The initial route bundle reductions come from splitting this panel from the storefront shell. Entry-chunk measurements do not include compressed transfer or the on-demand chat chunk.
- LCP, INP, CLS, TTFB, database timings, and real image response sizes require a reachable database, a configured public site URL, and a browser/production-like deployment. The current local `DATABASE_URL` is empty, so these values are not reported as measured.
- Sitemap generation still returns all public URL records in one metadata response, as required by the current single sitemap route. Revisit sitemap splitting if the catalog approaches the search-engine sitemap URL limit.
