import type { GlassesStatus } from "../../../modules/oncue-wearables/src/OncueWearables.types";

export function connectionLabel(status: GlassesStatus | null): string {
  if (!status) return "Checking glasses…";
  if (!status.supported) return "Not available";
  if (status.error) return "Connection needs attention";
  if (status.busy || status.registration === "registering")
    return "Waiting for approval";
  if (status.registration !== "registered") return "Not connected";
  if (status.devices.some((device) => device.linkState === "connected"))
    return "Glasses connected";
  if (status.devices.some((device) => device.linkState === "connecting"))
    return "Connecting glasses…";
  return "Approved · waiting for glasses";
}

/** Only Meta's callback is rewritten. Auth and normal app links pass through. */
export function glassesCallbackRoute(path: string): string {
  try {
    const url = new URL(path, "mobile://app");
    return url.protocol === "mobile:" &&
      url.searchParams.has("metaWearablesAction")
      ? "/"
      : path;
  } catch {
    return path;
  }
}
