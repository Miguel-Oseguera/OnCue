import { tool, type Tool } from "ai";
import { z } from "zod";
import { createTaskSchema } from "../api/validation.js";
import { createTaskFromReport, findRelatedTasks } from "../tasks.js";

type ReportContext = Omit<Parameters<typeof createTaskFromReport>[0], "input">;
type LogisticsTools = {
  findRelatedTasks: Tool<
    Parameters<typeof findRelatedTasks>[0],
    Awaited<ReturnType<typeof findRelatedTasks>>
  >;
  createTask: Tool<
    z.output<typeof createTaskSchema>,
    Awaited<ReturnType<typeof createTaskFromReport>>
  >;
};

// The model supplies task fields; the current report and photos come from the server.
export function createLogisticsTools(context: ReportContext): LogisticsTools {
  return {
    findRelatedTasks: tool({
      description:
        "Find up to 10 open or in-progress tasks matching a short search phrase in their title, description, or location. Use this before creating a task to check for an existing issue. Results are newest first, with descriptions truncated to 500 characters.",
      inputSchema: z.strictObject({
        query: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .describe("A short search phrase, such as projector or water."),
        location: z
          .string()
          .trim()
          .min(1)
          .max(500)
          .optional()
          .describe("Optional location text to narrow the search."),
      }),
      execute: findRelatedTasks,
    }),
    createTask: tool({
      description:
        "Create a task for a new actionable issue and attach the current report and its photos. Use priority urgent for critical issues. Leave teamId null and assigneeIds empty unless their IDs are known. Only one task can be created per report; repeating this call returns that task without changing it.",
      inputSchema: createTaskSchema,
      execute: (input) => createTaskFromReport({ ...context, input }),
    }),
  };
}
