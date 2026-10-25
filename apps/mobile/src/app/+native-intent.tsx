import { glassesCallbackRoute } from "@/features/glasses/connection-state";

export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}) {
  // The native subscriber handles the original Meta URL. Router returns to the
  // dashboard so callbacks never open an unmatched route. Auth links are untouched.
  return glassesCallbackRoute(path);
}
