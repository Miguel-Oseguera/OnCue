import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

function getBackendURL() {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (configured) return new URL(configured).origin;
  if (!__DEV__)
    throw new Error("EXPO_PUBLIC_API_URL must be set for production builds.");

  // Expo's host is reachable from a physical phone; localhost refers to the phone itself.
  const host = Constants.expoConfig?.hostUri;
  if (host && Platform.OS !== "web") {
    const url = new URL(`http://${host}`);
    url.port = "3000";
    return url.origin;
  }
  return "http://localhost:3000";
}

export const backendURL = getBackendURL();

export const authClient = createAuthClient({
  baseURL: backendURL,
  plugins: [
    expoClient({
      scheme: "mobile",
      storagePrefix: "oncue",
      storage: SecureStore,
    }),
  ],
});
