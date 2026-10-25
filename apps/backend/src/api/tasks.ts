import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "@/db.js";
import { task, taskAssignee } from "@/schema.js";
import { requireSession } from "@/auth.js";

const tasks = new Hono().basePath("/tasks");

tasks.get("/all", async (c) => {
  const tasks = await db.select().from(task);
  c.status(200);
  return c.json(tasks);
});

tasks.post("/claim/:taskId", requireSession, async (c) => {
  const session = c.get("session");
  const { taskId } = c.req.param();

  const res = db.transaction(async (tx) => {
    const [target] = await tx
      .select({ slots: task.slots })
      .from(task)
      .where(eq(task.id, taskId))
      .for("update");

    if (!target) return c.notFound();

    const claims = await tx
      .select({ memberId: taskAssignee.memberId })
      .from(taskAssignee)
      .where(eq(taskAssignee.taskId, taskId));

    if (claims.length >= target.slots) {
      c.status(505);
    }
  });
});

tasks.post("/new", (c) => c.text("new task created!"));

export default tasks;
