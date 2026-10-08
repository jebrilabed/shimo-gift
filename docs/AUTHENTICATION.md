# Authentication foundation

Phase 4 uses Auth.js v5 Credentials with the Prisma adapter and a short-lived,
encrypted JWT cookie session. Credentials are checked against an existing `User` row;
Auth.js does not register users. Passwords are stored only as salted scrypt hashes.
The session carries the user ID and role for framework session typing, but all
authorization helpers load the current role from PostgreSQL before granting access.

## Configuration and routes

Set `AUTH_SECRET` in `apps/web/.env.local` (generate a local secret with `npx auth
secret`) and configure `DATABASE_URL` as described in [the database guide](DATABASE.md).
The self-hosted app trusts the incoming host; configure the deployment ingress or
reverse proxy to validate `Host` headers before forwarding requests. No OAuth
credentials or `AUTH_URL` are required for the current credentials setup.

- `/ar/login` is the minimal Arabic RTL credentials form. Invalid credentials receive
  one generic message.
- `/api/auth/*` is the Auth.js route handler.
- `/admin` is a server-rendered protected placeholder. Signed-out requests go to the
  login page; a CUSTOMER receives not-found. Future server actions and API handlers
  should call `requireUser`, `requireRole`, or `requireAdmin` from
  `apps/web/src/lib/auth/authorization.ts`.

The Credentials provider requires JWT sessions. The Prisma adapter remains configured
for the planned Auth.js integration, but Credentials sign-ins are not persisted as
adapter sessions. Server helpers validate the Auth.js session and reload the user by
that session's ID; they do not accept user IDs or role values from requests. The
Customer relation stays optional, and existing guest carts/orders remain valid.

## First administrator

There is no seed account or default password. Apply database migrations, then invoke
the explicit `npm run auth:bootstrap-admin` command with temporary
`ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD` environment values supplied by
a trusted shell or secret manager. Use a unique email and a 16–128 character password.
The command only creates a new ADMIN and refuses to modify an existing account. It
deletes those values from its process environment after reading them, hashes the
password, never prints it, and is never run automatically. Do not commit these values
or place them in persistent environment examples. In production, run it once from a
controlled deployment operator session and then remove the temporary values.

## Abuse protection and limitations

An authenticated administrator can change their own password from `/admin/settings`
after confirming the current password. Password recovery remains unavailable.

Unknown emails and incorrect passwords receive the same result; an asynchronous dummy
scrypt verification reduces obvious account-timing differences. No registration,
password reset, MFA, or rate limiter is included. Add distributed rate limiting and
brute-force monitoring before exposing credentials authentication publicly. A real
PostgreSQL URL and `AUTH_SECRET` are needed to test a full login and persisted identity;
the local authorization tests do not claim production authentication readiness.
