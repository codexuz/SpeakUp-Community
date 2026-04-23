import * as ExpoInAppUpdates from "expo-in-app-updates";
import { useEffect } from "react";
import { Alert, Platform } from "react-native";

export const useInAppUpdates = () => {
  useEffect(() => {
    if (__DEV__ || Platform.OS === "web") return;

    const checkForUpdates = async () => {
      try {
        if (Platform.OS === "android") {
          // If you want an immediate update that will cover the app with the update overlay, set it to true.
          // More details: https://developer.android.com/guide/playcore/in-app-updates#update-flows
          await ExpoInAppUpdates.checkAndStartUpdate(true);
        } else {
          const result = await ExpoInAppUpdates.checkForUpdate();
          console.log("In-app update check result:", result);
          if (!result.updateAvailable) return;

          Alert.alert(
            "Update available",
            "A new version of the app is available with many improvements and bug fixes. Would you like to update now?",
            [
              {
                text: "Update",
                isPreferred: true,
                onPress: async () => {
                  try {
                    await ExpoInAppUpdates.startUpdate();
                  } catch (err) {
                    console.error("Failed to start update:", err);
                  }
                },
              },
              { text: "Cancel" },
            ]
          );
        }
      } catch (err) {
        console.error("Update check failed:", err);
      }
    };

    // Check immediately on mount
    checkForUpdates();

    // Check periodically every hour
    const interval = setInterval(checkForUpdates, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);
};
