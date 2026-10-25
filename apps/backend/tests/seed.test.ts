import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/db.js";
import { demoEventId, seedDemo } from "../src/seed-data.js";
import { event, roleEnum } from "../src/schema.js";

after(async () => pool.end());

test("demo seeding is repeatable, preserves edits, and links records to the same event", async () => {
  const rollback = new Error("Roll back seed verification");

  await assert.rejects(
    db.transaction(async (tx) => {
      // Changes, including any existing demo data, are rolled back after verification.
      await tx.delete(event).where(eq(event.id, demoEventId));
      const unrelatedEventId = randomUUID();
      await tx.insert(event).values({
        id: unrelatedEventId,
        name: "Unrelated event",
        location: "Elsewhere",
        dates: ["2026-11-01"],
      });

      assert.equal(await seedDemo(tx), true);
      await tx
        .update(event)
        .set({ name: "Edited demo event" })
        .where(eq(event.id, demoEventId));
      assert.equal(await seedDemo(tx), false);

      const demo = await tx.query.event.findFirst({
        where: eq(event.id, demoEventId),
        with: {
          owners: true,
          members: true,
          teams: { with: { members: true } },
          schedule: true,
          tasks: { with: { assignees: true } },
          media: true,
          aiActivity: true,
        },
      });
      assert.ok(demo);
      assert.equal(demo.name, "Edited demo event");
      assert.equal(demo.members.length, 4);
      assert.equal(demo.owners.length, 1);
      assert.equal(demo.teams.length, 2);
      assert.equal(demo.schedule.length, 3);
      assert.equal(demo.tasks.length, 4);
      assert.equal(demo.media.length, 2);
      assert.equal(demo.aiActivity.length, 2);

      const memberIds = new Set(demo.members.map((member) => member.id));
      const taskIds = new Set(demo.tasks.map((task) => task.id));
      const roles = new Set<string>(roleEnum.enumValues);
      for (const owner of demo.owners) assert.ok(memberIds.has(owner.memberId));
      for (const team of demo.teams) {
        for (const member of team.members) {
          assert.ok(memberIds.has(member.memberId));
          assert.ok(member.role !== null && roles.has(member.role));
        }
      }
      for (const task of demo.tasks) {
        assert.ok(Number.isInteger(task.slots) && task.slots > 0);
        for (const assignee of task.assignees)
          assert.ok(memberIds.has(assignee.memberId));
      }
      assert.equal(demo.teams.flatMap((team) => team.members).length, 4);
      assert.equal(demo.tasks.flatMap((task) => task.assignees).length, 4);
      for (const record of [...demo.media, ...demo.aiActivity]) {
        if (record.taskId !== null) assert.ok(taskIds.has(record.taskId));
      }

      assert.ok(
        await tx.query.event.findFirst({
          where: eq(event.id, unrelatedEventId),
        }),
      );

      throw rollback;
    }),
    (error: unknown) => {
      if (error !== rollback) throw error;
      return true;
    },
  );
});
