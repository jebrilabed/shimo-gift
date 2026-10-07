# Customer AI assistant

The storefront assistant is an optional Phase 13 capability. The browser talks only to
Next.js. Next.js verifies the current CUSTOMER account or issues an anonymous guest
cookie, checks conversation ownership, and calls FastAPI with a short-lived signed
identity token. FastAPI validates both that token and the internal service bearer
credential. It has no PostgreSQL URL or direct database access.

## Setup

Set the same random secret of at least 32 characters as `AI_INTERNAL_SERVICE_TOKEN` in
`apps/web/.env.local` and `apps/ai/.env`. Configure `GEMINI_API_KEY` and a currently
supported `GEMINI_MODEL` in `apps/ai/.env`. Set `AI_WEB_TOOLS_URL` to the Next.js
`/api/internal/ai/tools` endpoint reachable from the AI service. Keep
`AI_CORS_ORIGINS` empty; browser requests do not go to FastAPI. No AI database
credential is used.

The examples leave Gemini credentials and the model blank. The web application, cart,
checkout, and order features continue working while AI is unconfigured. The AI
readiness endpoint reports missing integration settings without stopping FastAPI.

## Store tools

Only these validated read-only tools are exposed: `search_products`, `get_product`,
`get_product_stock`, `get_faq`, `get_shipping_policy`, `get_return_policy`, and
`get_order_status`. The web service returns a small public-safe shape and queries the
current PostgreSQL values for price, currency, and SKU stock. FAQ results require an
active FAQ. Policies use active `ContentPage` rows with page keys `shipping-policy` and
`return-policy` and a translation in the requested language. Missing content is
reported as unavailable; policy terms and delivery fees are never invented.

The LLM cannot select arbitrary tools, SQL, models, or credentials. The service limits
message size, prior history, tool results, tool-call count, output size, request time,
and requests per user in each AI process. The in-memory limiter is best-effort per
process and is not a distributed quota.

## Conversation access and privacy

Signed-in CUSTOMER conversations are scoped to their `userId`. Guest conversations use
a random `HttpOnly`, `SameSite=Lax` cookie; only its HMAC digest is stored as
`guestTokenHash`. Losing the cookie loses access to that guest conversation. ADMIN
accounts do not use the customer assistant. Conversation messages persist in the
existing chat tables; do not enter payment credentials, passwords, or other secrets.

`get_order_status` is not offered to guests. For customers, the database query filters
by both the public order number and the signed-in user's `userId`; it returns only
customer-facing status, date, total, and currency. Cross-customer order lookups return
the same not-found result.

## Known boundaries

- No streaming, semantic retrieval, ChromaDB, embeddings, or direct database access by
  the AI service.
- Product prices and availability never come from model memory; they come from live
  product/SKU queries.
- No real Gemini request is made by tests. Without a valid configured key/model, the
  service remains available but chat requests return a safe unavailable response.
