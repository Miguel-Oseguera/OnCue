import type { CapturedPhoto } from "../../../modules/oncue-wearables/src/OncueWearables.types";

export type AIReportResult = { taskIds: string[] };
type Transport = (
  path: string,
  init: RequestInit,
  options?: { timeoutMs?: number },
) => Promise<unknown>;
export function createReportService(
  request: Transport,
  formFactory: () => FormData = () => new FormData(),
) {
  return {
    async submit(photo: CapturedPhoto): Promise<AIReportResult> {
      const text = photo.description?.trim();
      if (!text)
        throw new Error("A task description is required before sending.");
      if (text.length > 10_000)
        throw new Error("The description exceeds 10,000 characters.");
      if (!photo.uri.startsWith("file://"))
        throw new Error("The saved photo is unavailable.");
      const form = formFactory();
      form.append("text", text);
      form.append("source", "glasses");
      // React Native FormData streams this local file as a multipart attachment.
      const attachment = {
        uri: photo.uri,
        name: `${photo.id}.jpg`,
        type: "image/jpeg",
      };
      // The native FormData implementation accepts URI attachments; DOM typings do not.
      form.append("images", attachment as unknown as Blob);
      const body = await request(
        "/api/ai",
        { method: "POST", body: form },
        { timeoutMs: 120_000 },
      );
      if (
        !body ||
        typeof body !== "object" ||
        !("processed" in body) ||
        body.processed !== true ||
        !("tasks" in body) ||
        !Array.isArray(body.tasks)
      ) {
        throw new Error(
          "The backend did not confirm processing. Check your tasks before retrying.",
        );
      }
      const taskIds = body.tasks.map((task: unknown) => {
        if (
          !task ||
          typeof task !== "object" ||
          !("id" in task) ||
          typeof task.id !== "string"
        )
          throw new Error(
            "The backend returned an unexpected task response. Check your tasks before retrying.",
          );
        return task.id;
      });
      return { taskIds: [...new Set(taskIds)] };
    },
  };
}

export type DeliveryUpdate = {
  status: "uploading" | "sent" | "uncertain";
  message: string | null;
  taskIds: string[];
};
/** Persist the claim before contacting AI; never retry an ambiguous POST automatically. */
export async function deliverReport(
  photo: CapturedPhoto,
  dependencies: {
    mark: (update: DeliveryUpdate) => Promise<void>;
    submit: (photo: CapturedPhoto) => Promise<AIReportResult>;
  },
) {
  console.info(`[OnCue] Report ${photo.id}: claiming delivery`);
  await dependencies.mark({ status: "uploading", message: null, taskIds: [] });
  try {
    console.info(
      `[OnCue] Report ${photo.id}: sending photo and description to /api/ai`,
    );
    const result = await dependencies.submit(photo);
    console.info(
      `[OnCue] Report ${photo.id}: backend confirmed processing (${result.taskIds.length} tasks)`,
    );
    await dependencies.mark({
      status: "sent",
      message: result.taskIds.length
        ? `AI processed this report and returned ${result.taskIds.length} task${result.taskIds.length === 1 ? "" : "s"}.`
        : "AI processed this report without creating a new task.",
      taskIds: result.taskIds,
    });
    return true;
  } catch (cause) {
    console.warn(
      `[OnCue] Report ${photo.id}: delivery unconfirmed; check tasks before retrying`,
    );
    await dependencies.mark({
      status: "uncertain",
      message: `${cause instanceof Error ? cause.message : "Unable to confirm delivery."} Check your tasks before retrying; sending again may create duplicates.`,
      taskIds: [],
    });
    return false;
  }
}
