import { useEffect } from "react";
import { captureAction } from "@/features/glasses/capture-service";
import { setCaptureOwner } from "@/features/glasses/report-delivery";
import { setVoiceLaunchAllowed } from "@/features/glasses/voice-launch";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { ActivityIndicator, useColorScheme, View } from "react-native";

import { AnimatedSplashOverlay } from "@/components/animated-icon";
import { authClient } from "@/lib/auth-client";

SplashScreen.preventAutoHideAsync();

// Development demo: activate hands-free once after sign-in. Production remains manual.
let requestedDemoListener = false;

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { data: session, isPending } = authClient.useSession();
  useEffect(() => {
    if (!isPending)
      void (async () => {
        await setCaptureOwner(session?.user.id ?? null);
        await setVoiceLaunchAllowed(Boolean(session));
        if (__DEV__ && session && !requestedDemoListener) {
          requestedDemoListener = true;
          await captureAction("startHandsFree");
        }
      })().catch(() => {});
  }, [isPending, session]);
  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      {isPending && !session ? (
        <View
          style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
        >
          <ActivityIndicator accessibilityLabel="Restoring your session" />
        </View>
      ) : (
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={!session}>
            <Stack.Screen name="sign-in" />
          </Stack.Protected>
          <Stack.Protected guard={Boolean(session)}>
            <Stack.Screen name="(app)" />
          </Stack.Protected>
        </Stack>
      )}
    </ThemeProvider>
  );
}
