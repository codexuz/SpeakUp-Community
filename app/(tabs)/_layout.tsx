import { useSyncManager } from '@/lib/sync';
import { useAuth } from '@/store/auth';
import { Tabs } from 'expo-router';
import { Globe, Home, List, User, Users } from 'lucide-react-native';
import React from 'react';
import { Platform } from 'react-native';

export default function TabLayout() {
  const { user } = useAuth();

  useSyncManager();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#64748b',
        tabBarShowLabel: false,
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0f172a',
          borderTopWidth: 2,
          borderTopColor: '#1e293b',
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingBottom: Platform.OS === 'ios' ? 28 : 12,
          paddingTop: 12,
          // elevation 0 for android to remove stock shadow, so it matches iOS flat
          elevation: 0,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color }) => <Home size={28} color={color} strokeWidth={2.5} />,
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          tabBarIcon: ({ color }) => <Users size={28} color={color} strokeWidth={2.5} />,
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          tabBarIcon: ({ color }) => <Globe size={28} color={color} strokeWidth={2.5} />,
        }}
      />
      <Tabs.Screen
        name="responses"
        options={{
          tabBarIcon: ({ color }) => <List size={28} color={color} strokeWidth={2.5} />
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color }) => <User size={28} color={color} strokeWidth={2.5} />,
        }}
      />
    </Tabs>
  );
}
