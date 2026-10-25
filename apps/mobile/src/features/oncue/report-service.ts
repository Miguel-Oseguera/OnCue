/** Mirrors the ai_activity fields, plus read-only related task evidence.
 * A future backend adapter owns report reads and persistence. This module never
 * invokes AI, submits observations, creates tasks, or writes to the database.
 */
export interface AIReport {
  reportId: string;
  taskId: string | null;
  report: string;
  decision: string | null;
  action: string | null;
  relatedEvidence: { mediaId: string; transcript: string | null }[];
}
export interface ReportService {
  listReports(): Promise<AIReport[]>;
}
const reports: AIReport[] = [
  {
    reportId: "report_projector",
    taskId: "task_projector",
    report:
      "Projector failure in Room 204. The projector is powered on but has no image. The HDMI cable is damaged and needs replacement.",
    decision:
      "Route to AV Support with urgent priority before the next session.",
    action: "Created a task to inspect the projector and restore the display.",
    relatedEvidence: [
      {
        mediaId: "media_projector",
        transcript:
          "The projector in Room 204 is on, but there’s no picture. I’m not sure if it’s the cable or the input. Can someone from AV take a look?",
      },
    ],
  },
  {
    reportId: "report_water",
    taskId: "task_water",
    report:
      "Water and cups are running low at the main lobby station. Additional supplies are needed.",
    decision: "Route to Logistics with high priority.",
    action: "Created a restocking task for the main lobby.",
    relatedEvidence: [
      {
        mediaId: "media_water",
        transcript:
          "We’re running low on water and cups at the main lobby station. Please send someone to restock.",
      },
    ],
  },
  {
    reportId: "report_microphone",
    taskId: null,
    report:
      "A microphone may be producing intermittent feedback near the main stage.",
    decision: "Monitor for another report before dispatching a team.",
    action: null,
    relatedEvidence: [],
  },
];
/** Demo records only. Related media is joined by taskId in the current schema;
 * it must not be represented as the exact source used to generate a report.
 */
export const mockReportService: ReportService = {
  async listReports() {
    return JSON.parse(JSON.stringify(reports)) as AIReport[];
  },
};
