
import { Hono } from "hono";
import { eq, inArray } from "drizzle-orm";
import { requireSession } from "../auth.js";
import { db } from "../db.js";
import { aiActivity, media } from "../schema.js";
import { runLogisticsAgent } from "../agent/index.js";
import { createTask } from "../tasks.js";
import { aiSchema, validate } from "./validation.js";

const ai = new Hono().post(
  "/",
  requireSession,
  validate("json", aiSchema),
  async (c) => {
    const { text, source, mediaIds } = c.req.valid("json");

    // Resolve transcripts from any attached media.
    const attachedMedia = mediaIds.length
      ? await db
          .select({
            mediaId: media.mediaId,
            transcript: media.transcript,
          })
          .from(media)
          .where(inArray(media.mediaId, mediaIds))
      : [];

    if (attachedMedia.length !== mediaIds.length) {
      return c.json({ error: "Media not found" }, 400);
    }

    const transcripts = attachedMedia
      .map((item) => item.transcript?.trim())
      .filter((value): value is string => Boolean(value));

    const report = [text, ...transcripts].filter(Boolean).join("\n\n");

    if (!report.trim()) {
      return c.json({ error: "No report text or transcripts available" }, 400);
    }

    // Analyze the report with Gemini.
    const analysis = await runLogisticsAgent(report);

    // Match Gemini's urgency levels to the database.
    const priority =
      analysis.urgency === "critical" ? "urgent" : analysis.urgency;

    // Create an unassigned task for staff to review.
    const createdTask = await createTask({
      title: analysis.issueSummary.slice(0, 200),
      description: [
        `Category: ${analysis.category}`,
        `Source: ${source}`,
        `Original report: ${report}`,
        "",
        "Recommended actions:",
        ...analysis.recommendedActions.map((action) => `- ${action}`),
      ].join("\n").slice(0, 10_000),
      priority,
      teamId: null,
      assigneeIds: [],
      slots: 1,
      location: null,
    });

    // Save Gemini's analysis to the activity log.
    await db.insert(aiActivity).values({
      taskId: createdTask.id,
      report,
      decision: JSON.stringify(analysis),
      action: `Created task ${createdTask.id}`,
    });

    // Associate any attached media with the new task.
    if (mediaIds.length) {
      await db
        .update(media)
        .set({ taskId: createdTask.id })
        .where(inArray(media.mediaId, mediaIds));
    }

    return c.json(
      {
        processed: true,
        analysis,
        tasks: [createdTask],
      },
      200,
    );
  },
);

export default ai;
