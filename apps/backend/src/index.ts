import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { pool } from "./db.js";
import { env } from "./env.js";

const server = serve({
  fetch: app.fetch,
  port: env.port,
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    server.close(() => {
      void pool.end().catch(() => {
        process.exitCode = 1;
      });
    });
  });
}
