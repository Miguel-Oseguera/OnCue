import { randomUUID } from "node:crypto";
import { and, desc, eq, exists, ilike, inArray, or, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import type { z } from "zod";
import { db } from "./db.js";
import { aiActivity, media, task, taskAssignee, team, user } from "./schema.js";
import type { createTaskSchema, updateTaskSchema } from "./api/validation.js";
import type { readPhoto } from "./photos.js";

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
    with: { assignees: true, aiActivity: true },
    orderBy: [desc(task.createdAt), task.id],
  });
  return rows.map(taskResponse);
}

// Match literal text, including user-supplied percent signs and underscores.
function containsText(value: string) {
  return `%${value.replace(/[\\%_]/g, "\\$&")}%`;
}

export async function findRelatedTasks(input: {
  query: string;
  location?: string;
}) {
  const query = containsText(input.query);
  return db
    .select({
      id: task.id,
      title: task.title,
      description: sql<string>`left(${task.description}, 500)`,
      status: task.status,
      priority: task.priority,
      location: task.location,
      teamId: task.teamId,
    })
    .from(task)
    .where(
      and(
        inArray(task.status, ["open", "in_progress"]),
        or(
          ilike(task.title, query),
          ilike(task.description, query),
          ilike(task.location, query),
        ),
        input.location
          ? ilike(task.location, containsText(input.location))
          : undefined,
      ),
    )
    .orderBy(desc(task.createdAt), task.id)
    .limit(10);
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

async function insertTask(
  tx: Transaction,
  input: z.output<typeof createTaskSchema>,
) {
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
}

export async function createTask(input: z.output<typeof createTaskSchema>) {
  return db.transaction((tx) => insertTask(tx, input));
}

// Lock the report so concurrent or repeated tool calls cannot create duplicate tasks.
export async function createTaskFromReport({
  input,
  reportId,
  source,
  images,
}: {
  input: z.output<typeof createTaskSchema>;
  reportId: string;
  source: string;
  images: Awaited<ReturnType<typeof readPhoto>>[];
}) {
  return db.transaction(async (tx) => {
    const [report] = await tx
      .select({ taskId: aiActivity.taskId })
      .from(aiActivity)
      .where(eq(aiActivity.reportId, reportId))
      .for("update");
    if (!report) throw new HTTPException(404, { message: "Report not found" });
    if (report.taskId) return savedTask(tx, report.taskId);

    const created = await insertTask(tx, {
      ...input,
      description: [`Source: ${source}`, input.description]
        .join("\n\n")
        .slice(0, 10_000),
    });
    await tx
      .update(aiActivity)
      .set({
        taskId: created.id,
        action: `Created task ${created.id}`,
      })
      .where(eq(aiActivity.reportId, reportId));

    if (images.length) {
      await tx.insert(media).values(
        images.map(({ data, contentType }) => {
          const mediaId = randomUUID();
          return {
            mediaId,
            taskId: created.id,
            photo: `/api/media/${mediaId}`,
            photoData: data,
            contentType,
          };
        }),
      );
    }
    return created;
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
