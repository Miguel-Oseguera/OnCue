import type { AppType } from "backend";
import { hc } from "hono/client";
import { Platform } from "react-native";

import { authClient, backendURL } from "./auth-client";

// Browsers use their cookie jar. Native API calls forward the SecureStore cookie.
const authenticatedFetch: typeof fetch = async (input, init) => {
  const headers = new Headers(init?.headers);
  if (Platform.OS !== "web") {
    const cookie = await authClient.getCookie();
    if (cookie) headers.set("Cookie", cookie);
  }
  return fetch(input, {
    ...init,
    headers,
    credentials: Platform.OS === "web" ? "include" : "omit",
  });
};

export const api = hc<AppType>(backendURL, { fetch: authenticatedFetch });
