import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { after, test } from "node:test";
import { sql } from "drizzle-orm";
import { db, pool } from "../src/db.js";

after(async () => pool.end());

test("0003 migrates populated legacy tables to auth-user assignments", async () => {
  const rollback = new Error("Roll back migration verification");
  const schemaName = `migration_verify_${randomUUID().replaceAll("-", "")}`;

  await assert.rejects(
    db.transaction(async (tx) => {
      await tx.execute(sql.raw(`CREATE SCHEMA "${schemaName}"`));
      await tx.execute(
        sql.raw(`SET LOCAL search_path TO "${schemaName}", public`),
      );

      async function applyMigration(filename: string) {
        const migration = await readFile(
          new URL(`../drizzle/${filename}`, import.meta.url),
          "utf8",
        );
        for (const statement of migration.split("--> statement-breakpoint")) {
          if (statement.trim()) {
            await tx.execute(
              sql.raw(statement.replaceAll('"public".', `"${schemaName}".`)),
            );
          }
        }
      }

      await applyMigration("0000_milky_tombstone.sql");
      await applyMigration("0001_striped_the_liberteens.sql");
      await applyMigration("0002_neat_owl.sql");

      await tx.execute(sql`
        INSERT INTO "user" (id, name, email)
        VALUES ('auth-user-alpha', 'Alpha', 'alpha@example.test')
      `);
      await tx.execute(sql`
        INSERT INTO event (id, name, location, dates)
        VALUES ('00000000-0000-4000-8000-000000000001', 'Legacy event', 'Austin', ARRAY['2026-10-24']::date[])
      `);
      await tx.execute(sql`
        INSERT INTO member (id, event_id, name)
        VALUES ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'Legacy member')
      `);
      await tx.execute(sql`
        INSERT INTO event_owner (event_id, member_id)
        VALUES ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002')
      `);
      await tx.execute(sql`
        INSERT INTO team (id, event_id, team_name)
        VALUES
          ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', 'Operations'),
          ('00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', 'Tech')
      `);
      await tx.execute(sql`
        INSERT INTO team_member (team_id, member_id, role)
        VALUES ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002', true)
      `);
      await tx.execute(sql`
        INSERT INTO task (id, event_id, assignment, priority, status, slots)
        VALUES ('00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000001', 'Check microphones', 'high', 'pending', 2)
      `);
      await tx.execute(sql`
        INSERT INTO task_assignee (task_id, member_id)
        VALUES ('00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000002')
      `);
      await tx.execute(sql`
        INSERT INTO schedule (event_id, activity, room, start_time)
        VALUES ('00000000-0000-4000-8000-000000000001', 'Opening', 'Main stage', '2026-10-24T14:00:00Z')
      `);
      await tx.execute(sql`
        INSERT INTO media (event_id, task_id, transcript)
        VALUES ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005', 'Audio check complete')
      `);
      await tx.execute(sql`
        INSERT INTO ai_activity (event_id, task_id, report)
        VALUES ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005', 'Ready for opening')
      `);

      // The development database has already had this obsolete constraint removed.
      await tx.execute(
        sql`ALTER TABLE ai_activity DROP CONSTRAINT ai_activity_event_id_event_id_fk`,
      );
      await applyMigration("0003_clammy_silver_fox.sql");

      const state = await tx.execute(sql`
        SELECT
          (SELECT count(*)::integer FROM team) AS teams,
          (SELECT count(*)::integer FROM task) AS tasks,
          (SELECT count(*)::integer FROM media) AS media,
          (SELECT count(*)::integer FROM ai_activity) AS reports,
          (SELECT count(*)::integer FROM "user") AS users,
          (SELECT count(*)::integer FROM team_member) AS memberships,
          (SELECT count(*)::integer FROM task_assignee) AS assignments,
          (SELECT count(*)::integer FROM schedule WHERE end_time = start_time) AS backfilled_schedules
      `);
      assert.deepEqual(state.rows[0], {
        teams: 2,
        tasks: 1,
        media: 1,
        reports: 1,
        users: 1,
        memberships: 0,
        assignments: 0,
        backfilled_schedules: 1,
      });

      const removed = await tx.execute(sql`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = ${schemaName}
          AND table_name IN ('event', 'event_owner', 'member')
      `);
      assert.equal(removed.rows.length, 0);

      // A text auth ID can join multiple teams and claim one task without a unique-user constraint on memberships.
      await tx.execute(sql`
        INSERT INTO team_member (team_id, user_id, role)
        VALUES
          ('00000000-0000-4000-8000-000000000003', 'auth-user-alpha', 'lead'),
          ('00000000-0000-4000-8000-000000000004', 'auth-user-alpha', 'volunteer')
      `);
      await tx.execute(sql`
        INSERT INTO task_assignee (task_id, member_id)
        VALUES ('00000000-0000-4000-8000-000000000005', 'auth-user-alpha')
      `);
      const memberships = await tx.execute(
        sql`SELECT count(*)::integer AS count FROM team_member`,
      );
      assert.equal(memberships.rows[0]?.count, 2);

      const columns = await tx.execute(sql`
        SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = ${schemaName} AND (
          (table_name = 'team_member' AND column_name IN ('user_id', 'role')) OR
          (table_name = 'task_assignee' AND column_name = 'member_id') OR
          (table_name = 'schedule' AND column_name = 'end_time')
        ) ORDER BY table_name, column_name
      `);
      assert.deepEqual(columns.rows, [
        {
          table_name: "schedule",
          column_name: "end_time",
          data_type: "timestamp with time zone",
          udt_name: "timestamptz",
          is_nullable: "NO",
          column_default: null,
        },
        {
          table_name: "task_assignee",
          column_name: "member_id",
          data_type: "text",
          udt_name: "text",
          is_nullable: "NO",
          column_default: null,
        },
        {
          table_name: "team_member",
          column_name: "role",
          data_type: "USER-DEFINED",
          udt_name: "role",
          is_nullable: "YES",
          column_default: null,
        },
        {
          table_name: "team_member",
          column_name: "user_id",
          data_type: "text",
          udt_name: "text",
          is_nullable: "NO",
          column_default: null,
        },
      ]);

      await tx.execute(sql`DELETE FROM "user" WHERE id = 'auth-user-alpha'`);
      const deletedUserJoins = await tx.execute(sql`
        SELECT (SELECT count(*)::integer FROM team_member) AS memberships,
               (SELECT count(*)::integer FROM task_assignee) AS assignments
      `);
      assert.deepEqual(deletedUserJoins.rows[0], {
        memberships: 0,
        assignments: 0,
      });

      throw rollback;
    }),
    (error: unknown) => {
      if (error !== rollback) throw error;
      return true;
    },
  );
});
