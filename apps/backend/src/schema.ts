export * from "./auth-schema.js";

import { relations } from "drizzle-orm";
import {
  index,
  pgTable,
  primaryKey,
  integer,
  text,
  timestamp,
  pgEnum,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema.js";

export const team = pgTable(
  "team",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamName: text("team_name").notNull(),
  },
  (table) => [index("team_name_idx").on(table.teamName)],
);

// Each member's role belongs to their team membership.
export const roleEnum = pgEnum("role", ["lead", "member", "volunteer"]);
export const teamMember = pgTable(
  "team_member",
  {
    teamId: uuid("team_id")
      .notNull()
      .references(() => team.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: roleEnum("role"),
  },
  (table) => [
    primaryKey({ columns: [table.teamId, table.userId] }),
    index("team_member_user_id_idx").on(table.userId),
  ],
);

export const schedule = pgTable("schedule", {
  id: uuid("id").defaultRandom().primaryKey(),
  activity: text("activity").notNull(),
  room: text("room").notNull(),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
});

export const task = pgTable("task", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id").references(() => team.id, { onDelete: "set null" }),
  slots: integer("slots").notNull().default(0),
  assignment: text("assignment").notNull(),
  priority: text("priority").notNull(),
  status: text("status").notNull(),
});

export const taskAssignee = pgTable(
  "task_assignee",
  {
    taskId: uuid("task_id")
      .notNull()
      .references(() => task.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.memberId] }),
    index("task_assignee_member_id_idx").on(table.memberId),
  ],
);

// Photo and video/audio values identify stored files, such as URLs or object keys.
export const media = pgTable(
  "media",
  {
    mediaId: uuid("media_id").defaultRandom().primaryKey(),
    taskId: uuid("task_id").references(() => task.id, {
      onDelete: "set null",
    }),
    photo: text("photo"),
    videoAudio: text("video_audio"),
    transcript: text("transcript"),
  },
  (table) => [index("media_task_id_idx").on(table.taskId)],
);

export const aiActivity = pgTable(
  "ai_activity",
  {
    reportId: uuid("report_id").defaultRandom().primaryKey(),
    taskId: uuid("task_id").references(() => task.id, {
      onDelete: "set null",
    }),
    report: text("report").notNull(),
    decision: text("decision"),
    action: text("action"),
  },
  (table) => [index("ai_activity_task_id_idx").on(table.taskId)],
);

export const teamRelations = relations(team, ({ many }) => ({
  members: many(teamMember),
}));

export const teamMemberRelations = relations(teamMember, ({ one }) => ({
  team: one(team, { fields: [teamMember.teamId], references: [team.id] }),
  user: one(user, {
    fields: [teamMember.userId],
    references: [user.id],
  }),
}));

export const taskRelations = relations(task, ({ one, many }) => ({
  assignees: many(taskAssignee),
  media: many(media),
  aiActivity: many(aiActivity),
}));

export const taskAssigneeRelations = relations(taskAssignee, ({ one }) => ({
  task: one(task, { fields: [taskAssignee.taskId], references: [task.id] }),
  user: one(user, {
    fields: [taskAssignee.memberId],
    references: [user.id],
  }),
}));

export const mediaRelations = relations(media, ({ one }) => ({
  task: one(task, { fields: [media.taskId], references: [task.id] }),
}));

export const aiActivityRelations = relations(aiActivity, ({ one }) => ({
  task: one(task, { fields: [aiActivity.taskId], references: [task.id] }),
}));
