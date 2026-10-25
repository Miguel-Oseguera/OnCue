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

The application schema is `src/schema.ts`. It also exports the generated Better
Auth tables from `src/auth-schema.ts`. After changing Better Auth plugins
or options that affect its schema, run `pnpm --filter backend auth:generate`.
Then run `pnpm --filter backend db:generate`, review the generated SQL, and run
`pnpm --filter backend db:migrate` against your development branch first.

The application tables follow `Schema.drawio`:

- Events have a name, location, and an array of calendar dates.
- Members belong to an event. Their name and profile picture are independent of
  Better Auth users.
- Event owners use `event_owner`. Team membership uses `team_member`, whose
  `role` enum supports `lead`, `member`, and `volunteer`. Tasks have a `slots`
  count and use `task_assignee` to support multiple assigned members. Each join
  table prevents duplicate pairs.
- Schedule entries have a generated ID and a timezone-aware start time.
- Media and AI activity belong to an event and can optionally reference a task.
  Photo and video/audio fields store file URLs or storage keys. Transcripts,
  decisions, and actions can be absent.
- Priority and status are required text because the diagram defines no allowed
  values. All application IDs are generated UUIDs.

Deleting an event deletes its application records. Deleting a task removes its
assignments and clears task references on media and AI activity. Callers must
ensure linked members, teams, tasks, media, and AI activity belong to the same
event; foreign keys validate each referenced record, but do not enforce this
shared event rule.

The migration runner uses the matching direct connection over WebSockets. If
`DATABASE_URL_UNPOOLED` points at a different database branch, it derives the
direct URL from `DATABASE_URL` instead. Migration history is stored by Drizzle.

## Demo data

After migrations, run `pnpm --filter backend db:seed` to seed the configured
`DATABASE_URL`. Use your development branch.

The script uses [`drizzle-seed`](https://orm.drizzle.team/docs/seed-overview)
with seed `42` and generator version `2`. It creates one OnCue Demo Hackathon on
October 24-25, 2026, with four generated members, two teams, three schedule
entries, four tasks, an event owner, team memberships, task assignments, and
sample transcripts and AI activity. Drizzle generates IDs and foreign-key
relationships. Using one event keeps all related records in that event.
Team membership roles use the schema's enum values. Tasks have one to four slots.

The seed runs in one transaction. If the demo event already exists, the script
skips seeding and preserves existing values. It does not reset tables or repair
partially deleted demo data. Better Auth tables are excluded, so this script
does not create a login. The event ID is
`0c0e0000-0000-4000-8000-000000000001`.

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

The seed test checks repeat runs, preserved edits, membership roles, positive task
slots, and relationships within the demo event. It rolls back all verification changes.

`pnpm --filter backend build` also emits API declarations used by the mobile
client. Run it before checking mobile types on a fresh checkout. The root
`pnpm check-types` command handles that dependency automatically.
