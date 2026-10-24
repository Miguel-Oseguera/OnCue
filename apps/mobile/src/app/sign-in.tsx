import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { authClient } from "@/lib/auth-client";

export default function SignInScreen() {
  const theme = useTheme();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSignUp = mode === "sign-up";

  async function submit() {
    if (isSubmitting) return;
    setError(null);
    if (!email.trim() || !password || (isSignUp && !name.trim())) {
      setError("Complete all fields to continue.");
      return;
    }
    if (isSignUp && password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    setIsSubmitting(true);
    try {
      const result = isSignUp
        ? await authClient.signUp.email({
            name: name.trim(),
            email: email.trim(),
            password,
          })
        : await authClient.signIn.email({ email: email.trim(), password });
      if (result.error) {
        setError(
          result.error.message ?? "Unable to sign in. Please try again.",
        );
      }
    } catch {
      setError("Unable to reach OnCue. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.screen}>
        <KeyboardAvoidingView
          style={styles.screen}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.card}>
              <ThemedText type="smallBold" style={styles.brand}>
                ONCUE
              </ThemedText>
              <ThemedText type="title" style={styles.title}>
                {isSignUp ? "Create your account." : "Welcome back."}
              </ThemedText>
              <ThemedText themeColor="textSecondary">
                {isSignUp
                  ? "Create your account to get started."
                  : "Sign in to your OnCue account."}
              </ThemedText>

              <View style={styles.fields}>
                {isSignUp && (
                  <View style={styles.field}>
                    <ThemedText type="smallBold">Name</ThemedText>
                    <TextInput
                      accessibilityLabel="Name"
                      placeholder="Your name"
                      placeholderTextColor={theme.textSecondary}
                      value={name}
                      onChangeText={setName}
                      textContentType="name"
                      autoComplete="name"
                      editable={!isSubmitting}
                      style={[
                        styles.input,
                        {
                          color: theme.text,
                          backgroundColor: theme.backgroundElement,
                        },
                      ]}
                    />
                  </View>
                )}
                <View style={styles.field}>
                  <ThemedText type="smallBold">Email</ThemedText>
                  <TextInput
                    accessibilityLabel="Email"
                    placeholder="you@example.com"
                    placeholderTextColor={theme.textSecondary}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="emailAddress"
                    autoComplete="email"
                    editable={!isSubmitting}
                    style={[
                      styles.input,
                      {
                        color: theme.text,
                        backgroundColor: theme.backgroundElement,
                      },
                    ]}
                  />
                </View>
                <View style={styles.field}>
                  <ThemedText type="smallBold">Password</ThemedText>
                  <TextInput
                    key={mode}
                    accessibilityLabel="Password"
                    placeholder={
                      isSignUp ? "At least 8 characters" : "Your password"
                    }
                    placeholderTextColor={theme.textSecondary}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType={isSignUp ? "newPassword" : "password"}
                    autoComplete={
                      isSignUp ? "new-password" : "current-password"
                    }
                    editable={!isSubmitting}
                    returnKeyType="go"
                    onSubmitEditing={() => void submit()}
                    style={[
                      styles.input,
                      {
                        color: theme.text,
                        backgroundColor: theme.backgroundElement,
                      },
                    ]}
                  />
                </View>
              </View>

              {error && (
                <ThemedText accessibilityRole="alert" style={styles.error}>
                  {error}
                </ThemedText>
              )}

              <Pressable
                accessibilityRole="button"
                disabled={isSubmitting}
                onPress={() => void submit()}
                style={({ pressed }) => [
                  styles.button,
                  (pressed || isSubmitting) && styles.dimmed,
                ]}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <ThemedText style={styles.buttonText}>
                    {isSignUp ? "Create account" : "Sign in"}
                  </ThemedText>
                )}
              </Pressable>

              <Pressable
                accessibilityRole="button"
                disabled={isSubmitting}
                style={styles.switchMode}
                onPress={() => {
                  setMode(isSignUp ? "sign-in" : "sign-up");
                  setError(null);
                  setPassword("");
                }}
              >
                <ThemedText type="small" style={styles.switchText}>
                  {isSignUp
                    ? "Already have an account? Sign in"
                    : "New to OnCue? Create an account"}
                </ThemedText>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.four,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    gap: Spacing.three,
    paddingVertical: Spacing.four,
  },
  brand: { letterSpacing: 3, color: "#208AEF", marginBottom: Spacing.two },
  title: { fontSize: 38, lineHeight: 44 },
  fields: { gap: Spacing.three, marginTop: Spacing.three },
  field: { gap: Spacing.two },
  input: {
    minHeight: 52,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  error: { color: "#D74747", fontSize: 14 },
  button: {
    minHeight: 52,
    backgroundColor: "#166CC5",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: "#fff", fontWeight: "700" },
  dimmed: { opacity: 0.65 },
  switchMode: { minHeight: 44, justifyContent: "center" },
  switchText: { textAlign: "center" },
});
