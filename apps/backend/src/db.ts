import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { env } from "./env.js";
import * as schema from "./auth-schema.js";

// WebSockets work where outbound Postgres TCP is unavailable. Node 24 supplies WebSocket.
export const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 5,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
});

pool.on("error", () => {
  console.error("An idle database connection failed.");
});

export const db = drizzle({ client: pool, schema });
