/** Read-only report DTO mapped from dashboard.tasks[].aiActivity.
 * Evidence is only populated when returned by the backend. This code never
 * invokes an AI service or submits reports for processing.
 */
export interface AIReport {
  reportId: string;
  taskId: string | null;
  report: string;
  decision: string | null;
  action: string | null;
  relatedEvidence: { mediaId: string; transcript: string | null }[];
}
export interface StructuredDecision {
  issueSummary?: string;
  category?: string;
  urgency?: string;
  recommendedActions?: string[];
  missingInformation?: string[];
  requiresHumanAttention?: boolean;
}
export function parseDecision(value: string | null): StructuredDecision | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return null;
    const source = parsed as Record<string, unknown>;
    const result: StructuredDecision = {};
    for (const key of ["issueSummary", "category", "urgency"] as const)
      if (typeof source[key] === "string") result[key] = source[key];
    for (const key of ["recommendedActions", "missingInformation"] as const)
      if (
        Array.isArray(source[key]) &&
        source[key].every((item) => typeof item === "string")
      )
        result[key] = source[key];
    if (typeof source.requiresHumanAttention === "boolean")
      result.requiresHumanAttention = source.requiresHumanAttention;
    return Object.keys(result).length ? result : null;
  } catch {
    return null;
  }
}
