DROP INDEX "team_member_user_id_idx";--> statement-breakpoint
ALTER TABLE "task" ALTER COLUMN "slots" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "task" ALTER COLUMN "status" SET DEFAULT 'open';--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "photo_data" "bytea";--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "content_type" text;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "team_member_user_id_idx" ON "team_member" USING btree ("user_id");--> statement-breakpoint
-- Preserve legacy tasks and existing assignments when adopting the API contract.
UPDATE "task" SET "status" = 'open' WHERE "status" = 'pending';
--> statement-breakpoint
UPDATE "task" SET "slots" = GREATEST(1, "slots", (
  SELECT count(*)::integer FROM "task_assignee" WHERE "task_id" = "task"."id"
));
--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_slots_positive" CHECK ("task"."slots" > 0);--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_priority_valid" CHECK ("task"."priority" IN ('low', 'medium', 'high', 'urgent'));--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_status_valid" CHECK ("task"."status" IN ('open', 'in_progress', 'completed'));