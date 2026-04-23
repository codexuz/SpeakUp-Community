import { useAlert } from '@/components/CustomAlert';
import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import { useCachedFetch } from '@/hooks/useCachedFetch';
import { useDeleteAccount } from '@/hooks/useDeleteAccount';
import { apiGetUserProfile, apiLogout } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { useTelegram } from '@/store/telegram';
import * as Linking from 'expo-linking';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight, Edit2, LogOut, MapPin, Monitor, Phone, Send, Shield, Trash2, User as UserIcon } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { alert } = useAlert();
  const { linked: telegramLinked, deepLink: telegramDeepLink, checkLink: checkTelegramLink } = useTelegram();
  const [stats, setStats] = useState({ followers: 0, following: 0 });
  const [deleteModal, setDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const { deleteAccount, loading: deleteLoading } = useDeleteAccount();

  const { data: profileData } = useCachedFetch<{ stats: { followers: number; following: number } }>({
    cacheKey: `admin_profile_${user?.id}`,
    apiFn: () => apiGetUserProfile(user!.id),
    enabled: !!user?.id,
    deps: [user?.id],
    staleTime: 60_000,
  });

  useEffect(() => {
    if (profileData?.stats) setStats(profileData.stats);
  }, [profileData]);

  useFocusEffect(
    useCallback(() => {
      checkTelegramLink();
    }, [checkTelegramLink]),
  );

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


  const handleConfirmDelete = async () => {
    try {
      await deleteAccount(deletePassword.trim());
    } catch (e: any) {
      toast.error('Error', e.message);
    }
  };


  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity onPress={() => router.push('/profile/edit' as any)} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Edit2 size={18} color={TG.textWhite} />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1, backgroundColor: TG.bgSecondary }} contentContainerStyle={{ paddingBottom: 40 }}>
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

        <View style={styles.statsRow}>
          <TouchableOpacity
            style={styles.statCard}
            activeOpacity={0.7}
            onPress={() => router.push(`/followers/${user?.id}` as any)}
          >
            <Text style={styles.statNum}>{stats.followers}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.statCard}
            activeOpacity={0.7}
            onPress={() => router.push(`/followings/${user?.id}` as any)}
          >
            <Text style={styles.statNum}>{stats.following}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </TouchableOpacity>
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
          <View style={styles.infoRow}>
            <Phone size={18} color={TG.textSecondary} />
            <Text style={styles.infoLabel}>Phone</Text>
            <Text style={styles.infoValue}>{user?.phone || 'Not set'}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <TouchableOpacity
          style={styles.menuRow}
          activeOpacity={0.7}
          onPress={() => {
            if (!telegramLinked && telegramDeepLink) {
              Linking.openURL(telegramDeepLink);
            }
          }}
        >
          <Send size={18} color={telegramLinked ? TG.green : TG.accent} />
          <Text style={[styles.menuText, { color: telegramLinked ? TG.green : TG.textPrimary }]}>
            {telegramLinked ? 'Telegram Connected' : 'Connect Telegram'}
          </Text>
          {!telegramLinked && <ChevronRight size={18} color={TG.textHint} style={{ marginLeft: 'auto' }} />}
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuRow} activeOpacity={0.7} onPress={() => router.push('/sessions' as any)}>
          <Monitor size={18} color={TG.textSecondary} />
          <Text style={styles.menuText}>Active Sessions</Text>
          <ChevronRight size={18} color={TG.textHint} style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>

        {user?.role === 'admin' && (
          <TouchableOpacity style={styles.menuRow} activeOpacity={0.7} onPress={() => router.push('/teacher-verification' as any)}>
            <Shield size={18} color={TG.accent} />
            <Text style={[styles.menuText, { color: TG.accent }]}>Teacher Verification Requests</Text>
            <ChevronRight size={18} color={TG.textHint} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
        )}

        <View style={{ height: 24 }} />

        <TouchableOpacity style={styles.logoutRow} onPress={handleLogout} activeOpacity={0.7}>
          <LogOut size={18} color={TG.red} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteRow} onPress={() => setDeleteModal(true)} activeOpacity={0.7}>
          <Trash2 size={18} color={TG.red} />
          <Text style={styles.deleteText}>Delete Account</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Delete Account Modal */}
      <Modal visible={deleteModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Delete Account</Text>
              <Text style={{ color: TG.textSecondary, fontSize: 14, marginBottom: 16 }}>
                This will permanently delete your account and all your data. This cannot be undone. Enter your password to confirm.
              </Text>
              <TextInput
                style={styles.modalInput}
                value={deletePassword}
                onChangeText={setDeletePassword}
                placeholder="Enter your password"
                placeholderTextColor={TG.textHint}
                secureTextEntry
                autoCapitalize="none"
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  activeOpacity={0.7}
                  onPress={() => { setDeleteModal(false); setDeletePassword(''); }}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitBtn, (deleteLoading || !deletePassword.trim()) && { opacity: 0.5 }]}
                  activeOpacity={0.7}
                  onPress={handleConfirmDelete}
                  disabled={deleteLoading || !deletePassword.trim()}
                >
                  {deleteLoading ? (
                    <ActivityIndicator size="small" color={TG.textWhite} />
                  ) : (
                    <Text style={styles.submitBtnText}>Delete Account</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TG.headerBg },
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

  statsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: TG.bg,
  },
  statCard: {
    flex: 1,
    backgroundColor: TG.bgSecondary,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  statNum: { fontSize: 18, fontWeight: '700', color: TG.textPrimary },
  statLabel: { fontSize: 12, color: TG.textSecondary, marginTop: 2 },

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
    borderBottomWidth: 0.5,
    borderBottomColor: TG.separatorLight,
  },
  logoutText: { fontSize: 15, color: TG.red, fontWeight: '500' },
  deleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: TG.bg,
    gap: 12,
  },
  deleteText: { fontSize: 15, color: TG.red, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.17)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: TG.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: TG.textPrimary, marginBottom: 20 },
  modalInput: {
    backgroundColor: TG.bgSecondary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: TG.textPrimary,
    borderWidth: 0.5,
    borderColor: TG.separator,
    marginBottom: 16,
  },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: TG.bgSecondary,
  },
  cancelBtnText: { color: TG.textSecondary, fontWeight: '600' },
  submitBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: TG.red,
  },
  submitBtnText: { color: TG.textWhite, fontWeight: '600' },
});