CREATE TYPE "public"."role" AS ENUM('lead', 'member', 'volunteer');--> statement-breakpoint
ALTER TABLE "event" RENAME COLUMN "event_id" TO "id";--> statement-breakpoint
ALTER TABLE "member" RENAME COLUMN "member_id" TO "id";--> statement-breakpoint
ALTER TABLE "schedule" RENAME COLUMN "schedule_id" TO "id";--> statement-breakpoint
ALTER TABLE "task" RENAME COLUMN "task_id" TO "id";--> statement-breakpoint
ALTER TABLE "team" RENAME COLUMN "team_id" TO "id";--> statement-breakpoint
ALTER TABLE "team_member" RENAME COLUMN "is_lead" TO "role";--> statement-breakpoint
ALTER TABLE "ai_activity" DROP CONSTRAINT "ai_activity_event_id_event_event_id_fk";
--> statement-breakpoint
ALTER TABLE "ai_activity" DROP CONSTRAINT "ai_activity_task_id_task_task_id_fk";
--> statement-breakpoint
ALTER TABLE "event_owner" DROP CONSTRAINT "event_owner_event_id_event_event_id_fk";
--> statement-breakpoint
ALTER TABLE "event_owner" DROP CONSTRAINT "event_owner_member_id_member_member_id_fk";
--> statement-breakpoint
ALTER TABLE "media" DROP CONSTRAINT "media_event_id_event_event_id_fk";
--> statement-breakpoint
ALTER TABLE "media" DROP CONSTRAINT "media_task_id_task_task_id_fk";
--> statement-breakpoint
ALTER TABLE "member" DROP CONSTRAINT "member_event_id_event_event_id_fk";
--> statement-breakpoint
ALTER TABLE "schedule" DROP CONSTRAINT "schedule_event_id_event_event_id_fk";
--> statement-breakpoint
ALTER TABLE "task" DROP CONSTRAINT "task_event_id_event_event_id_fk";
--> statement-breakpoint
ALTER TABLE "task_assignee" DROP CONSTRAINT "task_assignee_task_id_task_task_id_fk";
--> statement-breakpoint
ALTER TABLE "task_assignee" DROP CONSTRAINT "task_assignee_member_id_member_member_id_fk";
--> statement-breakpoint
ALTER TABLE "team" DROP CONSTRAINT "team_event_id_event_event_id_fk";
--> statement-breakpoint
ALTER TABLE "team_member" DROP CONSTRAINT "team_member_team_id_team_team_id_fk";
--> statement-breakpoint
ALTER TABLE "team_member" DROP CONSTRAINT "team_member_member_id_member_member_id_fk";
--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "slots" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_activity" ADD CONSTRAINT "ai_activity_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_activity" ADD CONSTRAINT "ai_activity_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_owner" ADD CONSTRAINT "event_owner_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_owner" ADD CONSTRAINT "event_owner_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule" ADD CONSTRAINT "schedule_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignee" ADD CONSTRAINT "task_assignee_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignee" ADD CONSTRAINT "task_assignee_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" DROP COLUMN "is_lead";--> statement-breakpoint
ALTER TABLE "member" DROP COLUMN "is_volunteer";