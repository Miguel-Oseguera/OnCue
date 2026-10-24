import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createMiddleware } from "hono/factory";
import { auth, trustedOrigins } from "./auth.js";
import { db } from "./db.js";

const requireSession = createMiddleware<{
  Variables: { session: typeof auth.$Infer.Session };
}>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  c.set("session", session);
  await next();
});

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
