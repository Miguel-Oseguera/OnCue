import { fileURLToPath } from "node:url";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import { env } from "./env.js";

// Migrations use a direct branch connection over WebSockets, not PgBouncer.
const pool = new Pool({ connectionString: env.databaseUrlUnpooled });
try {
  await migrate(drizzle({ client: pool }), {
    migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)),
  });
  console.info("Database migrations applied.");
} finally {
  await pool.end();
}
