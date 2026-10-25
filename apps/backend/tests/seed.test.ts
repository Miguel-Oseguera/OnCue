import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { eq, sql } from "drizzle-orm";
import { reset } from "drizzle-seed";
import { db, pool } from "../src/db.js";
import { demoTeamId, seedDemo, seedTables } from "../src/seed-data.js";
import { roleEnum, team, user } from "../src/schema.js";

after(async () => pool.end());

test("demo seeding preserves auth data, supports repeat runs, and creates valid assignments", async () => {
  const rollback = new Error("Roll back seed verification");

  await assert.rejects(
    db.transaction(
      async (tx) => {
        await tx.insert(user).values({
          id: `seed-test-${randomUUID()}`,
          name: "Seed test user",
          email: `seed-test-${randomUUID()}@example.test`,
        });
        const authCounts = sql`
        SELECT (SELECT count(*)::integer FROM "user") AS users,
          (SELECT count(*)::integer FROM account) AS accounts,
          (SELECT count(*)::integer FROM session) AS sessions,
          (SELECT count(*)::integer FROM verification) AS verifications
      `;
        const before = await tx.execute(authCounts);
        await reset(tx, seedTables);
        assert.equal(await seedDemo(tx), true);
        await tx
          .update(team)
          .set({ teamName: "Edited demo team" })
          .where(eq(team.id, demoTeamId));
        assert.equal(await seedDemo(tx), false);

        const demo = await tx.query.team.findFirst({
          where: eq(team.id, demoTeamId),
          with: { members: true },
        });
        assert.ok(demo);
        assert.equal(demo.teamName, "Edited demo team");
        const expectedMembers = Math.min(Number(before.rows[0]?.users), 4);
        assert.equal(demo.members.length, expectedMembers);
        const memberIds = new Set(demo.members.map((member) => member.userId));
        const roles = new Set<string>(roleEnum.enumValues);
        for (const member of demo.members) {
          assert.ok(member.role !== null && roles.has(member.role));
        }

        const tasks = await tx.query.task.findMany({
          with: { assignees: true, media: true, aiActivity: true },
        });
        assert.equal(tasks.length, 4);
        assert.equal(
          tasks.flatMap((task) => task.assignees).length,
          expectedMembers,
        );
        assert.equal(tasks.flatMap((task) => task.media).length, 2);
        assert.equal(tasks.flatMap((task) => task.aiActivity).length, 2);
        for (const task of tasks) {
          assert.equal(task.teamId, demoTeamId);
          assert.ok(Number.isInteger(task.slots) && task.slots > 0);
          assert.ok(task.assignees.length <= task.slots);
          for (const assignee of task.assignees)
            assert.ok(memberIds.has(assignee.memberId));
        }
        const schedule = await tx.query.schedule.findMany();
        assert.equal(schedule.length, 3);
        for (const entry of schedule)
          assert.ok(entry.endTime > entry.startTime);
        assert.deepEqual((await tx.execute(authCounts)).rows, before.rows);

        throw rollback;
      },
      { isolationLevel: "repeatable read" },
    ),
    (error: unknown) => {
      if (error !== rollback) throw error;
      return true;
    },
  );
});
