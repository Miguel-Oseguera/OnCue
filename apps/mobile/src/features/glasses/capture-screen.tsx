import { VoiceLaunchStatus } from "./voice-launch-status";
import { useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Button, Heading, Notice, Page, t } from "../oncue/task-ui";
import { dashboardColors as c } from "../oncue/dashboard-theme";
import {
  captureAction,
  captureAvailable,
  captureLabel,
} from "./capture-service";
import { useCapture } from "./use-capture";

export default function CaptureScreen() {
  const { state, error: statusError } = useCapture();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const inFlight = useRef(false);
  async function act(action: Parameters<typeof captureAction>[0]) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      await captureAction(action);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to capture. Please try again.",
      );
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }
  const photo =
    state.photos.find((item) => item.id === selectedId) ?? state.photos[0];
  const starting = state.phase === "permissions" || state.phase === "starting";
  const stopping = state.phase === "stopping";
  return (
    <Page>
      <Heading
        title="Capture the moment."
        section="GLASSES"
        subtitle="Spot a task. Say the word. Review it here."
        back
        backLabel="Dashboard"
        onBack={() => router.navigate("/")}
      />
      <View style={t.card}>
        <VoiceLaunchStatus />
        <View style={t.row}>
          <View
            style={{
              width: 9,
              height: 9,
              borderRadius: 5,
              backgroundColor: state.listening ? c.green : c.muted,
            }}
          />
          <Text style={[t.label, { flex: 1 }]} accessibilityLiveRegion="polite">
            {captureLabel(state)}
          </Text>
          <Text style={t.demo}>BETA</Text>
        </View>
        <Text style={[t.title, { fontSize: 26, lineHeight: 34 }]}>
          “OnCue, capture this task.”
        </Text>
        <Text style={t.body}>
          Turn on hands-free mode once, then use your voice for each photo. Your
          glasses microphone stays active until you stop listening or the
          session ends.
        </Text>
        <Text style={t.small}>
          Camera and microphone approval may open Meta AI. Speech and photo
          capture must be enabled for OnCue in Wearables Developer Center.
          Locked-phone behavior is still being tested.
        </Text>
        {!captureAvailable && (
          <Notice text="Use the updated OnCue development build on your iPhone with your glasses connected." />
        )}
        {state.enabled || starting ? (
          <Button
            label="Stop listening"
            secondary
            disabled={stopping}
            onPress={() =>
              void captureAction("stopHandsFree").catch((cause: unknown) =>
                setError(
                  cause instanceof Error ? cause.message : "Unable to stop.",
                ),
              )
            }
          />
        ) : (
          <Button
            label="Start hands-free mode"
            disabled={!captureAvailable || pending || stopping}
            busy={pending}
            onPress={() => void act("startHandsFree")}
          />
        )}
        <Button
          label={state.capturing ? "Receiving photo…" : "Capture with button"}
          secondary
          disabled={!state.readyForCapture || pending || stopping}
          onPress={() => void act("capturePhoto")}
        />
        {(error || statusError || state.error) && (
          <Notice text={error ?? statusError ?? state.error ?? ""} />
        )}
        {state.phase === "paused" && (
          <Text style={t.small}>
            The glasses paused this session. Waiting for them to resume; no
            commands are processed while paused.
          </Text>
        )}
      </View>
      <View style={{ gap: 14 }}>
        <View style={t.row}>
          <Text style={[t.label, { flex: 1, fontSize: 20 }]}>
            Captured photos
          </Text>
          <Text style={t.small}>{state.photos.length} saved</Text>
        </View>
        {photo ? (
          <View style={t.card}>
            <Image
              source={{ uri: photo.uri }}
              accessibilityLabel="Photo captured from your Meta glasses"
              contentFit="contain"
              style={{
                width: "100%",
                aspectRatio: 4 / 3,
                borderRadius: 12,
                backgroundColor: c.background,
              }}
            />
            <Text style={t.label}>
              {new Date(photo.capturedAt).toLocaleString()}
            </Text>
            <Text style={t.small}>
              {photo.source === "voice" ? "Voice capture" : "Button capture"} ·
              Saved on this iPhone
            </Text>
            {state.photos.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10 }}
              >
                {state.photos.map((item) => (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityLabel={`View photo from ${new Date(item.capturedAt).toLocaleString()}`}
                    accessibilityState={{ selected: item.id === photo.id }}
                    onPress={() => setSelectedId(item.id)}
                    style={{
                      borderWidth: 2,
                      borderColor:
                        item.id === photo.id ? c.accent : "transparent",
                      borderRadius: 10,
                    }}
                  >
                    <Image
                      source={{ uri: item.uri }}
                      contentFit="cover"
                      style={{ width: 68, height: 68, borderRadius: 8 }}
                    />
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        ) : (
          <View style={[t.card, { paddingVertical: 34, alignItems: "center" }]}>
            <Text style={{ fontSize: 36, color: c.accent }}>◎</Text>
            <Text style={t.label}>Your next task starts here.</Text>
            <Text style={[t.small, { textAlign: "center" }]}>
              Photos from your glasses will appear here, ready for review.
            </Text>
          </View>
        )}
        <Text style={t.small}>
          Photos stay in OnCue on this iPhone. Nothing is uploaded, sent to AI,
          or turned into a task automatically. Other speech is discarded.
        </Text>
      </View>
    </Page>
  );
}
