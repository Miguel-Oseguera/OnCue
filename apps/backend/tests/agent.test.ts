import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { NoObjectGeneratedError } from "ai";
import { inArray } from "drizzle-orm";
import { z } from "zod";
import { LogisticsConversation } from "../src/agent/conversation.js";
import { runLogisticsAgent } from "../src/agent/index.js";
import { db, pool } from "../src/db.js";
import { aiActivity } from "../src/schema.js";

after(() => pool.end());

test("the AI SDK validates analysis and keeps only successful reports in history", async (t) => {
  const initialReport = `The projector is broken ${randomUUID()}`;
  const failedReport = `Failed report ${randomUUID()}`;
  const followupReport = `AV is on the way ${randomUUID()}`;
  const missingKeyReport = `Missing key ${randomUUID()}`;
  t.after(async () => {
    await db
      .delete(aiActivity)
      .where(
        inArray(aiActivity.report, [
          initialReport,
          failedReport,
          followupReport,
          missingKeyReport,
        ]),
      );
  });
  const analysis = {
    issueSummary: "Projector failure",
    category: "equipment",
    urgency: "high",
    recommendedActions: ["Send AV support"],
    missingInformation: [],
    requiresHumanAttention: true,
  };
  let responseText = JSON.stringify(analysis);
  const requests: unknown[] = [];
  const previousKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-key";
  t.after(() => {
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  });
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      const request = new Request(input, init);
      assert.equal(
        new URL(request.url).hostname,
        "generativelanguage.googleapis.com",
      );
      assert.ok(request.url.includes("gemini-3.5-flash-lite:generateContent"));
      assert.equal(request.headers.get("x-goog-api-key"), "test-key");
      requests.push(await request.json());
      return Response.json({
        candidates: [
          {
            content: { role: "model", parts: [{ text: responseText }] },
            finishReason: "STOP",
          },
        ],
      });
    },
  );

  const conversation = new LogisticsConversation();
  assert.deepEqual(await conversation.send(initialReport), analysis);
  const payload = z
    .object({
      generationConfig: z.object({
        responseMimeType: z.literal("application/json"),
        responseJsonSchema: z.object({
          properties: z.object({
            urgency: z.object({ enum: z.array(z.string()) }),
          }),
        }),
      }),
    })
    .parse(requests[0]);
  assert.deepEqual(
    payload.generationConfig.responseJsonSchema.properties.urgency.enum,
    ["low", "medium", "high", "critical"],
  );

  for (const invalid of [
    "not JSON",
    JSON.stringify({ ...analysis, urgency: "unknown" }),
  ]) {
    responseText = invalid;
    await assert.rejects(
      conversation.send(failedReport),
      NoObjectGeneratedError.isInstance,
    );
    assert.deepEqual(conversation.getHistory(), [initialReport]);
  }

  responseText = JSON.stringify(analysis);
  assert.deepEqual(await conversation.send(followupReport), analysis);
  const followup = z
    .object({
      contents: z.array(
        z.object({ parts: z.array(z.object({ text: z.string() })) }),
      ),
    })
    .parse(requests.at(-1));
  const prompt = followup.contents
    .flatMap((content) => content.parts)
    .map((part) => part.text)
    .join("\n");
  assert.ok(prompt.includes(initialReport));
  assert.ok(prompt.includes(followupReport));
  assert.ok(!prompt.includes(failedReport));

  const requestCount = requests.length;
  await assert.rejects(
    runLogisticsAgent({ message: "   " }),
    /A logistics report is required/,
  );
  delete process.env.GEMINI_API_KEY;
  await assert.rejects(
    runLogisticsAgent({ message: missingKeyReport }),
    /GEMINI_API_KEY is missing/,
  );
  assert.equal(requests.length, requestCount);
});
