import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import { apiUpdateProfile, apiUploadUserAvatar } from '@/lib/api';
import { useAuth } from '@/store/auth';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { ArrowLeft, Camera, User as UserIcon } from 'lucide-react-native';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function EditProfileScreen() {
  const router = useRouter();
  const toast = useToast();
  const { user, updateUser } = useAuth();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [gender, setGender] = useState(user?.gender || '');
  const [region, setRegion] = useState(user?.region || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

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
      setAvatarUrl(updated.avatarUrl);
      updateUser({ avatarUrl: updated.avatarUrl });
      toast.success('Done', 'Avatar updated');
    } catch (e: any) {
      toast.error('Error', e.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      toast.warning('Required', 'Full name is required');
      return;
    }
    setSaving(true);
    try {
      const updated = await apiUpdateProfile({
        fullName: fullName.trim() || undefined,
        gender: gender.trim() || undefined,
        region: region.trim() || undefined,
      });
      updateUser({
        fullName: updated.fullName,
        gender: updated.gender,
        region: updated.region,
      });
      toast.success('Done', 'Profile updated');
      router.back();
    } catch (e: any) {
      toast.error('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={22} color={TG.textWhite} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Avatar */}
          <TouchableOpacity
            style={styles.avatarWrap}
            activeOpacity={0.75}
            onPress={handlePickAvatar}
            disabled={uploadingAvatar}
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarFallback}>
                <UserIcon size={40} color={TG.accent} strokeWidth={1.5} />
              </View>
            )}
            <View style={styles.cameraBadge}>
              {uploadingAvatar ? (
                <ActivityIndicator size={14} color={TG.textWhite} />
              ) : (
                <Camera size={14} color={TG.textWhite} />
              )}
            </View>
          </TouchableOpacity>
          <Text style={styles.avatarHint}>Tap to change photo</Text>

          {/* Full Name */}
          <Text style={styles.inputLabel}>Full Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Your full name"
            placeholderTextColor={TG.textHint}
            value={fullName}
            onChangeText={setFullName}
            maxLength={50}
          />

          {/* Gender */}
          <Text style={styles.inputLabel}>Gender</Text>
          <View style={styles.genderRow}>
            {['Male', 'Female'].map((g) => (
              <TouchableOpacity
                key={g}
                style={[styles.genderChip, gender === g && styles.genderChipActive]}
                onPress={() => setGender(g)}
                activeOpacity={0.7}
              >
                <Text style={[styles.genderChipText, gender === g && styles.genderChipTextActive]}>{g}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Region */}
          <Text style={styles.inputLabel}>Region</Text>
          <TextInput
            style={styles.input}
            placeholder="Your region"
            placeholderTextColor={TG.textHint}
            value={region}
            onChangeText={setRegion}
            maxLength={50}
          />

          {/* Save */}
          <TouchableOpacity
            style={[styles.saveBtn, (!fullName.trim() || saving) && { opacity: 0.5 }]}
            activeOpacity={0.7}
            onPress={handleSave}
            disabled={!fullName.trim() || saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={TG.textWhite} />
            ) : (
              <Text style={styles.saveBtnText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TG.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TG.headerBg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: TG.textWhite },

  content: { padding: 24, paddingBottom: 60 },

  avatarWrap: {
    alignSelf: 'center',
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: 8,
    position: 'relative',
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: TG.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: TG.accent,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: TG.bg,
  },
  avatarHint: {
    textAlign: 'center',
    fontSize: 13,
    color: TG.textHint,
    marginBottom: 28,
  },

  inputLabel: {
    fontSize: 14,
    color: TG.textSecondary,
    fontWeight: '600',
    marginBottom: 6,
    marginLeft: 4,
  },
  input: {
    backgroundColor: TG.bgSecondary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: TG.textPrimary,
    borderWidth: 0.5,
    borderColor: TG.separator,
    marginBottom: 20,
  },

  genderRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  genderChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: TG.bgSecondary,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: TG.separator,
  },
  genderChipActive: { backgroundColor: TG.accentLight, borderColor: TG.accent, borderWidth: 1.5 },
  genderChipText: { fontSize: 15, fontWeight: '600', color: TG.textSecondary },
  genderChipTextActive: { color: TG.accent },

  saveBtn: {
    backgroundColor: TG.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: { color: TG.textWhite, fontSize: 16, fontWeight: '700' },
});
