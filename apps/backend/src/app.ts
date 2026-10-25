import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth, trustedOrigins } from "./auth.js";
import { db } from "./db.js";
import api from "@/api/api.js";
import { requireSession } from "./auth.js";

export const app = new Hono()
  .use(
    "/api/*",
    cors({
      origin: (origin) =>
        trustedOrigins.includes(origin) ? origin : undefined,
      credentials: true,
      allowHeaders: ["Content-Type", "Cookie", "Authorization"],
      allowMethods: ["GET", "POST", "OPTIONS"],
    }),
  )
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
