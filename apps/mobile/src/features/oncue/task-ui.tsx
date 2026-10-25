import type { PropsWithChildren } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { dashboardColors as c } from "./dashboard-theme";
import type { Priority, TaskStatus } from "./service";

export const statusLabels: Record<TaskStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  completed: "Completed",
};
export const priorityColors: Record<Priority, string> = {
  low: c.muted,
  medium: c.accent,
  high: c.amber,
  urgent: c.red,
};
export const priorities: Priority[] = ["low", "medium", "high", "urgent"];
export const statuses: TaskStatus[] = ["open", "in_progress", "completed"];
export function backToTasks() {
  if (router.canGoBack()) router.back();
  else router.replace("/tasks");
}
export function Button({
  label,
  onPress,
  secondary = false,
  disabled = false,
  busy = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        t.button,
        secondary && t.secondaryButton,
        (disabled || busy) && { opacity: 0.45 },
        pressed && { opacity: 0.7 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={c.text} accessibilityLabel={label} />
      ) : (
        <Text style={[t.buttonText, secondary && { color: c.accent }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}
export function Chip({
  label,
  selected,
  onPress,
  disabled = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        t.chip,
        selected && t.chipSelected,
        disabled && { opacity: 0.4 },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={[t.chipText, selected && { color: c.text }]}>{label}</Text>
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={t.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.muted}
        selectionColor={c.accent}
        {...props}
        style={[
          t.input,
          props.multiline && { minHeight: 112, textAlignVertical: "top" },
          props.style,
        ]}
      />
    </View>
  );
}
export function Notice({ text }: { text: string }) {
  return (
    <Text accessibilityRole="alert" style={t.error}>
      {text}
    </Text>
  );
}
export function Page({ children }: PropsWithChildren) {
  return (
    <SafeAreaView style={t.screen} edges={["top", "left", "right"]}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={t.content}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function Heading({
  title,
  subtitle,
  back = false,
  section = "TASKS",
  backLabel = "All tasks",
  onBack = backToTasks,
}: {
  title: string;
  subtitle: string;
  back?: boolean;
  section?: string;
  backLabel?: string;
  onBack?: () => void;
}) {
  return (
    <View style={{ gap: 10 }}>
      {back && (
        <Pressable
          accessibilityRole="button"
          onPress={onBack}
          style={{
            minHeight: 44,
            justifyContent: "center",
            alignSelf: "flex-start",
          }}
        >
          <Text style={t.link}>‹ {backLabel}</Text>
        </Pressable>
      )}
      <View style={t.row}>
        <Text style={t.eyebrow}>ONCUE / {section}</Text>
        <View style={{ flex: 1 }} />
      </View>
      <Text style={t.title}>{title}</Text>
      <Text style={t.subtitle}>{subtitle}</Text>
    </View>
  );
}
export const t = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },
  content: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    padding: 22,
    paddingTop: 28,
    paddingBottom: 40,
    gap: 24,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  title: {
    fontSize: 34,
    lineHeight: 41,
    fontWeight: "700",
    letterSpacing: -1,
    color: c.text,
  },
  subtitle: { fontSize: 14, lineHeight: 22, color: c.muted },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 1.3,
    fontWeight: "700",
    color: c.accent,
  },
  demo: {
    color: c.accent,
    backgroundColor: c.raised,
    padding: 6,
    borderRadius: 5,
    fontSize: 9,
    letterSpacing: 1,
    fontWeight: "700",
  },
  label: { color: c.text, fontSize: 14, lineHeight: 21, fontWeight: "600" },
  body: { color: c.text, fontSize: 14, lineHeight: 23 },
  small: { color: c.muted, fontSize: 12, lineHeight: 19 },
  card: {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: 1,
    padding: 18,
    borderRadius: 18,
    gap: 14,
  },
  input: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 13,
    padding: 14,
    minHeight: 50,
    color: c.text,
    fontSize: 15,
    lineHeight: 22,
  },
  button: {
    backgroundColor: c.blue,
    borderRadius: 13,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    padding: 13,
  },
  secondaryButton: {
    backgroundColor: c.raised,
    borderWidth: 1,
    borderColor: c.border,
  },
  buttonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  chip: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  chipSelected: { backgroundColor: "#233A64", borderColor: c.accent },
  chipText: { color: c.muted, fontSize: 12, fontWeight: "600" },
  link: { color: c.accent, fontSize: 14, fontWeight: "600" },
  error: { color: c.red, lineHeight: 22, fontSize: 14 },
});
