import { mergeSavedTask } from "./service.ts";
import assert from "node:assert/strict";
import test from "node:test";
import {
  createApiService,
  normalizeDashboard,
  normalizeTask,
} from "./api-service.ts";
import { parseDecision } from "./report-service.ts";

const report = {
  reportId: "report-1",
  taskId: "task-1",
  report: "Projector stopped working.",
  decision: JSON.stringify({
    issueSummary: "Projector failure",
    recommendedActions: ["Check cables"],
    requiresHumanAttention: true,
  }),
  action: null,
};
const task = {
  id: "task-1",
  title: "Check projector",
  description: "",
  priority: "urgent",
  status: "open",
  teamId: null,
  slots: 1,
  assigneeIds: [],
  createdAt: "2026-10-25T12:04:53.779Z",
  location: null,
  aiActivity: [report],
};
const payload = {
  tasks: [task],
  teams: [],
  members: [],
  stats: { open: 1, inProgress: 0, completed: 0, urgent: 1 },
};

test("maps nested aiActivity and preserves missing evidence without mock substitutions", () => {
  const data = normalizeDashboard(payload);
  assert.equal(data.tasks[0].aiReports[0].reportId, "report-1");
  assert.deepEqual(data.tasks[0].aiReports[0].relatedEvidence, []);
  assert.equal(data.unlinkedReportsAvailable, false);
  assert.deepEqual(data.unlinkedAiReports, []);
});
test("maps multiple reports and optional evidence; explicit empty unlinked list means supported", () => {
  const data = normalizeDashboard({
    ...payload,
    tasks: [
      {
        ...task,
        aiActivity: [
          report,
          { ...report, reportId: "report-2", decision: null },
        ],
        relatedEvidence: [{ mediaId: "media-1", transcript: "No picture" }],
      },
    ],
    unlinkedAiReports: [],
  });
  assert.equal(data.tasks[0].aiReports.length, 2);
  assert.equal(data.tasks[0].aiReports[1].decision, null);
  assert.equal(
    data.tasks[0].aiReports[0].relatedEvidence[0].transcript,
    "No picture",
  );
  assert.equal(data.unlinkedReportsAvailable, true);
});
test("rejects malformed data and reports attached to the wrong task", () => {
  assert.throws(() => normalizeDashboard([task]), /unsupported/);
  assert.throws(
    () => normalizeTask({ ...task, status: "made-up" }),
    /unsupported/,
  );
  assert.throws(
    () =>
      normalizeTask({
        ...task,
        aiActivity: [{ ...report, taskId: "different-task" }],
      }),
    /unsupported/,
  );
});
test("mutation responses missing aiActivity leave reports unspecified so shared state can preserve them", () => {
  const { aiActivity, ...mutationResponse } = task;
  assert.equal(normalizeTask(mutationResponse).aiReports, undefined);
});
test("uses the existing dashboard, create, and patch endpoints with exact mutation bodies", async () => {
  const calls = [];
  const api = createApiService(async (path, init) => {
    calls.push([path, init]);
    return path === "/api/dashboard" ? payload : task;
  });
  await api.getDashboard();
  const input = {
    title: "New task",
    description: "",
    priority: "medium",
    teamId: null,
    assigneeIds: [],
    slots: 1,
    location: null,
  };
  await api.createTask(input);
  await api.updateTask("task-1", { status: "completed" });
  assert.equal(calls[0][0], "/api/dashboard");
  assert.equal(calls[1][0], "/api/tasks");
  assert.equal(calls[1][1].method, "POST");
  assert.deepEqual(JSON.parse(calls[1][1].body), input);
  assert.equal(calls[2][0], "/api/tasks/task-1");
  assert.equal(calls[2][1].method, "PATCH");
  assert.deepEqual(JSON.parse(calls[2][1].body), { status: "completed" });
});
test("surfaces request failures rather than falling back to demo data", async () => {
  const api = createApiService(async () => {
    throw new Error("Session expired");
  });
  await assert.rejects(api.getDashboard(), /Session expired/);
});
test("formats recognized JSON decisions and preserves plain or unknown text as fallback", () => {
  assert.deepEqual(parseDecision(report.decision).recommendedActions, [
    "Check cables",
  ]);
  assert.equal(parseDecision("Send AV support."), null);
  assert.equal(parseDecision("{broken"), null);
  assert.equal(parseDecision('{"other":"field"}'), null);
  assert.equal(parseDecision(null), null);
});

test("successful PATCH updates counts without losing reports or duplicating the task", () => {
  const original = normalizeDashboard(payload);
  const { aiActivity, ...response } = task;
  const result = mergeSavedTask(
    original,
    normalizeTask({ ...response, status: "completed" }),
  );
  assert.equal(result.tasks.length, 1);
  assert.equal(result.tasks[0].aiReports[0].reportId, report.reportId);
  assert.equal(result.stats.open, 0);
  assert.equal(result.stats.completed, 1);
  assert.equal(result.stats.urgent, 0);
  assert.equal(original.tasks[0].status, "open");
});
