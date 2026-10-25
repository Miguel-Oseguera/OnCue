import assert from "node:assert/strict";
import test from "node:test";
import { createMockDashboardService } from "./service.ts";

const input = {
  title: "  Restock water  ",
  description: "  Two cases  ",
  location: " Lobby ",
  priority: "high",
  teamId: "team_logistics",
  assigneeIds: ["member_alex"],
  slots: 1,
};

test("create trims input, supports cross-team assignment, and updates dashboard stats", async () => {
  const service = createMockDashboardService();
  const before = await service.getDashboard();
  const task = await service.createTask(input);
  const after = await service.getDashboard();
  assert.equal(task.title, "Restock water");
  assert.equal(task.description, "Two cases");
  assert.equal(task.location, "Lobby");
  assert.equal(task.status, "open");
  assert.equal(after.tasks[0].id, task.id);
  assert.equal(after.stats.open, before.stats.open + 1);
  assert.equal(after.tasks.length, before.tasks.length + 1);
});

test("a failed combined update is atomic and does not complete the task", async () => {
  const service = createMockDashboardService();
  const task = await service.createTask(input);
  await assert.rejects(
    service.updateTask(task.id, {
      status: "completed",
      assigneeIds: ["member_alex", "member_maya"],
    }),
    /slots/,
  );
  const after = await service.getDashboard();
  assert.deepEqual(
    after.tasks.find((item) => item.id === task.id),
    task,
  );
});

test("completing and reopening urgent work keeps statistics accurate", async () => {
  const service = createMockDashboardService();
  const original = await service.getDashboard();
  const urgent = original.tasks.find((task) => task.priority === "urgent");
  await service.updateTask(urgent.id, { status: "completed", assigneeIds: [] });
  const completed = await service.getDashboard();
  assert.equal(completed.stats.urgent, original.stats.urgent - 1);
  assert.equal(completed.stats.completed, original.stats.completed + 1);
  assert.deepEqual(
    completed.tasks.find((task) => task.id === urgent.id).assigneeIds,
    [],
  );
  await service.updateTask(urgent.id, { status: "open" });
  assert.deepEqual((await service.getDashboard()).stats, original.stats);
});

test("rejects invalid capacity and unknown or duplicate members without adding work", async () => {
  const service = createMockDashboardService();
  const before = await service.getDashboard();
  for (const change of [
    { title: "  " },
    { slots: 0 },
    { slots: 1.5 },
    { slots: 101 },
    { teamId: "missing" },
    { assigneeIds: ["missing"] },
    { slots: 2, assigneeIds: ["member_alex", "member_alex"] },
  ]) {
    await assert.rejects(service.createTask({ ...input, ...change }));
  }
  assert.deepEqual(await service.getDashboard(), before);
});

test("returned data and separate sessions cannot mutate the mock store", async () => {
  const service = createMockDashboardService();
  const task = await service.createTask(input);
  task.assigneeIds.push("member_maya");
  const result = await service.getDashboard();
  result.tasks[0].title = "changed";
  result.teams[0].leadIds.length = 0;
  const fresh = await service.getDashboard();
  assert.deepEqual(fresh.tasks[0].assigneeIds, ["member_alex"]);
  assert.equal(fresh.tasks[0].title, "Restock water");
  assert.ok(fresh.teams[0].leadIds.length);
  assert.ok(
    !(await createMockDashboardService().getDashboard()).tasks.some(
      (item) => item.id === task.id,
    ),
  );
});
