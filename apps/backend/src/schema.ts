export * from "./auth-schema.js";

import { relations } from "drizzle-orm";
import {
  date,
  index,
  pgTable,
  primaryKey,
  integer,
  text,
  timestamp,
  pgEnum,
  uuid,
} from "drizzle-orm/pg-core";

export const event = pgTable("event", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  location: text("location").notNull(),
  dates: date("dates").array().notNull(),
});

export const member = pgTable(
  "member",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    profilePic: text("profile_pic"),
  },
  (table) => [index("member_event_id_idx").on(table.eventId)],
);

export const eventOwner = pgTable(
  "event_owner",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.eventId, table.memberId] }),
    index("event_owner_member_id_idx").on(table.memberId),
  ],
);

export const team = pgTable(
  "team",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    teamName: text("team_name").notNull(),
  },
  (table) => [index("team_event_id_idx").on(table.eventId)],
);

// Each member's role belongs to their team membership.
export const roleEnum = pgEnum("role", ["lead", "member", "volunteer"]);
export const teamMember = pgTable(
  "team_member",
  {
    teamId: uuid("team_id")
      .notNull()
      .references(() => team.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    role: roleEnum("role"),
  },
  (table) => [
    primaryKey({ columns: [table.teamId, table.memberId] }),
    index("team_member_member_id_idx").on(table.memberId),
  ],
);

export const schedule = pgTable(
  "schedule",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    activity: text("activity").notNull(),
    room: text("room").notNull(),
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  },
  (table) => [index("schedule_event_id_idx").on(table.eventId)],
);

export const task = pgTable(
  "task",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    slots: integer("slots").notNull().default(0),
    assignment: text("assignment").notNull(),
    priority: text("priority").notNull(),
    status: text("status").notNull(),
  },
  (table) => [index("task_event_id_idx").on(table.eventId)],
);

export const taskAssignee = pgTable(
  "task_assignee",
  {
    taskId: uuid("task_id")
      .notNull()
      .references(() => task.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
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
    eventId: uuid("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    taskId: uuid("task_id").references(() => task.id, {
      onDelete: "set null",
    }),
    photo: text("photo"),
    videoAudio: text("video_audio"),
    transcript: text("transcript"),
  },
  (table) => [
    index("media_event_id_idx").on(table.eventId),
    index("media_task_id_idx").on(table.taskId),
  ],
);

export const aiActivity = pgTable(
  "ai_activity",
  {
    reportId: uuid("report_id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    taskId: uuid("task_id").references(() => task.id, {
      onDelete: "set null",
    }),
    report: text("report").notNull(),
    decision: text("decision"),
    action: text("action"),
  },
  (table) => [
    index("ai_activity_event_id_idx").on(table.eventId),
    index("ai_activity_task_id_idx").on(table.taskId),
  ],
);

export const eventRelations = relations(event, ({ many }) => ({
  members: many(member),
  owners: many(eventOwner),
  teams: many(team),
  schedule: many(schedule),
  tasks: many(task),
  media: many(media),
  aiActivity: many(aiActivity),
}));

export const memberRelations = relations(member, ({ one, many }) => ({
  event: one(event, { fields: [member.eventId], references: [event.id] }),
  ownedEvents: many(eventOwner),
  teams: many(teamMember),
  assignments: many(taskAssignee),
}));

export const eventOwnerRelations = relations(eventOwner, ({ one }) => ({
  event: one(event, {
    fields: [eventOwner.eventId],
    references: [event.id],
  }),
  member: one(member, {
    fields: [eventOwner.memberId],
    references: [member.id],
  }),
}));

export const teamRelations = relations(team, ({ one, many }) => ({
  event: one(event, { fields: [team.eventId], references: [event.id] }),
  members: many(teamMember),
}));

export const teamMemberRelations = relations(teamMember, ({ one }) => ({
  team: one(team, { fields: [teamMember.teamId], references: [team.id] }),
  member: one(member, {
    fields: [teamMember.memberId],
    references: [member.id],
  }),
}));

export const scheduleRelations = relations(schedule, ({ one }) => ({
  event: one(event, {
    fields: [schedule.eventId],
    references: [event.id],
  }),
}));

export const taskRelations = relations(task, ({ one, many }) => ({
  event: one(event, { fields: [task.eventId], references: [event.id] }),
  assignees: many(taskAssignee),
  media: many(media),
  aiActivity: many(aiActivity),
}));

export const taskAssigneeRelations = relations(taskAssignee, ({ one }) => ({
  task: one(task, { fields: [taskAssignee.taskId], references: [task.id] }),
  member: one(member, {
    fields: [taskAssignee.memberId],
    references: [member.id],
  }),
}));

export const mediaRelations = relations(media, ({ one }) => ({
  event: one(event, { fields: [media.eventId], references: [event.id] }),
  task: one(task, { fields: [media.taskId], references: [task.id] }),
}));

export const aiActivityRelations = relations(aiActivity, ({ one }) => ({
  event: one(event, {
    fields: [aiActivity.eventId],
    references: [event.id],
  }),
  task: one(task, { fields: [aiActivity.taskId], references: [task.id] }),
}));
