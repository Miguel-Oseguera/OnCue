# Backend

The Hono API runs on Node and connects to Neon Postgres using the
`@neondatabase/serverless` WebSocket driver. It provides the node-postgres pool
API over port 443. Direct TCP connections on port 5432 timed out in the current
development environment. Node 24 provides the WebSocket implementation.

From the workspace root, run `neon deploy` to reconcile `neon.ts` and pull the
database credentials into `.env.local`, or `.env` when it already exists. The
backend loads these files automatically. Existing process environment variables
take precedence, followed by `.env.local`, then `.env`.

Run `pnpm --filter backend dev` from the workspace root. The API listens on port
3002 so it can run alongside the web app on port 3000 and docs on port 3001.
Set `PORT` to override it.

`GET /health/db` executes a real query against Postgres. It returns HTTP 200 with
`{"status":"ok","database":"connected"}` when the database is reachable, or
HTTP 503 when the query fails. It does not return database credentials or errors.

The shared connection pool reads `DATABASE_URL`. Use `DATABASE_URL_UNPOOLED` for
future migrations or operations that need session state. Database credentials
belong in this backend, never in a browser or Expo client.
