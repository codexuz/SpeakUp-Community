import { TG } from '@/constants/theme';
import { createGroup, updateGroup } from '@/lib/groups';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Users } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CreateGroupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ editId?: string; name?: string; description?: string }>();

  const isEditing = !!params.editId;
  const [name, setName] = useState(params.name || '');
  const [description, setDescription] = useState(params.description || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Group name is required');
      return;
    }
    setLoading(true);
    try {
      if (isEditing) {
        await updateGroup(params.editId!, name.trim(), description.trim());
      } else {
        await createGroup(name.trim(), description.trim());
      }
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
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
          <Text style={styles.headerTitle}>{isEditing ? 'Edit Group' : 'New Group'}</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.iconBox}>
            <Users size={36} color={TG.purple} strokeWidth={1.5} />
          </View>

          <Text style={styles.inputLabel}>Group Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. IELTS Prep Class A"
            placeholderTextColor={TG.textHint}
            value={name}
            onChangeText={setName}
            autoFocus
            maxLength={50}
          />

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

          <TouchableOpacity
            style={[styles.submitBtn, (!name.trim() || loading) && { opacity: 0.5 }]}
            activeOpacity={0.7}
            onPress={handleSubmit}
            disabled={!name.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={TG.textWhite} />
            ) : (
              <Text style={styles.submitBtnText}>{isEditing ? 'Save Changes' : 'Create Group'}</Text>
            )}
          </TouchableOpacity>
        </View>
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

  content: { padding: 24 },
  iconBox: {
    alignSelf: 'center',
    marginBottom: 28,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: TG.purpleLight,
    justifyContent: 'center',
    alignItems: 'center',
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

  submitBtn: {
    backgroundColor: TG.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnText: { color: TG.textWhite, fontSize: 16, fontWeight: '700' },
});
