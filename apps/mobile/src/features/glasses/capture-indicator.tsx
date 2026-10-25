import { Text, View } from "react-native";
import { Button, Notice, t } from "../oncue/task-ui";
import { dashboardColors as c } from "../oncue/dashboard-theme";
import { captureAction, captureLabel } from "./capture-service";
import { useCapture } from "./use-capture";
import { useState } from "react";

export function CaptureIndicator() {
  const { state } = useCapture();
  const [error, setError] = useState<string | null>(null);
  if (!state.enabled && state.phase !== "stopping") return null;
  return (
    <View style={{ gap: 10 }}>
      <Text
        accessibilityLiveRegion="polite"
        style={[t.label, { color: state.listening ? c.green : c.amber }]}
      >
        {captureLabel(state)}
      </Text>
      <Button
        label="Stop listening"
        secondary
        onPress={() => {
          void captureAction("stopHandsFree").catch((cause: unknown) =>
            setError(
              cause instanceof Error
                ? cause.message
                : "Unable to stop listening.",
            ),
          );
        }}
      />
      {error && <Notice text={error} />}
    </View>
  );
}
