import "dotenv/config";
import { createGoogle } from "@ai-sdk/google";
import { ToolLoopAgent, Output, isStepCount, type FilePart } from "ai";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { aiActivity } from "../schema.js";
import { AGENT_INSTRUCTIONS } from "./instructions.js";
import type { readPhoto } from "../photos.js";
import { createLogisticsTools } from "./tools.js";

const LogisticsAnalysisSchema = z.object({
  issueSummary: z.string(),
  category: z.enum([
    "staffing",
    "supplies",
    "equipment",
    "schedule",
    "safety",
    "venue",
    "other",
  ]),
  urgency: z.enum(["low", "medium", "high", "critical"]),
  recommendedActions: z.array(z.string()).min(1).max(5),
  missingInformation: z.array(z.string()),
  requiresHumanAttention: z.boolean(),
});

export type LogisticsAnalysis = z.infer<typeof LogisticsAnalysisSchema>;

// Create on demand so other API routes can start without an AI key.
export function createLogisticsAgent(
  context: Parameters<typeof createLogisticsTools>[0],
) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing.");
  }

  const google = createGoogle({ apiKey });

  return new ToolLoopAgent({
    model: google("gemini-3.5-flash-lite"),
    instructions: AGENT_INSTRUCTIONS,
    tools: createLogisticsTools(context),
    stopWhen: isStepCount(5),
    output: Output.object({ schema: LogisticsAnalysisSchema }),
  });
}

export async function runLogisticsAgent({
  message,
  history = [],
  images = [],
  source = "agent",
}: {
  message: string;
  history?: string[];
  images?: Awaited<ReturnType<typeof readPhoto>>[];
  source?: string;
}) {
  if (!message.trim() && images.length === 0) {
    throw new Error("A logistics report is required.");
  }

  // Persist the report before invoking AI so failures leave the original observation intact.
  const [report] = await db
    .insert(aiActivity)
    .values({
      report:
        message || "Analyze the attached images for event logistics issues.",
    })
    .returning({ reportId: aiActivity.reportId });
  if (!report) throw new Error("Report insert returned no ID");

  const agent = createLogisticsAgent({
    reportId: report.reportId,
    source,
    images,
  });
  const { output, steps } = await agent.generate({
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `
You are analyzing a live event logistics report.
Report source: ${source}

Previous reports about this incident:
${history.length ? history.join("\n") : "None"}

Latest report:
${message || "Analyze the attached images for event logistics issues."}

Analyze the current situation using the previous reports
for context. Prioritize the latest information.
    `,
          },
          ...images.map(({ data, contentType }): FilePart => ({
            type: "file",
            data,
            mediaType: contentType,
          })),
        ],
      },
    ],
  });

  const createdTasks = steps
    .flatMap((step) => step.staticToolResults)
    .flatMap((result) =>
      result.toolName === "createTask" ? [result.output] : [],
    );
  const tasks = [
    ...new Map(createdTasks.map((task) => [task.id, task])).values(),
  ];
  await db
    .update(aiActivity)
    .set({
      decision: JSON.stringify(output),
      action:
        tasks.map((task) => `Created task ${task.id}`).join("; ") ||
        "No task created",
    })
    .where(eq(aiActivity.reportId, report.reportId));

  return { analysis: output, tasks, reportId: report.reportId };
}
