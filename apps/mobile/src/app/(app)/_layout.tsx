import AppTabs from "@/components/app-tabs";
import { OperationsProvider } from "@/features/oncue/operations-provider";

export default function AppLayout() {
  return (
    <OperationsProvider>
      <AppTabs />
    </OperationsProvider>
  );
}
