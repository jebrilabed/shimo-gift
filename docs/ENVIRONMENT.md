# Environment configuration

Use separate local environment files for each application. Copy the examples and keep
the resulting files untracked:

- Web: `apps/web/.env.example` → `apps/web/.env.local`
- AI service: `apps/ai/.env.example` → `apps/ai/.env`

The web example uses placeholders for `DATABASE_URL` and `AUTH_SECRET`. Replace them
in `.env.local`; do not copy a sample password or authentication secret into a real
environment.

The web and AI health/foundation routes need no secrets. The current web development
defaults are `SITE_NAME` and `SITE_URL`. The AI service uses `AI_ENVIRONMENT`,
`AI_SERVICE_NAME`, `AI_HOST`, `AI_PORT`, and `AI_CORS_ORIGINS`.

Integration values are listed as blank placeholders in the examples. WhatsApp
dispatch is implemented but remains disabled until server credentials and approved
templates are configured; other future integrations remain unused:

| Group | Variables | Current status |
|---|---|---|
| Site | `SITE_NAME`, `SITE_URL` | Used for basic web metadata/configuration |
| Database | `DATABASE_URL` | Required for PostgreSQL migrations and database-backed queries; schema formatting/validation/generation do not connect |
| Auth | `AUTH_SECRET` | Required for Auth.js sessions; never expose through `NEXT_PUBLIC_*` |
| Image storage | Cloudinary variables | Blank placeholders only; Phase 7 manages HTTPS image URLs and does not upload files |
| WhatsApp | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_API_VERSION`, template language, optional default country code, six event templates | Used only by the Phase 12 server-side dispatcher; empty values disable dispatch |
| AI service | `AI_SERVICE_URL`, `AI_INTERNAL_SERVICE_TOKEN`, `AI_WEB_TOOLS_URL` | Server-to-server requests; set the same 32+ character token in both app environments |
| Gemini | `GEMINI_API_KEY`, `GEMINI_MODEL` | Used server-side by the AI service; missing values disable chat without affecting the store |
| Dispatcher | `CRON_SECRET` | Protects `GET /api/internal/notifications/dispatch`; required to invoke scheduled processing |
| AI runtime | `AI_ENVIRONMENT`, `AI_SERVICE_NAME`, `AI_HOST`, `AI_PORT`, `AI_CORS_ORIGINS`, `AI_WEB_TOOLS_URL` | Used by FastAPI; keep browser CORS origins empty |

Never place secrets in `NEXT_PUBLIC_*` variables. Do not commit `.env`, `.env.local`,
or any populated environment file. Production values belong in each hosting provider's
secret configuration.
Production web deployments must use a PostgreSQL URL, an `AUTH_SECRET` of at least 32
characters, and a public canonical HTTPS `SITE_URL`. Auth.js infers its public host
from the trusted deployment host; this configuration does not require a separate
`AUTH_URL`. The web health route reports environment configuration only; it does not
prove database connectivity. Configure store currency under `/admin/settings` before accepting orders. See
[store configuration and accounts](STORE_CONFIGURATION_AND_ACCOUNTS.md).

The web app sends `nosniff`, frame denial, a restrictive `base-uri`/`object-src`/
`frame-ancestors` CSP, a referrer policy, and a permissions policy. HSTS is emitted
only by production builds and only has effect when the site is served over HTTPS;
the TLS ingress must enforce HTTPS before enabling production traffic. The CSP does
not set a script or resource allowlist because Next.js hydration, Cloudinary, and
deployment-specific integrations need a nonce-aware policy to safely restrict those.

The AI service has no PostgreSQL credentials. It asks the authenticated Next.js server
to execute a fixed allowlist of read-only store tools. `AI_WEB_TOOLS_URL` in the AI
environment must point to the web app's internal tools route. Conversations belong to
the signed-in CUSTOMER or a secure anonymous cookie; only customers can use order-status
tools. Gemini API keys remain in `apps/ai/.env` and are never sent to the browser. Guest
messages persist in the existing chat tables; do not send payment credentials or other
secrets in chat.

WhatsApp uses the official Graph API and approved message templates. `WHATSAPP_API_VERSION`
must use a `vNN.N` format and is intentionally not given a default; choose a version
supported by the connected Meta app. Template names and language must match approved
templates in that WhatsApp Business account. `WHATSAPP_DEFAULT_COUNTRY_CODE` is optional
and contains digits only; without it, recipients must be entered in international
`+` or `00` format. Set `CRON_SECRET` to a random value of at least 32 characters.
All WhatsApp values in `.env.example` are empty.

The admin bootstrap command also reads `ADMIN_BOOTSTRAP_EMAIL` and
`ADMIN_BOOTSTRAP_PASSWORD` only from its one-time process environment; do not add them
to an environment file or example.

See [deployment and final validation](DEPLOYMENT.md) for the Vercel/Render setup,
production variable matrix, migration procedure, and smoke-test checklist.
