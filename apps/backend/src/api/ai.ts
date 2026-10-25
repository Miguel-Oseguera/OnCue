import { Hono } from "hono";
import { requireSession } from "../auth.js";
import { aiSchema, validate } from "./validation.js";

const ai = new Hono().post(
  "/",
  requireSession,
  validate("json", aiSchema),
  (c) => {
    // Placeholder only. Do not persist reports, invoke AI, or change tasks.
    return c.json({ processed: false, tasks: [] }, 200);
  },
);

export default ai;
