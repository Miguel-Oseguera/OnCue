import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import type { VoiceLaunchState } from "../../../modules/oncue-wearables/src/OncueWearables.types";
import { Notice, t } from "../oncue/task-ui";
import { getVoiceLaunchState, observeVoiceLaunch } from "./voice-launch";

export function VoiceLaunchStatus() {
  const [status, setStatus] = useState<VoiceLaunchState | null>(null);
  useEffect(() => {
    let active = true;
    let received = false;
    const unsubscribe = observeVoiceLaunch((value) => {
      received = true;
      if (active) setStatus(value);
    });
    void getVoiceLaunchState()
      .then((value) => {
        if (active && !received) setStatus(value);
      })
      .catch(() => {});
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  return (
    <View style={{ gap: 8 }}>
      <Text style={t.label}>“Hey Meta, start OnCue.”</Text>
      <Text style={t.small}>
        {status?.ready
          ? "OnCue’s voice launch channel is connected."
          : "Voice launch is waiting for connected glasses."}{" "}
        Meta project setup is required before Meta can recognize the app name.
      </Text>
      <Text style={t.small}>
        Once listening, say “OnCue, stop listening” to end the session. After it
        stops, use “Hey Meta, start OnCue” to begin again.
      </Text>
      {status?.error && <Notice text={status.error} />}
    </View>
  );
}
