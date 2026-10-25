import { useEffect } from "react";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";

import AppTabs from "@/components/app-tabs";
import { OperationsProvider } from "@/features/oncue/operations-provider";
import { registerForPushNotifications } from "@/lib/notifications";

export default function AppLayout() {
  useEffect(() => {
    void registerForPushNotifications();

    function openNotification(
      response: Notifications.NotificationResponse,
    ) {
      const taskId = response.notification.request.content.data?.taskId;

      if (typeof taskId !== "string" || !taskId) return;

      router.push({
        pathname: "/tasks/[id]",
        params: { id: taskId },
      });
    }

    // Handles notifications tapped while the app is running/backgrounded.
    const subscription =
      Notifications.addNotificationResponseReceivedListener(openNotification);

    // Handles a notification that launched the app.
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) openNotification(response);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <OperationsProvider>
      <AppTabs />
    </OperationsProvider>
  );
}