import { eq } from "drizzle-orm";
import { seed } from "drizzle-seed";
import type { db } from "./db.js";
import {
  aiActivity,
  event,
  eventOwner,
  media,
  member,
  roleEnum,
  schedule,
  task,
  taskAssignee,
  team,
  teamMember,
} from "./schema.js";

export const demoEventId = "0c0e0000-0000-4000-8000-000000000001";
type SeedTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Seed only application tables. Auth accounts are managed through Better Auth.
export async function seedDemo(tx: SeedTransaction) {
  const existing = await tx.query.event.findFirst({
    where: eq(event.id, demoEventId),
    columns: { id: true },
  });
  if (existing) return false;

  await seed(
    tx,
    {
      event,
      member,
      eventOwner,
      team,
      teamMember,
      schedule,
      task,
      taskAssignee,
      media,
      aiActivity,
    },
    { seed: 42, version: "2" },
  ).refine((f) => ({
    event: {
      count: 1,
      columns: {
        id: f.default({ defaultValue: demoEventId }),
        name: f.default({ defaultValue: "OnCue Demo Hackathon" }),
        location: f.default({ defaultValue: "Austin Convention Center" }),
        dates: f.default({ defaultValue: ["2026-10-24", "2026-10-25"] }),
      },
    },
    member: {
      count: 4,
      columns: {
        name: f.fullName(),
        profilePic: f.default({ defaultValue: null }),
      },
      // One row per member prevents duplicate composite keys in these join tables.
      with: { teamMember: 1, taskAssignee: 1 },
    },
    eventOwner: { count: 1 },
    team: {
      count: 2,
      columns: {
        teamName: f.valuesFromArray({
          values: ["Operations", "Tech"],
          isUnique: true,
        }),
      },
    },
    teamMember: {
      columns: {
        role: f.valuesFromArray({ values: roleEnum.enumValues }),
      },
    },
    schedule: {
      count: 3,
      columns: {
        activity: f.valuesFromArray({
          values: ["Check-in opens", "Opening ceremony", "Project demos"],
          isUnique: true,
        }),
        room: f.valuesFromArray({
          values: ["Main lobby", "Main stage", "Exhibit hall"],
        }),
        startTime: f.date({
          minDate: "2026-10-24T08:00:00-05:00",
          maxDate: "2026-10-25T14:00:00-05:00",
        }),
      },
    },
    task: {
      count: 4,
      columns: {
        slots: f.int({ minValue: 1, maxValue: 4 }),
        assignment: f.valuesFromArray({
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
          values: ["pending", "in_progress", "completed"],
        }),
      },
    },
    media: {
      count: 2,
      columns: {
        photo: f.default({ defaultValue: null }),
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

  return true;
}
