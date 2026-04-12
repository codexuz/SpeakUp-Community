import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';

import { registerForPushNotifications } from '@/lib/notifications';
import { useAuth } from '@/store/auth';

export function useNotifications() {
  const { user } = useAuth();
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [initialNotification, setInitialNotification] = useState<Notifications.Notification | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setPushToken(null);
      setInitialNotification(null);
      return;
    }

    let isActive = true;

    const notificationSubscription = Notifications.addNotificationReceivedListener((notification) => {
      console.log('Notification received:', notification.request.content.data);
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('Notification tapped:', response.notification.request.content.data);
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
    };
  }, [user?.id]);

  return {
    pushToken,
    initialNotification,
  };
}