
import "dotenv/config";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { AGENT_INSTRUCTIONS } from "./instructions.js";

const LogisticsAnalysisSchema = z.object({
  issueSummary: z.string(),
  category: z.enum([
    "staffing",
    "supplies",
    "equipment",
    "schedule",
    "safety",
    "venue",
    "other",
  ]),
  urgency: z.enum(["low", "medium", "high", "critical"]),
  recommendedActions: z.array(z.string()).min(1).max(5),
  missingInformation: z.array(z.string()),
  requiresHumanAttention: z.boolean(),
});

export type LogisticsAnalysis = z.infer<
  typeof LogisticsAnalysisSchema
>;

export async function runLogisticsAgent(
  message: string,
  history: string[] = [],
): Promise<LogisticsAnalysis> {
  if (!message.trim()) {
    throw new Error("A logistics report is required.");
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash-lite",
    contents: `
You are analyzing a live event logistics report.

Previous reports about this incident:
${history.length ? history.join("\n") : "None"}

Latest report:
${message}

Analyze the current situation using the previous reports
for context. Prioritize the latest information.
    `,
    config: {
      systemInstruction: AGENT_INSTRUCTIONS,
      responseMimeType: "application/json",
    },
  });

  const text = response.text;

  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  let result: unknown;

  try {
    result = JSON.parse(text);
  } catch {
    throw new Error("Gemini returned invalid JSON.");
  }

  console.log("Raw Gemini response:", JSON.stringify(result, null, 2));

  return LogisticsAnalysisSchema.parse(result);
}
