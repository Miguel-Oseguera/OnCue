import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { taskPriorities, taskStatuses } from "../schema.js";

// Preserve schema input defaults and parsed output types in the mobile client.
export function validate<
  T extends "json" | "param" | "query" | "form",
  S extends z.ZodType,
>(target: T, schema: S) {
  return zValidator(target, schema, (result, c) => {
    if (!result.success) {
      return c.json(
        { error: "Invalid request", details: z.flattenError(result.error) },
        400,
      );
    }
  });
}

const assigneeIds = z
  .array(z.string().min(1).max(200))
  .max(100)
  .refine(
    (ids) => new Set(ids).size === ids.length,
    "Assignee IDs must be unique",
  );

export const createTaskSchema = z
  .strictObject({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(10_000).default(""),
    priority: z.enum(taskPriorities),
    teamId: z.guid().nullable().default(null),
    assigneeIds: assigneeIds.default([]),
    slots: z.number().int().min(1).max(100).default(1),
    location: z.string().trim().max(500).nullable().default(null),
  })
  .refine((input) => input.assigneeIds.length <= input.slots, {
    message: "Assignments exceed task slots",
    path: ["assigneeIds"],
  });

export const updateTaskSchema = z
  .strictObject({
    status: z.enum(taskStatuses).optional(),
    assigneeIds: assigneeIds.optional(),
  })
  .refine(
    (input) => Object.keys(input).length > 0,
    "Provide status or assigneeIds",
  );

export const taskParams = z.object({ taskId: z.guid() });
export const mediaParams = z.object({ mediaId: z.guid() });
export const taskQuery = z.strictObject({
  teamId: z.guid().optional(),
  claimedBy: z.literal("me").optional(),
});
export const aiSchema = z
  .strictObject({
    text: z.string().trim().max(10_000).default(""),
    source: z.string().trim().min(1).max(50),
    images: z
      .union([z.file().transform((file) => [file]), z.array(z.file()).max(10)])
      .default([]),
  })
  .refine((input) => input.text.length > 0 || input.images.length > 0, {
    message: "Provide text or images",
  });
