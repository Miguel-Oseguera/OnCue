import { File } from "expo-file-system";
import native from "../../../modules/oncue-wearables/src/OncueWearablesModule";
import { requestJSON } from "@/lib/api";
import { createReportService } from "./report-service";
import type { CapturedPhoto } from "../../../modules/oncue-wearables/src/OncueWearables.types";

export const reportDeliveryAvailable = (native?.bridgeVersion ?? 0) >= 4;
export const reportService = createReportService(requestJSON, (photo) => {
  const file = new File(photo.uri);
  if (!file.exists) throw new Error("The saved glasses photo is missing.");
  if (file.size > 10 * 1024 * 1024)
    throw new Error("The photo exceeds the backend’s 10 MiB limit.");
  return file;
});
export async function setCaptureOwner(owner: string | null) {
  if (reportDeliveryAvailable && native) await native.setCaptureOwner(owner);
}
export async function markReport(
  photo: CapturedPhoto,
  status: "pending" | "uploading" | "sent" | "uncertain",
  message: string | null = null,
  taskIds: string[] = [],
) {
  if (!reportDeliveryAvailable || !native || !photo.ownerId)
    throw new Error("Update the iPhone app to send captured reports.");
  await native.setReportDelivery(
    photo.id,
    photo.ownerId,
    status,
    message,
    taskIds,
  );
}
export async function updateReportDescription(
  photo: CapturedPhoto,
  text: string,
) {
  if (!reportDeliveryAvailable || !native || !photo.ownerId)
    throw new Error(
      "This photo was captured before report delivery was enabled. Capture a new report.",
    );
  await native.setReportDescription(photo.id, photo.ownerId, text);
}
