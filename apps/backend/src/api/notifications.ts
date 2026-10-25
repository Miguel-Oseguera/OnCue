import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requireSession } from "../auth.js";
import { db } from "../db.js";
import { pushToken } from "../schema.js";
import { validate } from "./validation.js";

const tokenSchema = z.object({
  token: z.string().regex(/^(Expo(nent)?PushToken)\[[^\]]+\]$/),
  platform: z.enum(["ios", "android"]),
});

const notifications = new Hono()
  .post(
    "/register",
    requireSession,
    validate("json", tokenSchema),
    async (c) => {
      const userId = c.get("session").user.id;
      const { token, platform } = c.req.valid("json");

      await db
        .insert(pushToken)
        .values({ userId, token, platform })
        .onConflictDoUpdate({
          target: pushToken.token,
          set: {
            userId,
            platform,
            updatedAt: new Date(),
          },
        });

      return c.json({ success: true }, 200);
    },
  )
  .post(
    "/unregister",
    requireSession,
    validate("json", tokenSchema),
    async (c) => {
      const userId = c.get("session").user.id;
      const { token } = c.req.valid("json");

      await db
        .delete(pushToken)
        .where(
          and(
            eq(pushToken.token, token),
            eq(pushToken.userId, userId),
          ),
        );

      return c.json({ success: true }, 200);
    },
  );

export default notifications;