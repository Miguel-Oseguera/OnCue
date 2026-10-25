import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { api } from "./api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotifications() {
  if (Platform.OS === "web") return null;

  const permissions = await Notifications.getPermissionsAsync();
  let status = permissions.status;

  if (status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }

  if (status !== "granted") {
    console.log("Notification permission denied");
    return null;
  }

  // Remote push notifications require a physical device.
  if (!Constants.isDevice) {
    console.log("Push registration skipped on simulator");
    return null;
  }

  const projectId =
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId;

  if (!projectId) {
    console.warn("Missing Expo project ID");
    return null;
  }

  try {
    // Get this iPhone's Expo push token.
    const token = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    // Register the token with our authenticated OnCue backend.
    const response = await api.api.notifications.register.$post({
      json: {
        token: token.data,
        platform: Platform.OS === "ios" ? "ios" : "android",
      },
    });

    if (!response.ok) {
      console.error(
        "Backend push registration failed:",
        response.status,
      );
      return null;
    }

    console.log("Push token saved to OnCue backend!");
    return token.data;
  } catch (error) {
    console.error("Push registration failed:", error);
    return null;
  }
}

// Temporary function for testing local notifications.
export async function testNotification() {
  const { status } = await Notifications.requestPermissionsAsync();

  if (status !== "granted") return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "🚨 OnCue Alert",
      body: "AV assistance needed in Room 204!",
      sound: "default",
      data: {
        taskId: "task_projector",
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 5,
    },
  });
}