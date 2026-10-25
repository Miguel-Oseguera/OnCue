import { eq, notExists } from "drizzle-orm";
import { seed } from "drizzle-seed";
import type { db } from "./db.js";
import {
  aiActivity,
  media,
  roleEnum,
  schedule,
  task,
  taskAssignee,
  team,
  teamMember,
  user,
} from "./schema.js";

export const demoTeamId = "0c0e0000-0000-4000-8000-000000000001";
export const seedTables = {
  team,
  teamMember,
  task,
  taskAssignee,
  schedule,
  media,
  aiActivity,
};

type SeedTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Seed application data using existing auth users. Credentials and sessions are untouched.
export async function seedDemo(tx: SeedTransaction) {
  const existing = await tx.query.team.findFirst({
    where: eq(team.id, demoTeamId),
    columns: { id: true },
  });
  if (existing) return false;

  await seed(
    tx,
    { team, schedule, task, media, aiActivity },
    { seed: 20261025, version: "2" },
  ).refine((f) => ({
    team: {
      count: 1,
      columns: {
        id: f.default({ defaultValue: demoTeamId }),
        teamName: f.default({ defaultValue: "OnCue Demo Crew" }),
      },
    },
    schedule: {
      count: 3,
      columns: {
        activity: f.valuesFromArray({
          values: ["Check-in opens", "Opening ceremony", "Volunteer briefing"],
          isUnique: true,
        }),
        room: f.valuesFromArray({
          values: ["Main lobby", "Main stage", "Exhibit hall"],
        }),
        startTime: f.date({
          minDate: "2026-10-25T08:00:00-05:00",
          maxDate: "2026-10-25T10:00:00-05:00",
        }),
        endTime: f.date({
          minDate: "2026-10-25T11:00:00-05:00",
          maxDate: "2026-10-25T12:00:00-05:00",
        }),
      },
    },
    task: {
      count: 4,
      columns: {
        teamId: f.default({ defaultValue: demoTeamId }),
        slots: f.int({ minValue: 1, maxValue: 4 }),
        title: f.valuesFromArray({
          values: [
            "Set up the check-in desk and badges",
            "Test the main-stage projector and microphones",
            "Confirm lunch delivery with the caterer",
            "Place directional signs outside workshop rooms",
          ],
          isUnique: true,
        }),
        priority: f.valuesFromArray({ values: ["low", "medium", "high"] }),
        status: f.valuesFromArray({
          values: ["open", "in_progress", "completed"],
        }),
      },
    },
    media: {
      count: 2,
      columns: {
        photo: f.default({ defaultValue: null }),
        photoData: f.default({ defaultValue: null }),
        contentType: f.default({ defaultValue: null }),
        videoAudio: f.default({ defaultValue: null }),
        transcript: f.valuesFromArray({
          values: [
            "The projector works. Bring spare batteries for the wireless microphone.",
            "Volunteer briefing complete. Direct participants to the main lobby.",
          ],
          isUnique: true,
        }),
      },
    },
    aiActivity: {
      count: 2,
      columns: {
        report: f.valuesFromArray({
          values: [
            "The wireless microphone needs fresh batteries.",
            "Check-in setup is complete. Catering confirmation is pending.",
          ],
          isUnique: true,
        }),
        decision: f.default({ defaultValue: null }),
        action: f.default({ defaultValue: null }),
      },
    },
  }));

  const users = await tx
    .select({ id: user.id })
    .from(user)
    .where(
      notExists(
        tx.select().from(teamMember).where(eq(teamMember.userId, user.id)),
      ),
    )
    .orderBy(user.id)
    .limit(4);
  if (users.length > 0) {
    const userIds = users.map((user) => user.id);
    const tasks = await tx
      .select({ id: task.id })
      .from(task)
      .where(eq(task.teamId, demoTeamId));
    await seed(
      tx,
      { teamMember, taskAssignee },
      { seed: 20261025, version: "2" },
    ).refine((f) => ({
      teamMember: {
        count: users.length,
        columns: {
          teamId: f.default({ defaultValue: demoTeamId }),
          userId: f.valuesFromArray({ values: userIds, isUnique: true }),
          role: f.valuesFromArray({ values: roleEnum.enumValues }),
        },
      },
      taskAssignee: {
        count: users.length,
        columns: {
          taskId: f.valuesFromArray({
            values: tasks.map((task) => task.id),
            isUnique: true,
          }),
          memberId: f.valuesFromArray({ values: userIds, isUnique: true }),
        },
      },
    }));
  }

  return true;
}
