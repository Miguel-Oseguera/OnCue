import { Platform } from "react-native";
import native from "../../../modules/oncue-wearables/src/OncueWearablesModule";
import type { CaptureState } from "../../../modules/oncue-wearables/src/OncueWearables.types";

export const captureAvailable =
  Platform.OS === "ios" && (native?.bridgeVersion ?? 0) >= 2;
export const emptyCaptureState: CaptureState = {
  enabled: false,
  listening: false,
  capturing: false,
  readyForCapture: false,
  phase: "off",
  error: null,
  photos: [],
};
export async function getCaptureState(): Promise<CaptureState> {
  return captureAvailable && native
    ? native.getCaptureState()
    : emptyCaptureState;
}
export async function captureAction(
  action: "startHandsFree" | "stopHandsFree" | "capturePhoto",
): Promise<CaptureState> {
  if (!captureAvailable || !native)
    throw new Error(
      "Install the updated OnCue iPhone build to use hands-free capture.",
    );
  return native[action]();
}
export function observeCapture(
  listener: (state: CaptureState) => void,
): () => void {
  if (!captureAvailable || !native) return () => {};
  const subscription = native.addListener("onCaptureChange", listener);
  return () => subscription.remove();
}
export function captureLabel(state: CaptureState): string {
  if (state.phase === "capturing") return "Taking photo…";
  if (state.phase === "saving") return "Saving photo…";
  if (state.listening) return "Listening for OnCue";
  const labels: Record<CaptureState["phase"], string> = {
    off: "Hands-free is off",
    permissions: "Waiting for approval in Meta AI",
    starting: "Starting your glasses…",
    listening: "Listening for OnCue",
    capturing: "Taking photo…",
    saving: "Saving photo…",
    paused: "Paused by glasses",
    stopping: "Stopping…",
    error: "Hands-free stopped",
  };
  return labels[state.phase];
}
