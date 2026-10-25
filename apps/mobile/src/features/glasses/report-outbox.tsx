import { useEffect } from "react";
import { AppState } from "react-native";
import { authClient } from "@/lib/auth-client";
import { useOperations } from "../oncue/operations-provider";
import { getCaptureState, observeCapture } from "./capture-service";
import {
  markReport,
  reportDeliveryAvailable,
  reportService,
} from "./report-delivery";
import { deliverReport } from "./report-service";

// A single worker across React remounts prevents duplicate POSTs during navigation.
let worker: Promise<void> | null = null;
export function ReportOutbox() {
  const { data: session } = authClient.useSession();
  const owner = session?.user.id;
  const { refresh } = useOperations();
  useEffect(() => {
    if (!owner || !reportDeliveryAvailable) return;
    let active = true;
    const pump = async () => {
      if (!active) return;
      if (worker) {
        await worker;
        if (!active) return;
      }
      if (worker) return;
      const work = async () => {
        while (active) {
          const snapshot = await getCaptureState();
          if (!active) return;
          const photo = [...snapshot.photos]
            .reverse()
            .find(
              (item) =>
                item.ownerId === owner &&
                item.delivery === "pending" &&
                item.description?.trim(),
            );
          if (!photo) return;
          const sent = await deliverReport(photo, {
            mark: (update) =>
              markReport(photo, update.status, update.message, update.taskIds),
            submit: (report) => {
              if (!active)
                throw new Error(
                  "Sending stopped because the account session changed.",
                );
              return reportService.submit(report);
            },
          });
          if (sent && active) await refresh();
        }
      };
      // Store the promise synchronously before the first async read can complete.
      worker = work().catch(() => {
        /* Persisted uploading state prevents automatic retries if storage fails. */
      });
      try {
        await worker;
      } finally {
        worker = null;
      }
    };
    const trigger = () => {
      void pump();
    };
    const unsubscribe = observeCapture(trigger);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") trigger();
    });
    trigger();
    return () => {
      active = false;
      unsubscribe();
      subscription.remove();
    };
  }, [owner, refresh]);
  return null;
}
