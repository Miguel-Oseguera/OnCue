import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { requireSession } from "../auth.js";
import { db } from "../db.js";
import { aiActivity, media } from "../schema.js";
import { runLogisticsAgent } from "../agent/index.js";
import { createTask } from "../tasks.js";
import { maxPhotoBytes, readPhoto } from "../photos.js";
import { aiSchema, validate } from "./validation.js";

const ai = new Hono().post(
  "/",
  requireSession,
  bodyLimit({
    maxSize: maxPhotoBytes + 64 * 1024,
    onError: (c) =>
      c.json({ error: "Upload exceeds the 10 MiB image limit" }, 413),
  }),
  validate("form", aiSchema),
  async (c) => {
    const { text, source, images } = c.req.valid("form");
    if (images.reduce((size, image) => size + image.size, 0) > maxPhotoBytes) {
      return c.json({ error: "Images exceed 10 MiB in total" }, 413);
    }
    const photos = await Promise.all(images.map(readPhoto));
    const report =
      text || "Analyze the attached images for event logistics issues.";

    // Keep the report even if AI processing or task creation fails.
    const reportId = randomUUID();
    await db.insert(aiActivity).values({ reportId, report });

    // Send the report and image bytes to Gemini together.
    const analysis = await runLogisticsAgent(report, [], photos);

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
      ]
        .join("\n")
        .slice(0, 10_000),
      priority,
      teamId: null,
      assigneeIds: [],
      slots: 1,
      location: null,
    });

    // Complete the activity record with Gemini's analysis and the new task.
    await db
      .update(aiActivity)
      .set({
        taskId: createdTask.id,
        decision: JSON.stringify(analysis),
        action: `Created task ${createdTask.id}`,
      })
      .where(eq(aiActivity.reportId, reportId));

    // Store uploaded images as evidence for the new task.
    if (photos.length) {
      await db.insert(media).values(
        photos.map(({ data, contentType }) => {
          const mediaId = randomUUID();
          return {
            mediaId,
            taskId: createdTask.id,
            photo: `/api/media/${mediaId}`,
            photoData: data,
            contentType,
          };
        }),
      );
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
