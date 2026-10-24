import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, Spacing } from "@/constants/theme";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";

type Connection =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "connected"; email: string }
  | { status: "error"; message: string };

export default function HomeScreen() {
  const { data: session } = authClient.useSession();
  const [connection, setConnection] = useState<Connection>({ status: "idle" });
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verifySession() {
    setConnection({ status: "checking" });
    try {
      const response = await api.api.me.$get();
      if (response.status !== 200) {
        setConnection({
          status: "error",
          message: "Your session has expired. Sign in again.",
        });
        await authClient.getSession();
        return;
      }
      const { user } = await response.json();
      setConnection({ status: "connected", email: user.email });
    } catch {
      setConnection({
        status: "error",
        message: "Unable to reach the backend. Try again.",
      });
    }
  }

  async function signOut() {
    setIsSigningOut(true);
    setError(null);
    try {
      const result = await authClient.signOut();
      if (result.error)
        setError(result.error.message ?? "Unable to sign out. Try again.");
    } catch {
      setError("Unable to reach OnCue. Please try again.");
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <ThemedText type="smallBold" style={styles.brand}>
              ONCUE
            </ThemedText>
            <ThemedText type="title" style={styles.title}>
              Hi, {session?.user.name}.
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              You&apos;re signed in and ready to go.
            </ThemedText>
          </View>

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">YOUR ACCOUNT</ThemedText>
            <ThemedText>{session?.user.email}</ThemedText>
            <Pressable
              accessibilityRole="button"
              disabled={isSigningOut}
              onPress={() => void signOut()}
              style={styles.action}
            >
              {isSigningOut ? (
                <ActivityIndicator />
              ) : (
                <ThemedText type="linkPrimary">Sign out</ThemedText>
              )}
            </Pressable>
            {error && (
              <ThemedText accessibilityRole="alert" style={styles.error}>
                {error}
              </ThemedText>
            )}
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold">CONNECTION STATUS</ThemedText>
            <ThemedText themeColor="textSecondary">
              Check that your account is connected to OnCue.
            </ThemedText>
            {connection.status === "connected" && (
              <ThemedText>Connected as {connection.email}</ThemedText>
            )}
            {connection.status === "error" && (
              <ThemedText accessibilityRole="alert" style={styles.error}>
                {connection.message}
              </ThemedText>
            )}
            <Pressable
              accessibilityRole="button"
              disabled={connection.status === "checking"}
              onPress={() => void verifySession()}
              style={styles.action}
            >
              {connection.status === "checking" ? (
                <ActivityIndicator />
              ) : (
                <ThemedText type="linkPrimary">Check connection</ThemedText>
              )}
            </Pressable>
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
    padding: Spacing.four,
    paddingTop: Spacing.six,
    paddingBottom: BottomTabInset + Spacing.six,
    gap: Spacing.four,
  },
  header: { gap: Spacing.three, marginVertical: Spacing.four },
  brand: { letterSpacing: 3, color: "#208AEF" },
  title: { fontSize: 38, lineHeight: 44 },
  card: { padding: Spacing.four, borderRadius: 20, gap: Spacing.three },
  action: { minHeight: 44, justifyContent: "center", alignItems: "flex-start" },
  error: { color: "#D74747" },
});
