import { useAlert } from '@/components/CustomAlert';
import { TG } from '@/constants/theme';
import { apiLogout } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { useRouter } from 'expo-router';
import { ChevronRight, Edit2, LogOut, MapPin, Monitor, User as UserIcon } from 'lucide-react-native';
import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { alert } = useAlert();

  const handleLogout = async () => {
    alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiLogout();
          } catch {
            // still logout locally even if API fails
          }
          logout();
        },
      },
    ], 'warning');
  };



  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity onPress={() => router.push('/profile/edit' as any)} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Edit2 size={18} color={TG.textWhite} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.profileSection}>
          <Image
            source={{ uri: user?.avatarUrl || 'https://i.ibb.co/68vS1zZ/default-avatar.png' }}
            style={styles.avatar}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user?.fullName}</Text>
            <Text style={styles.username}>@{user?.username}</Text>
          </View>
          <View style={[styles.roleBadge, user?.role === 'teacher' && styles.teacherBadge]}>
            <Text style={[styles.roleText, user?.role === 'teacher' && styles.teacherText]}>{user?.role}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <View style={styles.infoRow}>
            <MapPin size={18} color={TG.textSecondary} />
            <Text style={styles.infoLabel}>Region</Text>
            <Text style={styles.infoValue}>{user?.region || 'Not set'}</Text>
          </View>
          <View style={styles.infoRow}>
            <UserIcon size={18} color={TG.textSecondary} />
            <Text style={styles.infoLabel}>Gender</Text>
            <Text style={styles.infoValue}>{user?.gender || 'Not set'}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.menuRow} activeOpacity={0.7} onPress={() => router.push('/sessions' as any)}>
          <Monitor size={18} color={TG.textSecondary} />
          <Text style={styles.menuText}>Active Sessions</Text>
          <ChevronRight size={18} color={TG.textHint} style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>

        <View style={{ height: 24 }} />

        <TouchableOpacity style={styles.logoutRow} onPress={handleLogout} activeOpacity={0.7}>
          <LogOut size={18} color={TG.red} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TG.bgSecondary },
  header: {
    backgroundColor: TG.headerBg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: TG.textWhite },

  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TG.bg,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: TG.bgSecondary,
  },
  name: { fontSize: 18, fontWeight: '700', color: TG.textPrimary, marginBottom: 2 },
  username: { fontSize: 14, color: TG.textSecondary },
  roleBadge: {
    backgroundColor: TG.accentLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  roleText: { fontSize: 12, fontWeight: '600', color: TG.accent, textTransform: 'capitalize' },
  teacherBadge: { backgroundColor: TG.greenLight },
  teacherText: { color: TG.green },

  divider: { height: 8, backgroundColor: TG.bgSecondary },

  section: { backgroundColor: TG.bg },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: TG.separatorLight,
  },
  infoLabel: { fontSize: 15, color: TG.textPrimary, flex: 1 },
  infoValue: { fontSize: 15, color: TG.textSecondary },

  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: TG.bg,
    gap: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: TG.separatorLight,
  },
  menuText: { fontSize: 15, color: TG.textPrimary },

  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: TG.bg,
    gap: 12,
  },
  logoutText: { fontSize: 15, color: TG.red, fontWeight: '500' },
});