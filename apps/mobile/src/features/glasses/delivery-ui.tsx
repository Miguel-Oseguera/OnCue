import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { authClient } from "@/lib/auth-client";
import type { CapturedPhoto } from "../../../modules/oncue-wearables/src/OncueWearables.types";
import { Button, Field, Notice, t } from "../oncue/task-ui";
import { markReport, updateReportDescription } from "./report-delivery";

export function DeliveryUI({ photo }: { photo: CapturedPhoto }) {
  const { data: session } = authClient.useSession();
  const [description, setDescription] = useState(photo.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const owned = photo.ownerId === session?.user.id;
  const retry = photo.delivery === "uncertain" || photo.delivery === "error";
  async function act(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to update the report.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: 12 }}>
      <Text style={t.eyebrow}>TASK DESCRIPTION</Text>
      <Text style={t.body}>
        {photo.description || "No description was heard."}
      </Text>
      <Text accessibilityLiveRegion="polite" style={t.label}>
        {
          {
            pending: "Queued for backend AI",
            uploading: "Sending to backend AI…",
            sent: "Processed by backend AI",
            uncertain: "Delivery unconfirmed",
            error: "Could not send",
            local: "Saved locally",
          }[photo.delivery ?? "local"]
        }
      </Text>
      {photo.deliveryMessage && (
        <Text style={t.small}>{photo.deliveryMessage}</Text>
      )}
      {owned && (photo.delivery === "local" || retry) && (
        <>
          <Field
            label="Task description"
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={10_000}
            placeholder="Describe the issue and its location"
          />
          <Button
            label={
              retry
                ? "Resend — may duplicate tasks"
                : "Send photo and description"
            }
            busy={busy}
            disabled={!description.trim()}
            onPress={() =>
              void act(async () => {
                await updateReportDescription(photo, description);
                await markReport(photo, "pending");
              })
            }
          />
        </>
      )}
      {photo.delivery === "sent" && (
        <Button
          label="View tasks"
          secondary
          onPress={() => router.navigate("/tasks")}
        />
      )}
      {error && <Notice text={error} />}
    </View>
  );
}
