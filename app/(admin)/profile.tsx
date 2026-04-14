import { useAlert } from '@/components/CustomAlert';
import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import { apiLogout, apiUpdateProfile, apiUploadUserAvatar } from '@/lib/api';
import { useAuth } from '@/store/auth';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Camera, ChevronRight, Edit2, LogOut, MapPin, Monitor, Shield, User as UserIcon } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const { user, logout, updateUser } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { alert } = useAlert();
  const [editModal, setEditModal] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editGender, setEditGender] = useState('');
  const [editRegion, setEditRegion] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const openEditModal = () => {
    setEditFullName(user?.fullName || '');
    setEditGender(user?.gender || '');
    setEditRegion(user?.region || '');
    setEditModal(true);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const updated = await apiUpdateProfile({
        fullName: editFullName.trim() || undefined,
        gender: editGender.trim() || undefined,
        region: editRegion.trim() || undefined,
      });
      updateUser({
        fullName: updated.fullName,
        gender: updated.gender,
        region: updated.region,
      });
      setEditModal(false);
    } catch (e: any) {
      toast.error('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]?.uri) return;

    setUploadingAvatar(true);
    try {
      const updated = await apiUploadUserAvatar(result.assets[0].uri);
      updateUser({ avatarUrl: updated.avatarUrl });
    } catch (e: any) {
      toast.error('Error', e.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

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
        <TouchableOpacity onPress={openEditModal} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Edit2 size={18} color={TG.textWhite} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.profileSection}>
          <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.8} disabled={uploadingAvatar}>
            <Image
              source={{ uri: user?.avatarUrl || 'https://i.ibb.co/68vS1zZ/default-avatar.png' }}
              style={styles.avatar}
            />
            <View style={styles.cameraBadge}>
              {uploadingAvatar ? (
                <ActivityIndicator size={12} color={TG.textWhite} />
              ) : (
                <Camera size={14} color={TG.textWhite} />
              )}
            </View>
          </TouchableOpacity>
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
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={editModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Profile</Text>

            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={styles.modalInput}
              value={editFullName}
              onChangeText={setEditFullName}
              placeholder="Full Name"
              placeholderTextColor={TG.textHint}
            />

            <Text style={styles.inputLabel}>Gender</Text>
            <View style={styles.genderRow}>
              {['Male', 'Female'].map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.genderChip, editGender === g && styles.genderChipActive]}
                  onPress={() => setEditGender(g)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.genderChipText, editGender === g && styles.genderChipTextActive]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Region</Text>
            <TextInput
              style={styles.modalInput}
              value={editRegion}
              onChangeText={setEditRegion}
              placeholder="Region"
              placeholderTextColor={TG.textHint}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} activeOpacity={0.7} onPress={() => setEditModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, saving && { opacity: 0.5 }]}
                activeOpacity={0.7}
                onPress={handleSaveProfile}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={TG.textWhite} />
                ) : (
                  <Text style={styles.submitBtnText}>Save</Text>
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
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: TG.accent,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: TG.bg,
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

  // Edit Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.17)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: TG.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: TG.textPrimary, marginBottom: 20 },
  inputLabel: { fontSize: 13, color: TG.textSecondary, fontWeight: '600', marginBottom: 6 },
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
  genderRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  genderChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: TG.bgSecondary,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: TG.separator,
  },
  genderChipActive: { backgroundColor: TG.accentLight, borderColor: TG.accent, borderWidth: 1.5 },
  genderChipText: { fontSize: 15, fontWeight: '600', color: TG.textSecondary },
  genderChipTextActive: { color: TG.accent },
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
    backgroundColor: TG.accent,
  },
  submitBtnText: { color: TG.textWhite, fontWeight: '600' },
});