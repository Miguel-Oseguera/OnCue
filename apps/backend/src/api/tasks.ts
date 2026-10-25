import { Hono } from "hono";
import { eq, and, exists } from "drizzle-orm";
import { db } from "@/db.js";
import { task, taskAssignee, teamMember } from "@/schema.js";
import { requireSession } from "@/auth.js";

const tasks = new Hono().basePath("/tasks");

tasks.get("/", requireSession, async (c) => {
  const session = c.get("session");
  const { teamId, claimedBy } = c.req.query();

  const tasks = await db
    .select()
    .from(task)
    .where(
      and(
        teamId ? eq(task.teamId, teamId) : undefined,
        claimedBy
          ? exists(
              db
                .select()
                .from(taskAssignee)
                .where(eq(taskAssignee.memberId, session.user.id)),
            )
          : undefined,
      ),
    );
  c.status(200);
  return c.json(tasks);
});

tasks.post("/claim/:taskId", requireSession, async (c) => {
  const session = c.get("session");
  const { taskId } = c.req.param();

  return db.transaction(
    async (tx) => {
      const [target] = await tx
        .select({ slots: task.slots, teamId: task.teamId })
        .from(task)
        .where(eq(task.id, taskId))
        .for("update");
      if (!target) return c.notFound();

      if (target.teamId !== null) {
        const [membership] = await tx
          .select({ userId: teamMember.userId })
          .from(teamMember)
          .where(
            and(
              eq(teamMember.teamId, target.teamId),
              eq(teamMember.userId, session.user.id),
            ),
          )
          .limit(1);
        if (!membership) {
          return c.json({ error: "You must belong to this task's team" }, 403);
        }
      }

      const claims = await tx
        .select({ memberId: taskAssignee.memberId })
        .from(taskAssignee)
        .where(eq(taskAssignee.taskId, taskId));

      if (claims.length >= target.slots) {
        return c.body(
          "Assignments have already been filled for this task",
          409,
          {
            "Content-Type": "text/plain",
          },
        );
      }

      await tx.insert(taskAssignee).values({
        memberId: session.user.id,
        taskId,
      });
      return c.body("Assignment create successful", 200, {
        "Content-Type": "text/plain",
      });
    },
    { isolationLevel: "read committed" },
  );
});

tasks.post("/new", requireSession, (c) => c.text("new task created!"));

export default tasks;
