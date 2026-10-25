import { router } from "expo-router";
import { CaptureIndicator } from "./capture-indicator";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Text, View } from "react-native";
import type { GlassesStatus } from "../../../modules/oncue-wearables/src/OncueWearables.types";
import { dashboardColors as c } from "../oncue/dashboard-theme";
import { Button, Notice, t } from "../oncue/task-ui";
import { connectionLabel } from "./connection-state";
import { connectGlasses, getGlassesStatus, observeGlasses } from "./service";

export function GlassesConnectionCard() {
  const [status, setStatus] = useState<GlassesStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  useEffect(() => {
    let active = true;
    const apply = (value: GlassesStatus) => {
      if (active) {
        setStatus(value);
        setError(null);
      }
    };
    const refresh = () => {
      void getGlassesStatus()
        .then(apply)
        .catch((cause: unknown) => {
          if (active)
            setError(
              cause instanceof Error
                ? cause.message
                : "Unable to check your glasses.",
            );
        });
    };
    const unsubscribe = observeGlasses(apply);
    refresh();
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      active = false;
      unsubscribe();
      appState.remove();
    };
  }, []);
  const checkStatus = useCallback(async () => {
    setError(null);
    try {
      setStatus(await getGlassesStatus());
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to check your glasses.",
      );
    }
  }, []);
  async function connect() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      setStatus(await connectGlasses());
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to connect. Please try again.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  const registered = status?.registration === "registered";
  const waiting =
    busy || status?.busy || status?.registration === "registering";
  const connected =
    registered &&
    status.devices.some((device) => device.linkState === "connected");
  return (
    <View style={t.card}>
      <View style={t.row}>
        <Text style={[t.eyebrow, { flex: 1 }]}>META GLASSES</Text>
        <View
          style={{
            width: 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: connected ? c.green : c.muted,
          }}
        />
      </View>
      <Text
        accessibilityLiveRegion="polite"
        style={[t.label, { fontSize: 18 }]}
      >
        {connectionLabel(status)}
      </Text>
      {status && !status.supported ? (
        <Text style={t.small}>{status.reason}</Text>
      ) : (
        <>
          <Text style={t.small}>
            {waiting
              ? "Complete the approval in Meta AI, then return to OnCue."
              : registered
                ? "Keep the glasses powered on and connected in Meta AI. Registration approval and the glasses connection are shown separately."
                : "Approve OnCue in Meta AI to link your glasses. Bluetooth access is required."}
          </Text>
          {status?.devices.map((device) => (
            <View key={device.id} style={{ gap: 5 }}>
              <Text style={t.label}>{device.name}</Text>
              <Text style={t.small}>
                {device.linkState}
                {device.batteryLevel !== null
                  ? ` · ${device.batteryLevel}% battery`
                  : ""}
              </Text>
              {device.compatibility &&
                device.compatibility !== "Compatible" && (
                  <Text style={t.small}>{device.compatibility}</Text>
                )}
            </View>
          ))}
          {!registered && (
            <Button
              label="Connect glasses"
              busy={busy}
              disabled={!status || !status.supported || Boolean(waiting)}
              onPress={() => void connect()}
            />
          )}
          <Button
            label="Refresh connection"
            secondary
            disabled={busy}
            onPress={() => void checkStatus()}
          />
          <CaptureIndicator />
          <Button
            label="Hands-free capture"
            secondary
            onPress={() => router.push("/capture")}
          />
        </>
      )}
      {(error || status?.error) && (
        <Notice text={error ?? status?.error ?? ""} />
      )}
    </View>
  );
}
