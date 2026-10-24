# OnCue backend

Hono serves the API on Node 24. Drizzle connects to Neon Postgres through
`@neondatabase/serverless` over WebSockets. Better Auth runs in this backend and
stores its users, accounts, and sessions in the Drizzle tables. Neon's managed
Auth service is not used.

## Local setup

1. Run `pnpm install` at the workspace root.
2. Configure `apps/backend/.env` using `.env.example`. Set `DATABASE_URL` to your
   development branch's pooled URL. Set `BETTER_AUTH_SECRET` to a random value of
   at least 32 characters. `openssl rand -base64 32` generates a suitable value.
3. Run `pnpm --filter backend db:migrate` to apply the committed migrations.
4. Run `pnpm --filter backend dev`. The default API URL is `http://localhost:3002`.
5. Start the mobile app with `pnpm --filter mobile start`.

Environment precedence is the process environment, backend `.env.local`, backend
`.env`, workspace `.env.local`, then workspace `.env`. This keeps a backend-local
development database from being replaced by Neon's workspace defaults.

`BETTER_AUTH_URL` is the backend's public URL. Use HTTPS when deploying. Add
browser origins to the comma-separated `AUTH_TRUSTED_ORIGINS` value. Local Expo
web origins on port 8081 and Expo Go deep links are trusted during development.
The native app's `mobile://` scheme is trusted in every environment.

Only the API URL belongs in the mobile app. Never put database credentials or
`BETTER_AUTH_SECRET` in an `EXPO_PUBLIC_` variable.

## Database changes

The committed schema is `src/auth-schema.ts`. After changing Better Auth plugins
or options that affect its schema, run `pnpm --filter backend auth:generate`.
Then run `pnpm --filter backend db:generate`, review the generated SQL, and run
`pnpm --filter backend db:migrate` against your development branch first.

The migration runner uses the matching direct connection over WebSockets. If
`DATABASE_URL_UNPOOLED` points at a different database branch, it derives the
direct URL from `DATABASE_URL` instead. Migration history is stored by Drizzle.

## API

- `/api/auth/*`: Better Auth email/password sign-up, sign-in, session, and sign-out.
- `GET /api/me`: the signed-in user's ID, name, and email. Returns 401 without a
  valid session. It never returns the session token.
- `GET /health/db`: executes a Drizzle query and returns 200 when connected, or
  503 when the database is unavailable.

Native requests to protected API routes must forward the cookie returned by
`authClient.getCookie()`. The mobile app's typed Hono client does this. Browser
requests use `credentials: 'include'`.

## Verification

`pnpm --filter backend test` exercises the real Hono handler and configured
development database. It creates a disposable account, verifies password hashing,
origin checks, protected access, session restoration, sign-in, and revocation on
sign-out. It removes that account and its related records afterward.

`pnpm --filter backend build` also emits API declarations used by the mobile
client. Run it before checking mobile types on a fresh checkout. The root
`pnpm check-types` command handles that dependency automatically.
