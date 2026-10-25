import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { serve } from "@hono/node-server";
import { after, test } from "node:test";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { app } from "../src/app.js";
import { db, pool } from "../src/db.js";
import {
  aiActivity,
  media,
  task,
  team,
  teamMember,
  user,
} from "../src/schema.js";
import { maxPhotoBytes } from "../src/photos.js";
import { createTaskFromReport, findRelatedTasks } from "../src/tasks.js";
import { createTaskSchema } from "../src/api/validation.js";

after(async () => pool.end());

const taskJson = z.object({
  id: z.guid(),
  title: z.string(),
  description: z.string(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  status: z.enum(["open", "in_progress", "completed"]),
  teamId: z.guid().nullable(),
  assigneeIds: z.array(z.string()),
  slots: z.number(),
  location: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
const dashboardJson = z.object({
  tasks: z.array(taskJson),
  teams: z.array(
    z.object({ id: z.guid(), name: z.string(), leadIds: z.array(z.string()) }),
  ),
  members: z.array(
    z.object({ id: z.string(), name: z.string(), teamId: z.guid().nullable() }),
  ),
  stats: z.object({
    open: z.number(),
    inProgress: z.number(),
    completed: z.number(),
    urgent: z.number(),
  }),
});

async function json<T>(
  response: Response,
  status: number,
  schema: z.ZodType<T>,
) {
  assert.equal(response.status, status, await response.clone().text());
  return schema.parse(await response.json());
}

// These requests run against the real handler and database, with disposable records only.
test("dashboard, tasks, photos, and AI reports support the app contract", async (t) => {
  const server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 0 });
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseURL = `http://127.0.0.1:${address.port}`;
  t.after(
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );
  const httpRequest = (path: string, init?: RequestInit) =>
    fetch(new URL(path, baseURL), init);
  const taskIds: string[] = [];
  const mediaIds: string[] = [];
  const userIds: string[] = [];
  const teamId = randomUUID();
  const otherTeamId = randomUUID();
  t.after(async () => {
    if (mediaIds.length)
      await db.delete(media).where(inArray(media.mediaId, mediaIds));
    if (taskIds.length) {
      await db.delete(media).where(inArray(media.taskId, taskIds));
      await db.delete(aiActivity).where(inArray(aiActivity.taskId, taskIds));
      await db.delete(task).where(inArray(task.id, taskIds));
    }
    await db.delete(team).where(inArray(team.id, [teamId, otherTeamId]));
    if (userIds.length) await db.delete(user).where(inArray(user.id, userIds));
  });

  async function signup() {
    const email = `api-test-${randomUUID()}@example.test`;
    const response = await httpRequest("/api/auth/sign-up/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "expo-origin": "mobile://",
      },
      body: JSON.stringify({
        name: "API test member",
        email,
        password: `test-${randomUUID()}`,
      }),
    });
    assert.equal(response.status, 200, await response.clone().text());
    const body = z
      .object({ user: z.object({ id: z.string() }) })
      .parse(await response.json());
    userIds.push(body.user.id);
    const cookie = response.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    return { id: body.user.id, cookie };
  }
  const first = await signup();
  const second = await signup();
  await db.insert(team).values([
    { id: teamId, teamName: "API test crew" },
    { id: otherTeamId, teamName: "Other API test crew" },
  ]);
  await db
    .insert(teamMember)
    .values({ teamId, userId: first.id, role: "lead" });

  const request = (
    path: string,
    method = "GET",
    body?: unknown,
    cookie = first.cookie,
  ) =>
    httpRequest(path, {
      method,
      headers: { cookie, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  async function create(overrides: Record<string, unknown> = {}) {
    const created = await json(
      await request("/api/tasks", "POST", {
        title: "API test task",
        priority: "urgent",
        teamId,
        slots: 2,
        ...overrides,
      }),
      201,
      taskJson,
    );
    taskIds.push(created.id);
    return created;
  }

  await t.test(
    "session access, JSON errors, PATCH preflight, and untrusted origins",
    async () => {
      for (const [path, method] of [
        ["/api/dashboard", "GET"],
        ["/api/tasks", "POST"],
        [`/api/tasks/${randomUUID()}`, "PATCH"],
        ["/api/media", "POST"],
        [`/api/media/${randomUUID()}`, "GET"],
        ["/api/ai", "POST"],
      ]) {
        assert.equal((await httpRequest(path, { method })).status, 401);
      }
      const preflight = await httpRequest("/api/tasks/example", {
        method: "OPTIONS",
        headers: {
          origin: "http://localhost:8081",
          "Access-Control-Request-Method": "PATCH",
          "Access-Control-Request-Headers": "content-type",
        },
      });
      assert.equal(preflight.status, 204);
      assert.ok(
        preflight.headers
          .get("Access-Control-Allow-Methods")
          ?.includes("PATCH"),
      );
      const untrusted = await httpRequest("/api/tasks", {
        method: "POST",
        headers: {
          cookie: first.cookie,
          origin: "https://untrusted.example",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: "Blocked", priority: "low" }),
      });
      assert.equal(untrusted.status, 403);
      const malformed = await httpRequest("/api/tasks", {
        method: "POST",
        headers: { cookie: first.cookie, "Content-Type": "application/json" },
        body: "{",
      });
      await json(malformed, 400, z.object({ error: z.string() }));
    },
  );

  await t.test(
    "create, assignment replacement, rollback, status, dashboard statistics, and one-team membership",
    async () => {
      const created = await create({
        description: "Water is low",
        location: "Main lobby",
        assigneeIds: [first.id, second.id],
      });
      assert.equal(created.title, "API test task");
      assert.equal(created.description, "Water is low");
      assert.equal(created.location, "Main lobby");
      assert.equal(created.status, "open");
      assert.deepEqual(created.assigneeIds, [first.id, second.id].sort());

      const replaced = await json(
        await request(`/api/tasks/${created.id}`, "PATCH", {
          assigneeIds: [second.id],
          status: "in_progress",
        }),
        200,
        taskJson,
      );
      assert.deepEqual(replaced.assigneeIds, [second.id]);
      assert.equal(replaced.status, "in_progress");
      const cleared = await json(
        await request(`/api/tasks/${created.id}`, "PATCH", { assigneeIds: [] }),
        200,
        taskJson,
      );
      assert.deepEqual(cleared.assigneeIds, []);
      assert.equal(cleared.status, "in_progress");
      const invalidAssignment = await request(
        `/api/tasks/${created.id}`,
        "PATCH",
        { status: "completed", assigneeIds: ["missing-user"] },
      );
      assert.equal(invalidAssignment.status, 400);
      const state = await json(
        await request("/api/dashboard"),
        200,
        dashboardJson,
      );
      assert.equal(
        state.tasks.find((task) => task.id === created.id)?.status,
        "in_progress",
      );
      assert.deepEqual(
        state.teams.find((team) => team.id === teamId),
        { id: teamId, name: "API test crew", leadIds: [first.id] },
      );
      assert.equal(
        state.members.find((member) => member.id === first.id)?.teamId,
        teamId,
      );
      assert.equal(
        state.members.find((member) => member.id === second.id)?.teamId,
        null,
      );
      assert.deepEqual(state.stats, {
        open: state.tasks.filter((task) => task.status === "open").length,
        inProgress: state.tasks.filter((task) => task.status === "in_progress")
          .length,
        completed: state.tasks.filter((task) => task.status === "completed")
          .length,
        urgent: state.tasks.filter(
          (task) => task.priority === "urgent" && task.status !== "completed",
        ).length,
      });
      await json(
        await request(`/api/tasks/${created.id}`, "PATCH", {
          status: "completed",
        }),
        200,
        taskJson,
      );
      const after = await json(
        await request("/api/dashboard"),
        200,
        dashboardJson,
      );
      assert.equal(after.stats.urgent, state.stats.urgent - 1);
      await assert.rejects(
        db
          .insert(teamMember)
          .values({ teamId: otherTeamId, userId: first.id, role: "member" }),
      );

      for (const input of [
        { title: "", priority: "high" },
        { title: "Bad", priority: "critical" },
        { title: "Bad", priority: "low", slots: 0 },
        {
          title: "Bad",
          priority: "low",
          slots: 1,
          assigneeIds: [first.id, second.id],
        },
        { title: "Bad", priority: "low", assigneeIds: [first.id, first.id] },
        { title: "Bad", priority: "low", teamId: randomUUID() },
        { title: "Bad", priority: "low", assigneeIds: ["missing-user"] },
      ])
        assert.equal((await request("/api/tasks", "POST", input)).status, 400);
      for (const input of [
        {},
        { status: "pending" },
        { title: "Unsupported" },
        { assigneeIds: null },
      ]) {
        assert.equal(
          (await request(`/api/tasks/${created.id}`, "PATCH", input)).status,
          400,
        );
      }
      await json(
        await request(`/api/tasks/${randomUUID()}`, "PATCH", {
          status: "completed",
        }),
        404,
        z.object({ error: z.string() }),
      );
      assert.equal(
        (
          await request("/api/tasks/not-a-uuid", "PATCH", {
            status: "completed",
          })
        ).status,
        400,
      );
    },
  );

  await t.test(
    "concurrent claims cannot overfill slots and claimedBy only returns matching tasks",
    async () => {
      const target = await create({ slots: 1 });
      const unrelated = await create();
      const responses = await Promise.all([
        request(
          `/api/tasks/claim/${target.id}`,
          "POST",
          undefined,
          first.cookie,
        ),
        request(
          `/api/tasks/claim/${target.id}`,
          "POST",
          undefined,
          second.cookie,
        ),
      ]);
      assert.deepEqual(
        responses.map((response) => response.status).sort(),
        [200, 409],
      );
      const winner = responses[0].status === 200 ? first : second;
      const repeated = await json(
        await request(
          `/api/tasks/claim/${target.id}`,
          "POST",
          undefined,
          winner.cookie,
        ),
        200,
        taskJson,
      );
      assert.deepEqual(repeated.assigneeIds, [winner.id]);
      assert.equal(
        (
          await request(`/api/tasks/${target.id}`, "PATCH", {
            assigneeIds: [first.id, second.id],
          })
        ).status,
        409,
      );
      const claimed = await json(
        await request(
          "/api/tasks?claimedBy=me",
          "GET",
          undefined,
          winner.cookie,
        ),
        200,
        z.array(taskJson),
      );
      assert.ok(claimed.some((task) => task.id === target.id));
      assert.ok(claimed.every((task) => task.assigneeIds.includes(winner.id)));
      assert.ok(!claimed.some((task) => task.id === unrelated.id));
      const filtered = await json(
        await request(`/api/tasks?teamId=${otherTeamId}`),
        200,
        z.array(taskJson),
      );
      assert.ok(filtered.every((task) => task.teamId === otherTeamId));
    },
  );

  await t.test("photos persist with authenticated retrieval", async () => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jitkAAAAASUVORK5CYII=",
      "base64",
    );
    const target = await create();
    async function upload(file: File, taskId?: string) {
      const form = new FormData();
      form.append("file", file);
      if (taskId) form.append("taskId", taskId);
      return httpRequest("/api/media", {
        method: "POST",
        headers: { cookie: first.cookie },
        body: form,
      });
    }
    const saved = await json(
      await upload(
        new File([png], "photo.png", { type: "image/png" }),
        target.id,
      ),
      201,
      z.object({
        id: z.guid(),
        url: z.string(),
        contentType: z.string(),
        size: z.number(),
        taskId: z.guid().nullable(),
      }),
    );
    mediaIds.push(saved.id);
    assert.equal(saved.taskId, target.id);
    assert.equal(saved.size, png.length);
    assert.equal(saved.contentType, "image/png");
    assert.equal((await httpRequest(saved.url)).status, 401);
    const download = await request(saved.url);
    assert.equal(download.status, 200);
    assert.equal(download.headers.get("Content-Type"), "image/png");
    assert.equal(download.headers.get("X-Content-Type-Options"), "nosniff");
    assert.deepEqual(Buffer.from(await download.arrayBuffer()), png);
    assert.equal(
      (await upload(new File(["<svg/>"], "bad.png", { type: "image/png" })))
        .status,
      415,
    );
    assert.equal(
      (await upload(new File([png], "bad.jpg", { type: "image/jpeg" }))).status,
      415,
    );
    assert.equal(
      (await upload(new File([], "empty.png", { type: "image/png" }))).status,
      400,
    );
    assert.equal(
      (
        await upload(
          new File([new Uint8Array(maxPhotoBytes + 1)], "large.png", {
            type: "image/png",
          }),
        )
      ).status,
      413,
    );
    assert.equal(
      (
        await upload(
          new File([new Uint8Array(maxPhotoBytes + 128 * 1024)], "huge.png", {
            type: "image/png",
          }),
        )
      ).status,
      413,
    );
    assert.equal(
      (
        await upload(
          new File([png], "photo.png", { type: "image/png" }),
          randomUUID(),
        )
      ).status,
      404,
    );
    assert.equal((await request(`/api/media/${randomUUID()}`)).status, 404);
  });

  await t.test(
    "related-task search matches text and location while excluding completed tasks",
    async () => {
      const marker = randomUUID();
      const open = await create({
        title: `Projector ${marker}`,
        location: "Room 204",
      });
      const active = await create({
        title: "AV issue",
        description: `Projector ${marker}`,
        location: "Room 204",
      });
      await request(`/api/tasks/${active.id}`, "PATCH", {
        status: "in_progress",
      });
      const closed = await create({
        title: `Projector ${marker}`,
        location: "Room 204",
      });
      await request(`/api/tasks/${closed.id}`, "PATCH", {
        status: "completed",
      });
      const elsewhere = await create({
        title: `Projector ${marker}`,
        location: "Room 205",
      });
      const matches = await findRelatedTasks({
        query: `projector ${marker}`,
        location: "room 204",
      });
      assert.deepEqual(
        matches.map((task) => task.id).sort(),
        [open.id, active.id].sort(),
      );
      assert.equal((await findRelatedTasks({ query: marker })).length, 3);
      const literal = await create({ title: `100%_ ${marker}` });
      await create({ title: `100abc ${marker}` });
      assert.deepEqual(
        (await findRelatedTasks({ query: `100%_ ${marker}` })).map(
          (task) => task.id,
        ),
        [literal.id],
      );
      assert.ok(!matches.some((task) => task.id === elsewhere.id));
    },
  );

  await t.test(
    "task creation requires a real report and rolls back invalid assignments",
    async (t) => {
      const reportId = randomUUID();
      const title = `Invalid AI task ${randomUUID()}`;
      const input = createTaskSchema.parse({
        title,
        priority: "high",
        assigneeIds: [randomUUID()],
      });
      await db.insert(aiActivity).values({ reportId, report: title });
      t.after(async () => {
        await db.delete(aiActivity).where(eq(aiActivity.reportId, reportId));
        await db.delete(task).where(eq(task.title, title));
      });
      const context = { source: "test", images: [] };
      await assert.rejects(
        createTaskFromReport({ ...context, input, reportId: randomUUID() }),
        /Report not found/,
      );
      await assert.rejects(
        createTaskFromReport({ ...context, input, reportId }),
        /An assignee does not exist/,
      );
      assert.deepEqual(
        await db
          .select({ id: task.id })
          .from(task)
          .where(eq(task.title, title)),
        [],
      );
      const [report] = await db
        .select()
        .from(aiActivity)
        .where(eq(aiActivity.reportId, reportId));
      assert.equal(report?.taskId, null);
      assert.equal(report?.action, null);
    },
  );

  await t.test(
    "AI searches, creates through tools, and attaches each report and its images once",
    async (t) => {
      const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jitkAAAAASUVORK5CYII=",
        "base64",
      );
      const analysis = {
        issueSummary: "Projector failure",
        category: "equipment",
        urgency: "critical",
        recommendedActions: ["Send AV support"],
        missingInformation: [],
        requiresHumanAttention: true,
      };
      const geminiRequests: unknown[] = [];
      const taskTitle = `AI projector ${randomUUID()}`;
      let searchQuery = randomUUID();
      let shouldCreateTask = true;
      const toolInput = {
        title: taskTitle,
        description: "Send AV support",
        priority: "urgent",
        location: "Room 204",
      };
      const earlyReport = `The projector is broken ${randomUUID()}`;
      const activityIds: string[] = [];
      t.after(async () => {
        if (activityIds.length) {
          await db
            .delete(aiActivity)
            .where(inArray(aiActivity.reportId, activityIds));
        }
      });
      const originalFetch = globalThis.fetch;
      // Keep the real SDK and local HTTP/database flow; replace only Gemini's HTTP response.
      const fetchMock = t.mock.method(
        globalThis,
        "fetch",
        async (input: string | URL | Request, init?: RequestInit) => {
          const outgoing = new Request(input, init);
          if (
            new URL(outgoing.url).hostname !==
            "generativelanguage.googleapis.com"
          ) {
            return originalFetch(input, init);
          }
          if (geminiRequests.length === 0) {
            const reports = await db
              .select()
              .from(aiActivity)
              .where(eq(aiActivity.report, earlyReport));
            activityIds.push(...reports.map((report) => report.reportId));
            assert.equal(reports.length, 1);
            assert.equal(reports[0]?.taskId, null);
            assert.equal(reports[0]?.decision, null);
            assert.equal(reports[0]?.action, null);
          }
          const payload: unknown = await outgoing.json();
          geminiRequests.push(payload);
          const parsed = z
            .object({
              contents: z.array(
                z.object({
                  parts: z.array(
                    z.object({
                      functionResponse: z
                        .object({
                          name: z.string(),
                          response: z.object({ content: z.unknown() }),
                        })
                        .optional(),
                    }),
                  ),
                }),
              ),
            })
            .parse(payload);
          const results = parsed.contents
            .flatMap((content) => content.parts)
            .flatMap((part) =>
              part.functionResponse ? [part.functionResponse] : [],
            );
          if (!results.some((result) => result.name === "findRelatedTasks")) {
            return Response.json({
              candidates: [
                {
                  content: {
                    role: "model",
                    parts: [
                      {
                        functionCall: {
                          name: "findRelatedTasks",
                          args: { query: searchQuery },
                        },
                        thoughtSignature: "dGVzdC1zaWduYXR1cmU=",
                      },
                    ],
                  },
                  finishReason: "STOP",
                },
              ],
            });
          }
          if (
            shouldCreateTask &&
            !results.some((result) => result.name === "createTask")
          ) {
            // Simultaneous duplicate calls must still create one task and one set of photos.
            return Response.json({
              candidates: [
                {
                  content: {
                    role: "model",
                    parts: [
                      {
                        functionCall: { name: "createTask", args: toolInput },
                        thoughtSignature: "dGVzdC1zaWduYXR1cmU=",
                      },
                      {
                        functionCall: { name: "createTask", args: toolInput },
                        thoughtSignature: "dGVzdC1zaWduYXR1cmU=",
                      },
                    ],
                  },
                  finishReason: "STOP",
                },
              ],
            });
          }
          if (shouldCreateTask) {
            const created = results
              .filter((result) => result.name === "createTask")
              .map((result) => taskJson.parse(result.response.content));
            taskIds.push(...created.map((task) => task.id));
            assert.equal(created.length, 2);
            assert.equal(created[0]?.id, created[1]?.id);
          } else {
            const matches = z
              .array(z.object({ title: z.string() }))
              .parse(
                results.find((result) => result.name === "findRelatedTasks")
                  ?.response.content,
              );
            assert.ok(matches.some((task) => task.title === taskTitle));
          }
          return Response.json({
            candidates: [
              {
                content: {
                  role: "model",
                  parts: [{ text: JSON.stringify(analysis) }],
                },
                finishReason: "STOP",
              },
            ],
          });
        },
      );
      const previousKey = process.env.GEMINI_API_KEY;
      process.env.GEMINI_API_KEY = "test-key";
      t.after(() => {
        fetchMock.mock.restore();
        if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
        else process.env.GEMINI_API_KEY = previousKey;
      });
      function submit(images: File[], text = "") {
        const form = new FormData();
        form.append("source", "glasses");
        if (text) form.append("text", text);
        for (const image of images) form.append("images", image);
        return httpRequest("/api/ai", {
          method: "POST",
          headers: { cookie: first.cookie },
          body: form,
        });
      }

      for (const imageCount of [1, 2, 0]) {
        const text =
          imageCount === 1 ? earlyReport : imageCount === 0 ? "Send AV" : "";
        const images = Array.from(
          { length: imageCount },
          () => new File([png], "photo.png", { type: "image/png" }),
        );
        const result = await json(
          await submit(images, text),
          200,
          z.object({
            processed: z.literal(true),
            analysis: z.unknown(),
            tasks: z.array(taskJson).length(1),
          }),
        );
        const [created] = result.tasks;
        assert.ok(created);
        taskIds.push(created.id);
        assert.equal(created.priority, "urgent");
        assert.equal(created.title, taskTitle);
        assert.equal(created.location, "Room 204");
        assert.deepEqual(result.analysis, analysis);
        const payload = z
          .object({
            contents: z.array(
              z.object({
                parts: z.array(
                  z.object({
                    text: z.string().optional(),
                    inlineData: z
                      .object({ data: z.string(), mimeType: z.string() })
                      .optional(),
                  }),
                ),
              }),
            ),
          })
          .parse(geminiRequests.at(-1));
        const parts = payload.contents.flatMap((content) => content.parts);
        assert.deepEqual(
          parts.flatMap((part) => (part.inlineData ? [part.inlineData] : [])),
          images.map(() => ({
            data: png.toString("base64"),
            mimeType: "image/png",
          })),
        );
        assert.ok(
          parts.some((part) =>
            part.text?.includes(text || "Analyze the attached images"),
          ),
        );
        const stored = await db
          .select()
          .from(media)
          .where(eq(media.taskId, created.id));
        assert.equal(stored.length, imageCount);
        for (const photo of stored) {
          assert.deepEqual(photo.photoData, png);
          assert.equal(photo.contentType, "image/png");
          assert.equal(photo.photo, `/api/media/${photo.mediaId}`);
        }
        const reports = await db
          .select()
          .from(aiActivity)
          .where(eq(aiActivity.taskId, created.id));
        assert.equal(reports.length, 1);
        assert.equal(reports[0]?.decision, JSON.stringify(analysis));
        if (imageCount === 1) {
          assert.equal(reports[0]?.reportId, activityIds[0]);
        }
      }

      shouldCreateTask = false;
      searchQuery = taskTitle;
      const duplicateReport = `Follow-up report ${randomUUID()}`;
      const before = await db
        .select({ id: task.id })
        .from(task)
        .where(eq(task.title, taskTitle));
      assert.equal(before.length, 3);
      const duplicateResult = await json(
        await submit([], duplicateReport),
        200,
        z.object({ processed: z.literal(true), tasks: z.array(taskJson) }),
      );
      assert.deepEqual(duplicateResult.tasks, []);
      assert.deepEqual(
        await db
          .select({ id: task.id })
          .from(task)
          .where(eq(task.title, taskTitle)),
        before,
      );
      const duplicateReports = await db
        .select()
        .from(aiActivity)
        .where(eq(aiActivity.report, duplicateReport));
      activityIds.push(...duplicateReports.map((report) => report.reportId));
      assert.equal(duplicateReports[0]?.taskId, null);
      assert.equal(duplicateReports[0]?.action, "No task created");

      const failedReport = `AI failure test ${randomUUID()}`;
      delete process.env.GEMINI_API_KEY;
      try {
        assert.equal((await submit([], failedReport)).status, 500);
        const reports = await db
          .select()
          .from(aiActivity)
          .where(eq(aiActivity.report, failedReport));
        activityIds.push(...reports.map((report) => report.reportId));
        assert.equal(reports.length, 1);
        assert.equal(reports[0]?.taskId, null);
        assert.equal(reports[0]?.decision, null);
        assert.equal(reports[0]?.action, null);
      } finally {
        process.env.GEMINI_API_KEY = "test-key";
      }

      const callsBeforeInvalid = geminiRequests.length;
      assert.equal((await submit([])).status, 400);
      assert.equal(
        (await submit([new File([], "empty.png", { type: "image/png" })]))
          .status,
        400,
      );
      assert.equal(
        (
          await submit([
            new File(["<svg/>"], "fake.png", { type: "image/png" }),
          ])
        ).status,
        415,
      );
      assert.equal(
        (await submit([new File([png], "wrong.jpg", { type: "image/jpeg" })]))
          .status,
        415,
      );
      assert.equal(
        (
          await submit(
            Array.from(
              { length: 11 },
              () => new File([png], "photo.png", { type: "image/png" }),
            ),
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await submit([
            new File([new Uint8Array(maxPhotoBytes + 1)], "large.png", {
              type: "image/png",
            }),
          ])
        ).status,
        413,
      );
      assert.equal(
        (
          await submit([
            new File([new Uint8Array(maxPhotoBytes + 128 * 1024)], "huge.png", {
              type: "image/png",
            }),
          ])
        ).status,
        413,
      );
      assert.equal(
        (
          await request("/api/ai", "POST", {
            text: "Report",
            source: "glasses",
            mediaIds: [randomUUID()],
          })
        ).status,
        400,
      );
      assert.equal(geminiRequests.length, callsBeforeInvalid);
    },
  );
});
