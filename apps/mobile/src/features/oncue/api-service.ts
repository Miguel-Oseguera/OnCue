import type { AIReport } from "./report-service";
import type { Dashboard, DashboardService, Task } from "./service";

export type RequestJSON = (
  path: string,
  init?: RequestInit,
) => Promise<unknown>;
type Row = Record<string, unknown>;
const invalid = () =>
  new Error(
    "The backend returned an unsupported response. Please refresh or check the API version.",
  );
function row(value: unknown): Row {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw invalid();
  return value as Row;
}
function text(value: unknown): string {
  if (typeof value !== "string") throw invalid();
  return value;
}
function nullableText(value: unknown): string | null {
  return value == null ? null : text(value);
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw invalid();
  return value;
}
function strings(value: unknown): string[] {
  return array(value).map(text);
}
function count(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0)
    throw invalid();
  return value;
}
function evidence(value: unknown): AIReport["relatedEvidence"] {
  return value == null
    ? []
    : array(value).map((item) => {
        const itemRow = row(item);
        return {
          mediaId: text(itemRow.mediaId),
          transcript: nullableText(itemRow.transcript),
        };
      });
}
function report(
  value: unknown,
  related: AIReport["relatedEvidence"] = [],
): AIReport {
  const item = row(value);
  return {
    reportId: text(item.reportId),
    taskId: nullableText(item.taskId),
    report: text(item.report),
    decision: nullableText(item.decision),
    action: nullableText(item.action),
    relatedEvidence:
      item.relatedEvidence == null ? related : evidence(item.relatedEvidence),
  };
}
export function normalizeTask(value: unknown): Task {
  const item = row(value);
  const priority = text(item.priority);
  const status = text(item.status);
  if (
    !["low", "medium", "high", "urgent"].includes(priority) ||
    !["open", "in_progress", "completed"].includes(status)
  )
    throw invalid();
  const slots = count(item.slots);
  const createdAt = text(item.createdAt);
  if (slots < 1 || !Number.isFinite(Date.parse(createdAt))) throw invalid();
  const id = text(item.id);
  const reports = item.aiActivity ?? item.aiReports;
  const aiReports =
    reports === undefined
      ? undefined
      : array(reports).map((value) =>
          report(value, evidence(item.relatedEvidence)),
        );
  if (aiReports?.some((item) => item.taskId !== id)) throw invalid();
  return {
    id,
    title: text(item.title),
    description: text(item.description),
    priority: priority as Task["priority"],
    status: status as Task["status"],
    teamId: nullableText(item.teamId),
    assigneeIds: strings(item.assigneeIds),
    slots,
    location: nullableText(item.location),
    createdAt,
    ...(aiReports !== undefined && { aiReports }),
  };
}
export function normalizeDashboard(value: unknown): Dashboard {
  const body = row(value);
  const stats = row(body.stats);
  return {
    tasks: array(body.tasks).map((item) => {
      const task = normalizeTask(item);
      return { ...task, aiReports: task.aiReports ?? [] };
    }),
    teams: array(body.teams).map((item) => {
      const team = row(item);
      return {
        id: text(team.id),
        name: text(team.name),
        leadIds: strings(team.leadIds),
      };
    }),
    members: array(body.members).map((item) => {
      const member = row(item);
      return {
        id: text(member.id),
        name: text(member.name),
        teamId: nullableText(member.teamId),
      };
    }),
    stats: {
      open: count(stats.open),
      inProgress: count(stats.inProgress),
      completed: count(stats.completed),
      urgent: count(stats.urgent),
    },
    unlinkedAiReports:
      body.unlinkedAiReports === undefined
        ? []
        : array(body.unlinkedAiReports).map((item) => report(item)),
    unlinkedReportsAvailable: body.unlinkedAiReports !== undefined,
  };
}

export function createApiService(request: RequestJSON): DashboardService {
  return {
    async getDashboard() {
      return normalizeDashboard(await request("/api/dashboard"));
    },
    async createTask(input) {
      return normalizeTask(
        await request("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }),
      );
    },
    async updateTask(id, input) {
      return normalizeTask(
        await request(`/api/tasks/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }),
      );
    },
  };
}
