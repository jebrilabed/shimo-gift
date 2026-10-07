# Shimo Gift

Arabic-first Shimo Gift storefront. The `/ar` storefront,
published product catalog, guest/customer cart, checkout and order lifecycle now build
on the PostgreSQL/Prisma foundation, server-side authentication, and protected admin
catalog dashboard. Customer accounts and addresses, admin store settings, configurable
currency, SKU variant management, and URL-based product image management are included.
WhatsApp order notifications use the existing transactional outbox and the official
Cloud API. Dispatch remains disabled until its server credentials and approved
templates are configured. The customer assistant uses the FastAPI service,
LangChain/Gemini, and a fixed allowlist of server-side read-only store tools. Chat is
optional until its internal service token and Gemini settings are configured. Guest chat
uses a secure anonymous cookie; order status is available to signed-in customers only.
The SEO layer includes dynamic metadata, canonical URLs, published-content management,
Arabic sitemap/robots output, breadcrumbs, and current-price product structured data.
Payment gateways and shipping services remain deferred.

Deployment readiness and the verified/unverified production checklist are in
[the deployment guide](docs/DEPLOYMENT.md). No production environment or provider
deployment is configured by this repository alone.

## Requirements

- Node.js 20.9 or newer and npm.
- Python 3.11 or newer and pip.

## Environment setup

In PowerShell, copy the local examples:

```powershell
Copy-Item apps/web/.env.example apps/web/.env.local
Copy-Item apps/ai/.env.example apps/ai/.env
```

Set `DATABASE_URL` in `apps/web/.env.local` to a PostgreSQL database you control and set
`AUTH_SECRET` (at least 32 characters) for Auth.js sessions. Do not commit populated
environment files. Configure the store currency at `/admin/settings` before checkout.
Set the same random value of at least 32 characters for `AI_INTERNAL_SERVICE_TOKEN` in
both local environment files. Configure `GEMINI_API_KEY` and `GEMINI_MODEL` in
`apps/ai/.env`; the web proxy keeps the provider credential server-side.
See
[environment configuration](docs/ENVIRONMENT.md), the [database guide](docs/DATABASE.md),
[deployment and final validation guide](docs/DEPLOYMENT.md),
the [authentication guide](docs/AUTHENTICATION.md), and the
[store configuration guide](docs/STORE_CONFIGURATION_AND_ACCOUNTS.md), the
[phase audit and cart guide](docs/PHASES_1_7_AUDIT_AND_PHASE_8_CART.md), the
[AI assistant guide](docs/AI_ASSISTANT.md), and the
[SEO and public content guide](docs/SEO_AND_CONTENT.md), and the
[performance notes](docs/PERFORMANCE.md).

## Install dependencies

From the repository root:

```powershell
npm install
python -m pip install -r apps/ai/requirements-dev.txt
```

## Run locally

Start the web app from the repository root:

```powershell
npm run dev:web
```

Open `http://localhost:3000/ar`. The root path redirects to `/ar`.
Open `http://localhost:3000/ar/design-system` to review the internal design showcase.
It returns not-found in production builds.

Start the AI service in a second terminal:

```powershell
python -m uvicorn app.main:app --reload --app-dir apps/ai
```

The web and AI health endpoints are:

- `http://localhost:3000/api/health`
- `http://localhost:8000/health/live`
- `http://localhost:8000/health/ready`

The AI readiness endpoint reports whether internal authentication and Gemini settings
are present. FastAPI has no PostgreSQL connection string; database reads stay behind
the authenticated Next.js tool endpoint. Storefront and checkout continue to work when
AI is unavailable. See [AI assistant](docs/AI_ASSISTANT.md) for tool scope and privacy.

Brand choices, measured color contrast, RTL behavior, logo limitations, and reusable
component notes are documented in [the design-system guide](docs/BRAND-RTL-DESIGN-SYSTEM.md).

## Checks and build

```powershell
npm run lint:web
npm run typecheck:web
npm run build:web
```

Prisma workflow (requires `DATABASE_URL` for migration commands that connect to PostgreSQL):

```powershell
npm run db:validate
npm run db:format
npm run db:generate
npm run db:migrate:dev -- --name descriptive_change
npm run db:migrate:status
```

Deploy checked-in migrations with `npm run db:migrate:deploy` in the deployment environment.

AI service checks (run from the repository root):

```powershell
python -m compileall apps/ai/app
python -m pytest -c apps/ai/pyproject.toml apps/ai/tests
npm run test:auth
npm run test:admin
npm run test:orders
npm run test:cart
npm run test:checkout
npm run test:phase7
npm run test:phase10
npm run test:phase11
npm run test:phase12
npm run test:phase13
npm run test:phase14
npm run test:phase15
npm run test:phase16
npm run test:deployment
```

The protected admin routes and setup are documented in
[the admin dashboard guide](docs/ADMIN_DASHBOARD.md).

Customer cart, checkout, order history, status transitions, and admin order management
are documented in [the shopping and orders guide](docs/ORDERS_AND_CHECKOUT.md).

Phase 7 store settings, customer accounts, saved addresses, variants, and image URL
management are documented in
[the store configuration and accounts guide](docs/STORE_CONFIGURATION_AND_ACCOUNTS.md).

For a production-like web start after building:

```powershell
npm run start:web
```

WhatsApp outbox operation and dispatcher configuration are described in
[the WhatsApp notifications guide](docs/WHATSAPP_NOTIFICATIONS.md).

## Project layout

- `apps/web` — Next.js App Router application.
- `apps/web/src/components/ui` — shared accessible UI primitives.
- `apps/web/src/styles` — centralized theme tokens and logical-property component styles.
- `apps/web/public/brand` — supplied low-resolution logo reference for the internal showcase.
- `apps/ai` — FastAPI service foundation.
- `prisma` — PostgreSQL schema and versioned migrations.
- `contracts` — reserved for future service contracts.
- `docs` — setup and environment documentation.
- `.github` — reserved for CI workflows.
