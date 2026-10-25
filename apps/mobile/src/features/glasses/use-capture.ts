import { useEffect, useState } from "react";
import { AppState } from "react-native";
import {
  emptyCaptureState,
  getCaptureState,
  observeCapture,
} from "./capture-service";

export function useCapture() {
  const [state, setState] = useState(emptyCaptureState);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    let revision = 0;
    const apply = (value: typeof state) => {
      if (active) {
        revision++;
        setState(value);
        setError(null);
      }
    };
    const refresh = () => {
      const requested = revision;
      void getCaptureState()
        .then((value) => {
          if (requested === revision) apply(value);
        })
        .catch((cause: unknown) => {
          if (active)
            setError(
              cause instanceof Error
                ? cause.message
                : "Unable to check capture status.",
            );
        });
    };
    const unsubscribe = observeCapture(apply);
    refresh();
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") refresh();
    });
    return () => {
      active = false;
      unsubscribe();
      subscription.remove();
    };
  }, []);
  return { state, error };
}
