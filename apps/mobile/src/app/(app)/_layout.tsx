import { useEffect } from "react";
import {
  captureAction,
  captureAvailable,
} from "@/features/glasses/capture-service";
import { ReportOutbox } from "@/features/glasses/report-outbox";
import { VoiceLaunchRouting } from "@/features/glasses/voice-launch-routing";
import AppTabs from "@/components/app-tabs";
import { OperationsProvider } from "@/features/oncue/operations-provider";

export default function AppLayout() {
  useEffect(
    () => () => {
      if (captureAvailable) void captureAction("stopHandsFree").catch(() => {});
    },
    [],
  );
  return (
    <OperationsProvider>
      <ReportOutbox />
      <VoiceLaunchRouting />
      <AppTabs />
    </OperationsProvider>
  );
}
