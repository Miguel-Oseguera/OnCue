import { and, desc, eq, exists, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { z } from "zod";
import { db } from "./db.js";
import { task, taskAssignee, team, user } from "./schema.js";
import type { createTaskSchema, updateTaskSchema } from "./api/validation.js";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type TaskWithAssignees = typeof task.$inferSelect & {
  assignees: { memberId: string }[];
};

export function taskResponse(row: TaskWithAssignees) {
  const { assignees, createdAt, ...fields } = row;
  return {
    ...fields,
    assigneeIds: assignees.map((assignment) => assignment.memberId).sort(),
    createdAt: createdAt.toISOString(),
  };
}

export async function listTasks(
  filters: { teamId?: string; claimedBy?: string } = {},
) {
  const rows = await db.query.task.findMany({
    where: and(
      filters.teamId ? eq(task.teamId, filters.teamId) : undefined,
      filters.claimedBy
        ? exists(
            db
              .select()
              .from(taskAssignee)
              .where(
                and(
                  eq(taskAssignee.taskId, task.id),
                  eq(taskAssignee.memberId, filters.claimedBy),
                ),
              ),
          )
        : undefined,
    ),
    with: { assignees: true },
    orderBy: [desc(task.createdAt), task.id],
  });
  return rows.map(taskResponse);
}

async function savedTask(tx: Transaction, id: string) {
  const row = await tx.query.task.findFirst({
    where: eq(task.id, id),
    with: { assignees: true },
  });
  if (!row) throw new HTTPException(404, { message: "Task not found" });
  return taskResponse(row);
}

async function checkAssignees(tx: Transaction, ids: string[], slots: number) {
  if (ids.length > slots) {
    throw new HTTPException(409, { message: "Assignments exceed task slots" });
  }
  if (ids.length === 0) return;
  const members = await tx
    .select({ id: user.id })
    .from(user)
    .where(inArray(user.id, ids))
    .for("key share");
  if (members.length !== ids.length) {
    throw new HTTPException(400, { message: "An assignee does not exist" });
  }
}

export async function createTask(input: z.output<typeof createTaskSchema>) {
  return db.transaction(async (tx) => {
    if (input.teamId !== null) {
      const [target] = await tx
        .select({ id: team.id })
        .from(team)
        .where(eq(team.id, input.teamId))
        .for("key share");
      if (!target) throw new HTTPException(400, { message: "Team not found" });
    }
    await checkAssignees(tx, input.assigneeIds, input.slots);
    const { assigneeIds, ...fields } = input;
    const [created] = await tx
      .insert(task)
      .values(fields)
      .returning({ id: task.id });
    if (!created) throw new Error("Task insert returned no ID");
    if (assigneeIds.length > 0) {
      await tx
        .insert(taskAssignee)
        .values(
          assigneeIds.map((memberId) => ({ taskId: created.id, memberId })),
        );
    }
    return savedTask(tx, created.id);
  });
}

export async function updateTask(
  id: string,
  input: z.output<typeof updateTaskSchema>,
) {
  return db.transaction(async (tx) => {
    // Claims and assignment updates lock the same row to prevent overfilling slots.
    const [target] = await tx
      .select({ slots: task.slots })
      .from(task)
      .where(eq(task.id, id))
      .for("update");
    if (!target) throw new HTTPException(404, { message: "Task not found" });
    if (input.assigneeIds !== undefined) {
      await checkAssignees(tx, input.assigneeIds, target.slots);
      await tx.delete(taskAssignee).where(eq(taskAssignee.taskId, id));
      if (input.assigneeIds.length > 0) {
        await tx
          .insert(taskAssignee)
          .values(
            input.assigneeIds.map((memberId) => ({ taskId: id, memberId })),
          );
      }
    }
    if (input.status !== undefined) {
      await tx
        .update(task)
        .set({ status: input.status })
        .where(eq(task.id, id));
    }
    return savedTask(tx, id);
  });
}

export async function claimTask(id: string, memberId: string) {
  return db.transaction(async (tx) => {
    const [target] = await tx
      .select({ slots: task.slots })
      .from(task)
      .where(eq(task.id, id))
      .for("update");
    if (!target) throw new HTTPException(404, { message: "Task not found" });
    const claims = await tx
      .select({ memberId: taskAssignee.memberId })
      .from(taskAssignee)
      .where(eq(taskAssignee.taskId, id));
    if (claims.some((claim) => claim.memberId === memberId))
      return savedTask(tx, id);
    if (claims.length >= target.slots) {
      throw new HTTPException(409, { message: "Task slots are full" });
    }
    await tx.insert(taskAssignee).values({ taskId: id, memberId });
    return savedTask(tx, id);
  });
}
