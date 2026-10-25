import native from "../../../modules/oncue-wearables/src/OncueWearablesModule";
import type { VoiceLaunchState } from "../../../modules/oncue-wearables/src/OncueWearables.types";
import { Platform } from "react-native";

const available = Platform.OS === "ios" && (native?.bridgeVersion ?? 0) >= 3;
export async function setVoiceLaunchAllowed(allowed: boolean) {
  if (available && native) await native.setVoiceLaunchAllowed(allowed);
}
export async function getVoiceLaunchState(): Promise<VoiceLaunchState> {
  return available && native
    ? native.getVoiceLaunchState()
    : { ready: false, error: null, lastLaunchId: null };
}
export function observeVoiceLaunch(
  listener: (state: VoiceLaunchState) => void,
): () => void {
  if (!available || !native) return () => {};
  const subscription = native.addListener("onVoiceLaunchChange", listener);
  return () => subscription.remove();
}
