import { useAlert } from '@/components/CustomAlert';
import * as ExpoInAppUpdates from 'expo-in-app-updates';
import { useEffect } from 'react';

export const useInAppUpdates = () => {
  const { alert } = useAlert();

  useEffect(() => {
    if (__DEV__) return;

    const checkForUpdates = async () => {
      try {
        const result = await ExpoInAppUpdates.checkForUpdate();
        console.log('In-app update check result:', result);
        if (!result.updateAvailable) return;

        alert(
          'Update available',
          'A new version of the app is available with many improvements and bug fixes. Would you like to update now?',
          [
            {
              text: 'Update',
              onPress: async () => {
                try {
                  await ExpoInAppUpdates.startUpdate();
                } catch (err) {
                  console.error('Failed to start update:', err);
                }
              },
            },
            { text: 'Cancel' },
          ],
          'info',
        );
      } catch (err) {
        console.error('Update check failed:', err);
      }
    };

    // Check immediately on mount
    checkForUpdates();

    // Check periodically every hour
    const interval = setInterval(checkForUpdates, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);
};