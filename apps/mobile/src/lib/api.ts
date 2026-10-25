import { Platform } from "react-native";
import { authClient, backendURL } from "./auth-client";

/** Preserve the existing Better Auth cookie handling on native and web. */
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

/** Transport returns unknown; feature adapters validate data before rendering it.
 * No generated backend build is required by the mobile application.
 */
export async function requestJSON(
  path: string,
  init: RequestInit = {},
  options: { timeoutMs?: number } = {},
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 15000,
  );
  try {
    const response = await authenticatedFetch(
      new URL(path, backendURL).toString(),
      { ...init, signal: controller.signal },
    );
    if (response.status === 401) {
      await authClient.getSession().catch(() => undefined);
      throw new Error("Your session has expired. Please sign in again.");
    }
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        body &&
        typeof body === "object" &&
        "error" in body &&
        typeof body.error === "string"
          ? body.error
          : `Request failed (${response.status}). Please try again.`;
      throw new Error(message);
    }
    if (body === null)
      throw new Error(
        "The server returned an empty response. Please try again.",
      );
    return body;
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error("The server took too long to respond. Please try again.");
    if (error instanceof TypeError)
      throw new Error(
        "Unable to reach OnCue. Check your connection and that the backend is running.",
      );
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
