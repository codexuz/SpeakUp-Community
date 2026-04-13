import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Redirect, Stack, useSegments } from 'expo-router';
import { ActivityIndicator, StatusBar, View } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
// import { useInAppUpdates } from '@/hooks/useInAppUpdates';
// import { useNotifications } from '@/hooks/useNotifications';
import { CustomAlertProvider } from '@/components/CustomAlert';
import { ToastProvider } from '@/components/Toast';
import { TG } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/store/auth';

function getRoleRoute(role?: string): '/(student)' | '/(teacher)' | '/(admin)' {
  if (role === 'admin') return '/(admin)';
  if (role === 'teacher') return '/(teacher)';
  return '/(student)';
}

function RootNavigator() {
  const colorScheme = useColorScheme();
  const { isAuthenticated, isLoading, user } = useAuth();
  const segments = useSegments();

  // useNotifications();
  // useInAppUpdates();

  const inAuthGroup = segments[0] === '(auth)';
  const seg = segments[0] as string;
  const inRoleGroup = seg === '(student)' || seg === '(teacher)' || seg === '(admin)';

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' }}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <StatusBar barStyle="light-content" backgroundColor={TG.headerBg} />
      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(student)" options={{ headerShown: false }} />
        <Stack.Screen name="(teacher)" options={{ headerShown: false }} />
        <Stack.Screen name="(admin)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="speaking/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="session/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="review/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="community/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="group/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="group/create" options={{ headerShown: false }} />
        <Stack.Screen name="group/join" options={{ headerShown: false }} />
        <Stack.Screen name="sessions" options={{ headerShown: false }} />
        <Stack.Screen name="teacher-verification" options={{ headerShown: false }} />
        <Stack.Screen name="test/index" options={{ headerShown: false }} />
        <Stack.Screen name="test/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="test/question" options={{ headerShown: false }} />
      </Stack>
      {!isAuthenticated && !inAuthGroup && <Redirect href="/(auth)/login" />}
      {isAuthenticated && inAuthGroup && <Redirect href={getRoleRoute(user?.role ?? undefined) as any} />}
      {isAuthenticated && !inAuthGroup && inRoleGroup && seg !== getRoleRoute(user?.role ?? undefined).slice(1) && (
        <Redirect href={getRoleRoute(user?.role ?? undefined) as any} />
      )}
      {isAuthenticated && !inAuthGroup && !inRoleGroup && seg === '(tabs)' && (
        <Redirect href={getRoleRoute(user?.role ?? undefined) as any} />
      )}
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
