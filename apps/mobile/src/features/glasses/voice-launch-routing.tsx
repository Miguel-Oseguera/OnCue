import { useEffect } from "react";
import { router } from "expo-router";
import { getVoiceLaunchState, observeVoiceLaunch } from "./voice-launch";

// Retain across tab/layout remounts so a previously handled launch cannot redirect again.
let handledLaunchId: string | null = null;
export function VoiceLaunchRouting() {
  useEffect(() => {
    let active = true;
    let receivedEvent = false;
    const apply = (state: Awaited<ReturnType<typeof getVoiceLaunchState>>) => {
      if (
        !active ||
        !state.lastLaunchId ||
        state.lastLaunchId === handledLaunchId
      )
        return;
      handledLaunchId = state.lastLaunchId;
      router.navigate("/(app)/capture");
    };
    const unsubscribe = observeVoiceLaunch((state) => {
      receivedEvent = true;
      apply(state);
    });
    void getVoiceLaunchState()
      .then((state) => {
        if (!receivedEvent) apply(state);
      })
      .catch(() => {});
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  return null;
}
