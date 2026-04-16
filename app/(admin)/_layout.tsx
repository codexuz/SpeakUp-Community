import { TG } from '@/constants/theme';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { BookOpen, ClipboardList, Home, Image, Shield, User, Users } from 'lucide-react-native';
import React from 'react';
import { Platform } from 'react-native';

export default function AdminTabLayout() {
  return (
    <>
      <StatusBar style="light" backgroundColor={TG.headerBg} />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: TG.tabActive,
          tabBarInactiveTintColor: TG.tabInactive,
          tabBarShowLabel: true,
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '600',
            marginTop: -2,
          },
          headerShown: false,
          tabBarStyle: {
            backgroundColor: TG.tabBg,
            borderTopWidth: 0.5,
            borderTopColor: TG.separator,
            height: Platform.OS === 'ios' ? 84 : 60,
            paddingBottom: Platform.OS === 'ios' ? 24 : 8,
            paddingTop: 6,
            elevation: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.06,
            shadowRadius: 4,
          },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => <Home size={size ?? 24} color={color} strokeWidth={1.8} />,
          }}
        />
        <Tabs.Screen
          name="verification"
          options={{
            title: 'Verify',
            tabBarIcon: ({ color, size }) => <Shield size={size ?? 24} color={color} strokeWidth={1.8} />,
          }}
        />
        <Tabs.Screen
          name="tests"
          options={{
            title: 'Tests',
            tabBarIcon: ({ color, size }) => <ClipboardList size={size ?? 24} color={color} strokeWidth={1.8} />,
          }}
        />
        <Tabs.Screen
          name="groups"
          options={{
            title: 'Groups',
            tabBarIcon: ({ color, size }) => <Users size={size ?? 24} color={color} strokeWidth={1.8} />,
          }}
        />
        <Tabs.Screen
          name="courses"
          options={{
            title: 'Courses',
            tabBarIcon: ({ color, size }) => <BookOpen size={size ?? 24} color={color} strokeWidth={1.8} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => <User size={size ?? 24} color={color} strokeWidth={1.8} />,
          }}
        />
      </Tabs>
    </>
  );
}
