import { Stack } from "expo-router";
import { dashboardColors as c } from "@/features/oncue/dashboard-theme";

export const unstable_settings = { initialRouteName: "index" };
export default function TeamsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: c.background },
      }}
    />
  );
}
