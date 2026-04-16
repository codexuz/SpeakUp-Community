import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Redirect, Stack, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import 'react-native-reanimated';

import { CustomAlertProvider } from '@/components/CustomAlert';
import { ToastProvider } from '@/components/Toast';
import { TG } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useInAppUpdates } from '@/hooks/useInAppUpdates';
import { useNotifications } from '@/hooks/useNotifications';
import { AuthProvider, useAuth } from '@/store/auth';

SplashScreen.preventAutoHideAsync();

function getRoleRoute(role?: string): '/(student)' | '/(teacher)' | '/(admin)' {
  if (role === 'admin') return '/(admin)';
  if (role === 'teacher') return '/(teacher)';
  return '/(student)';
}

function RootNavigator() {
  const colorScheme = useColorScheme();
  const { isAuthenticated, isLoading, user } = useAuth();
  const segments = useSegments();

  useNotifications();
  useInAppUpdates();

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  const inAuthGroup = segments[0] === '(auth)';
  const seg = segments[0] as string;
  const inRoleGroup = seg === '(student)' || seg === '(teacher)' || seg === '(admin)';

  if (isLoading) {
    return null;
  }

  const needsRedirect =
    (!isAuthenticated && !inAuthGroup) ||
    (isAuthenticated && inAuthGroup) ||
    (isAuthenticated && !inAuthGroup && inRoleGroup && seg !== getRoleRoute(user?.role ?? undefined).slice(1)) ||
    (isAuthenticated && !inAuthGroup && !inRoleGroup && seg === '(tabs)');

  const redirectTarget = !isAuthenticated
    ? '/(auth)/login'
    : getRoleRoute(user?.role ?? undefined);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <StatusBar barStyle="light-content" backgroundColor={TG.headerBg} />
      {needsRedirect ? (
        <View style={[StyleSheet.absoluteFill, { zIndex: 1, backgroundColor: colorScheme === 'dark' ? '#0f172a' : '#ffffff' }]} />
      ) : null}
      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(student)" options={{ headerShown: false }} />
        <Stack.Screen name="(teacher)" options={{ headerShown: false }} />
        <Stack.Screen name="(admin)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="speaking/index" options={{ headerShown: false }} />
        <Stack.Screen name="speaking/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="session/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="review/[id]/index" options={{ headerShown: false }} />
        <Stack.Screen name="review/[id]/edit" options={{ headerShown: false }} />
        <Stack.Screen name="community/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="comment/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="user/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="followers/[userId]/index" options={{ headerShown: false }} />
        <Stack.Screen name="followings/[userId]/index" options={{ headerShown: false }} />
        <Stack.Screen name="group/[id]/index" options={{ headerShown: false }} />
        <Stack.Screen name="group/[id]/detail" options={{ headerShown: false }} />
        <Stack.Screen name="group/[id]/messaging" options={{ headerShown: false }} />
        <Stack.Screen name="group/[id]/submissions" options={{ headerShown: false }} />
        <Stack.Screen name="group/[id]/requests" options={{ headerShown: false }} />
        <Stack.Screen name="group/create" options={{ headerShown: false }} />
        <Stack.Screen name="group/edit" options={{ headerShown: false }} />
        <Stack.Screen name="group/join" options={{ headerShown: false }} />
        <Stack.Screen name="profile/edit" options={{ headerShown: false }} />
        <Stack.Screen name="sessions" options={{ headerShown: false }} />
        <Stack.Screen name="teacher-verification" options={{ headerShown: false }} />
        <Stack.Screen name="test/index" options={{ headerShown: false }} />
        <Stack.Screen name="test/create" options={{ headerShown: false }} />
        <Stack.Screen name="test/[id]/index" options={{ headerShown: false }} />
        <Stack.Screen name="test/[id]/edit" options={{ headerShown: false }} />
        <Stack.Screen name="test/question" options={{ headerShown: false }} />
        <Stack.Screen name="ads/create" options={{ headerShown: false }} />
        <Stack.Screen name="ads/index" options={{ headerShown: false }} />
        <Stack.Screen name="ads/[id]/edit" options={{ headerShown: false }} />
        <Stack.Screen name="ai-feedback/[responseId]" options={{ headerShown: false }} />
        <Stack.Screen name="streak/index" options={{ headerShown: false }} />
        <Stack.Screen name="leaderboard/index" options={{ headerShown: false }} />
        <Stack.Screen name="admin/courses/create" options={{ headerShown: false }} />
        <Stack.Screen name="admin/courses/[id]/index" options={{ headerShown: false }} />
        <Stack.Screen name="admin/courses/[id]/edit" options={{ headerShown: false }} />
        <Stack.Screen name="admin/courses/lessons/[id]/index" options={{ headerShown: false }} />
      </Stack>
      {needsRedirect && <Redirect href={redirectTarget as any} />}
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ToastProvider>
        <CustomAlertProvider>
          <RootNavigator />
        </CustomAlertProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
