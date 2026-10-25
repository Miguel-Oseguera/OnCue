import { Hono } from "hono";
import { requireSession } from "../auth.js";
import { claimTask, createTask, listTasks, updateTask } from "../tasks.js";
import {
  createTaskSchema,
  taskParams,
  taskQuery,
  updateTaskSchema,
  validate,
} from "./validation.js";

const tasks = new Hono()
  .get("/", requireSession, validate("query", taskQuery), async (c) => {
    const query = c.req.valid("query");
    return c.json(
      await listTasks({
        teamId: query.teamId,
        claimedBy: query.claimedBy ? c.get("session").user.id : undefined,
      }),
      200,
    );
  })
  .post("/", requireSession, validate("json", createTaskSchema), async (c) => {
    return c.json(await createTask(c.req.valid("json")), 201);
  })
  .patch(
    "/:taskId",
    requireSession,
    validate("param", taskParams),
    validate("json", updateTaskSchema),
    async (c) => {
      return c.json(
        await updateTask(c.req.valid("param").taskId, c.req.valid("json")),
        200,
      );
    },
  )
  .post(
    "/claim/:taskId",
    requireSession,
    validate("param", taskParams),
    async (c) => {
      return c.json(
        await claimTask(c.req.valid("param").taskId, c.get("session").user.id),
        200,
      );
    },
  );

export default tasks;
