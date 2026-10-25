CREATE TABLE "ai_activity" (
	"report_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"task_id" uuid,
	"report" text NOT NULL,
	"decision" text,
	"action" text
);
--> statement-breakpoint
CREATE TABLE "event" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"location" text NOT NULL,
	"dates" date[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_owner" (
	"event_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	CONSTRAINT "event_owner_event_id_member_id_pk" PRIMARY KEY("event_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "media" (
	"media_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"task_id" uuid,
	"photo" text,
	"video_audio" text,
	"transcript" text
);
--> statement-breakpoint
CREATE TABLE "member" (
	"member_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"profile_pic" text,
	"is_lead" boolean DEFAULT false NOT NULL,
	"is_volunteer" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule" (
	"schedule_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"activity" text NOT NULL,
	"room" text NOT NULL,
	"start_time" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task" (
	"task_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"assignment" text NOT NULL,
	"priority" text NOT NULL,
	"status" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_assignee" (
	"task_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	CONSTRAINT "task_assignee_task_id_member_id_pk" PRIMARY KEY("task_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "team" (
	"team_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"team_name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_member" (
	"team_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"is_lead" boolean DEFAULT false NOT NULL,
	CONSTRAINT "team_member_team_id_member_id_pk" PRIMARY KEY("team_id","member_id")
);
--> statement-breakpoint
ALTER TABLE "ai_activity" ADD CONSTRAINT "ai_activity_event_id_event_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("event_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_activity" ADD CONSTRAINT "ai_activity_task_id_task_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("task_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_owner" ADD CONSTRAINT "event_owner_event_id_event_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("event_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_owner" ADD CONSTRAINT "event_owner_member_id_member_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("member_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_event_id_event_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("event_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_task_id_task_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("task_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_event_id_event_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("event_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule" ADD CONSTRAINT "schedule_event_id_event_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("event_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_event_id_event_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("event_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignee" ADD CONSTRAINT "task_assignee_task_id_task_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("task_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignee" ADD CONSTRAINT "task_assignee_member_id_member_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("member_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_event_id_event_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("event_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_team_id_team_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("team_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_member_id_member_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("member_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_activity_event_id_idx" ON "ai_activity" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "ai_activity_task_id_idx" ON "ai_activity" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "event_owner_member_id_idx" ON "event_owner" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "media_event_id_idx" ON "media" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "media_task_id_idx" ON "media" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "member_event_id_idx" ON "member" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "schedule_event_id_idx" ON "schedule" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "task_event_id_idx" ON "task" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "task_assignee_member_id_idx" ON "task_assignee" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "team_event_id_idx" ON "team" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "team_member_member_id_idx" ON "team_member" USING btree ("member_id");