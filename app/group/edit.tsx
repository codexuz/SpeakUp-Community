import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import { fetchGroupById, updateGroup, uploadGroupAvatar } from '@/lib/groups';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Camera, Users } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
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

export default function EditGroupScreen() {
  const router = useRouter();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const g = await fetchGroupById(id);
        if (g) {
          setName(g.name);
          setDescription(g.description || '');
          setAvatarUrl(g.avatarUrl || null);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;

    setUploadingAvatar(true);
    try {
      const updated = await uploadGroupAvatar(id!, result.assets[0].uri);
      setAvatarUrl(updated.avatarUrl);
      toast.success('Done', 'Group image updated');
    } catch (e: any) {
      toast.error('Error', e.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.warning('Required', 'Group name is required');
      return;
    }
    setSaving(true);
    try {
      await updateGroup(id!, name.trim(), description.trim());
      toast.success('Done', 'Group updated');
      router.back();
    } catch (e: any) {
      toast.error('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center', backgroundColor: TG.bg }]}>
        <ActivityIndicator size="large" color={TG.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={22} color={TG.textWhite} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Group</Text>
        </View>

        <ScrollView style={{ flex: 1, backgroundColor: TG.bg }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
                <Users size={40} color={TG.accent} strokeWidth={1.5} />
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

          {/* Name */}
          <Text style={styles.inputLabel}>Group Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. IELTS Prep Class A"
            placeholderTextColor={TG.textHint}
            value={name}
            onChangeText={setName}
            maxLength={50}
          />

          {/* Description */}
          <Text style={styles.inputLabel}>Description (optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="What is this group about?"
            placeholderTextColor={TG.textHint}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            maxLength={200}
          />

          {/* Save */}
          <TouchableOpacity
            style={[styles.saveBtn, (!name.trim() || saving) && { opacity: 0.5 }]}
            activeOpacity={0.7}
            onPress={handleSave}
            disabled={!name.trim() || saving}
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
  safeArea: { flex: 1, backgroundColor: TG.headerBg },
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
  textArea: { minHeight: 80 },

  saveBtn: {
    backgroundColor: TG.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: { color: TG.textWhite, fontSize: 16, fontWeight: '700' },
});
