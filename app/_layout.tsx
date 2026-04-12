import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Redirect, Stack, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { registerForPushNotifications, useNotificationListeners } from '@/lib/notifications';
import { AuthProvider, useAuth } from '@/store/auth';

function RootNavigator() {
  const colorScheme = useColorScheme();
  const { isAuthenticated, isLoading, user } = useAuth();
  const segments = useSegments();

  useNotificationListeners();

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      registerForPushNotifications(user.id);
    }
  }, [isAuthenticated, user?.id]);

  const inAuthGroup = segments[0] === '(auth)';

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' }}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="speaking/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="group/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="group/create" options={{ headerShown: false }} />
        <Stack.Screen name="group/join" options={{ headerShown: false }} />
      </Stack>
      {!isAuthenticated && !inAuthGroup && <Redirect href="/(auth)/login" />}
      {isAuthenticated && inAuthGroup && <Redirect href="/(tabs)" />}
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
