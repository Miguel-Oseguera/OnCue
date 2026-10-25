import { Platform } from "react-native";
import native from "../../../modules/oncue-wearables/src/OncueWearablesModule";
import type { GlassesStatus } from "../../../modules/oncue-wearables/src/OncueWearables.types";

const available =
  Platform.OS === "ios" &&
  (native?.bridgeVersion ?? 0) >= 1 &&
  typeof native?.getStatus === "function" &&
  typeof native?.startRegistration === "function";
function unavailable(): GlassesStatus {
  return {
    supported: false,
    registration: "unavailable",
    busy: false,
    devices: [],
    error: null,
    reason:
      Platform.OS === "ios"
        ? "Install the updated OnCue development build on your iPhone to enable Connect glasses."
        : "Connect glasses is available in the OnCue iPhone development build.",
  };
}
export async function getGlassesStatus(): Promise<GlassesStatus> {
  return available && native ? native.getStatus() : unavailable();
}
export async function connectGlasses(): Promise<GlassesStatus> {
  if (!available || !native) throw new Error(unavailable().reason);
  return native.startRegistration();
}
export function observeGlasses(
  listener: (status: GlassesStatus) => void,
): () => void {
  if (!available || !native) return () => {};
  const subscription = native.addListener("onConnectionChange", listener);
  return () => subscription.remove();
}
