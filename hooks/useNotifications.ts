import * as Application from 'expo-application';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { apiRemovePushToken } from '@/lib/api';
import { registerForPushNotifications } from '@/lib/notifications';
import { useAuth } from '@/store/auth';

function handleNotificationNavigation(data: any, router: ReturnType<typeof useRouter>) {
  if (data.type === 'writing-ai-feedback' && data.responseId) {
    router.push(`/writing/ai-feedback/${data.responseId}` as any);
  } else if (data.type === 'writing-review' && data.sessionId) {
    router.push(`/writing/review/${data.sessionId}` as any);
  }
}

export function useNotifications() {
  const { user } = useAuth();
  const router = useRouter();
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [initialNotification, setInitialNotification] = useState<Notifications.Notification | null>(null);
  const deviceIdRef = useRef<string>('unknown');

  useEffect(() => {
    if (!user?.id) {
      setPushToken(null);
      setInitialNotification(null);
      return;
    }

    let isActive = true;

    // Resolve device ID once and cache it for cleanup
    const resolveDeviceId = async () => {
      if (Platform.OS === 'android') {
        deviceIdRef.current = Application.getAndroidId() ?? 'unknown';
      } else {
        deviceIdRef.current = (await Application.getIosIdForVendorAsync()) ?? 'unknown';
      }
    };
    resolveDeviceId();

    const notificationSubscription = Notifications.addNotificationReceivedListener((notification) => {
      console.log('Notification received:', notification.request.content.data);
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      console.log('Notification tapped:', data);
      handleNotificationNavigation(data, router);
    });

    const setupNotifications = async () => {
      try {
        const token = await registerForPushNotifications(user.id);
        if (isActive) {
          setPushToken(token);
        }

        const response = await Notifications.getLastNotificationResponseAsync();
        if (isActive && response) {
          setInitialNotification(response.notification);
          handleNotificationNavigation(response.notification.request.content.data, router);
        }
      } catch (error) {
        console.error('Failed to set up notifications:', error);
      }
    };

    setupNotifications();

    return () => {
      isActive = false;
      notificationSubscription.remove();
      responseSubscription.remove();

      // Remove this device's push token when user logs out
      apiRemovePushToken(deviceIdRef.current).catch(() => {});
    };
  }, [user?.id]);

  return {
    pushToken,
    initialNotification,
  };
}