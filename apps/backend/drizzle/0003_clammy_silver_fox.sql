-- Drop incoming foreign keys before removing their referenced tables.
ALTER TABLE "ai_activity" DROP CONSTRAINT IF EXISTS "ai_activity_event_id_event_id_fk";
--> statement-breakpoint
ALTER TABLE "media" DROP CONSTRAINT IF EXISTS "media_event_id_event_id_fk";
--> statement-breakpoint
ALTER TABLE "schedule" DROP CONSTRAINT IF EXISTS "schedule_event_id_event_id_fk";
--> statement-breakpoint
ALTER TABLE "task" DROP CONSTRAINT IF EXISTS "task_event_id_event_id_fk";
--> statement-breakpoint
ALTER TABLE "task_assignee" DROP CONSTRAINT IF EXISTS "task_assignee_member_id_member_id_fk";
--> statement-breakpoint
ALTER TABLE "team" DROP CONSTRAINT IF EXISTS "team_event_id_event_id_fk";
--> statement-breakpoint
ALTER TABLE "team_member" DROP CONSTRAINT IF EXISTS "team_member_member_id_member_id_fk";
--> statement-breakpoint
-- Legacy demo members have no auth-user mapping. Discard their joins explicitly.
DELETE FROM "task_assignee";
--> statement-breakpoint
DELETE FROM "team_member";
--> statement-breakpoint
ALTER TABLE "team_member" ADD COLUMN "user_id" text;
--> statement-breakpoint
ALTER TABLE "schedule" ADD COLUMN "end_time" timestamp with time zone;
--> statement-breakpoint
-- Historical entries have no known duration. Use a zero-duration placeholder.
UPDATE "schedule" SET "end_time" = "start_time";
--> statement-breakpoint
ALTER TABLE "schedule" ALTER COLUMN "end_time" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "team_member" DROP CONSTRAINT IF EXISTS "team_member_team_id_member_id_pk";
--> statement-breakpoint
ALTER TABLE "team_member" DROP COLUMN "member_id";
--> statement-breakpoint
ALTER TABLE "team_member" ALTER COLUMN "user_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_team_id_user_id_pk" PRIMARY KEY("team_id","user_id");
--> statement-breakpoint
-- Migration 0002 renamed the boolean column but did not convert it to the enum.
-- The legacy memberships are now empty, so there are no role values to map.
ALTER TABLE "team_member" ALTER COLUMN "role" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "team_member" ALTER COLUMN "role" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "team_member" ALTER COLUMN "role" TYPE "public"."role" USING "role"::text::"public"."role";
--> statement-breakpoint
ALTER TABLE "task_assignee" ALTER COLUMN "member_id" TYPE text USING "member_id"::text;
--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "team_id" uuid;
--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "task_assignee" ADD CONSTRAINT "task_assignee_member_id_user_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "team_name_idx" ON "team" USING btree ("team_name");
--> statement-breakpoint
CREATE INDEX "team_member_user_id_idx" ON "team_member" USING btree ("user_id");
--> statement-breakpoint
ALTER TABLE "ai_activity" DROP COLUMN "event_id";
--> statement-breakpoint
ALTER TABLE "media" DROP COLUMN "event_id";
--> statement-breakpoint
ALTER TABLE "schedule" DROP COLUMN "event_id";
--> statement-breakpoint
ALTER TABLE "task" DROP COLUMN "event_id";
--> statement-breakpoint
ALTER TABLE "team" DROP COLUMN "event_id";
--> statement-breakpoint
-- Drop dependent tables first. All foreign keys from retained tables are gone.
DROP TABLE "event_owner";
--> statement-breakpoint
DROP TABLE "member";
--> statement-breakpoint
DROP TABLE "event";
