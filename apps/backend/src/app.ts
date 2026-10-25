import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { auth, trustedOrigins } from "./auth.js";
import { db } from "./db.js";
import api from "./api/api.js";
import { requireSession } from "./auth.js";

export const app = new Hono()
  .onError((error, c) => {
    if (error instanceof HTTPException)
      return c.json({ error: error.message }, error.status);
    console.error(
      JSON.stringify({
        event: "api_request_failed",
        method: c.req.method,
        path: c.req.path,
        error: error.name,
      }),
    );
    return c.json({ error: "Internal server error" }, 500);
  })
  .notFound((c) => c.json({ error: "Not found" }, 404))
  .use(
    "/api/*",
    cors({
      origin: (origin) =>
        trustedOrigins.includes(origin) ? origin : undefined,
      credentials: true,
      allowHeaders: ["Content-Type", "Cookie", "Authorization"],
      allowMethods: ["GET", "POST", "PATCH", "OPTIONS"],
    }),
  )
  .use("/api/*", async (c, next) => {
    const origin = c.req.header("Origin");
    if (
      origin &&
      !["GET", "HEAD", "OPTIONS"].includes(c.req.method) &&
      !trustedOrigins.includes(origin)
    ) {
      return c.json({ error: "Untrusted origin" }, 403);
    }
    await next();
  })
  .route("/", api)
  .all("/api/auth/*", (c) => auth.handler(c.req.raw))
  .get("/", (c) => c.text("Hello Hono!"))
  .get("/health/db", async (c) => {
    try {
      await db.execute(sql`SELECT 1`);
      return c.json({ status: "ok", database: "connected" });
    } catch {
      return c.json({ status: "error", database: "unavailable" }, 503);
    }
  })
  .get("/api/me", requireSession, (c) => {
    const { user } = c.get("session");
    return c.json({
      user: { id: user.id, name: user.name, email: user.email },
    });
  });

export type AppType = typeof app;
