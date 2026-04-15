import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import { createGroup, updateGroup } from '@/lib/groups';
import { useAuth } from '@/store/auth';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Globe, Users } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CreateGroupScreen() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ editId?: string; name?: string; description?: string }>();

  const isEditing = !!params.editId;
  const canCreateGlobal = user?.role === 'admin' || (user?.role === 'teacher' && user?.verifiedTeacher);
  const [name, setName] = useState(params.name || '');
  const [description, setDescription] = useState(params.description || '');
  const [isGlobal, setIsGlobal] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Error', 'Group name is required');
      return;
    }
    setLoading(true);
    try {
      if (isEditing) {
        await updateGroup(params.editId!, name.trim(), description.trim());
      } else {
        await createGroup(name.trim(), description.trim(), canCreateGlobal && isGlobal ? true : undefined);
      }
      router.back();
    } catch (e: any) {
      toast.error('Error', e.message);
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

          {canCreateGlobal && !isEditing && (
            <View style={styles.globalRow}>
              <View style={styles.globalLabel}>
                <Globe size={18} color={TG.accent} />
                <View>
                  <Text style={styles.globalTitle}>Global Group</Text>
                  <Text style={styles.globalSubtitle}>Visible to all users, anyone can join</Text>
                </View>
              </View>
              <Switch
                value={isGlobal}
                onValueChange={setIsGlobal}
                trackColor={{ false: TG.separator, true: TG.accentLight }}
                thumbColor={isGlobal ? TG.accent : TG.textHint}
              />
            </View>
          )}

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

  globalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: TG.bgSecondary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 20,
    borderWidth: 0.5,
    borderColor: TG.separator,
  },
  globalLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  globalTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: TG.textPrimary,
  },
  globalSubtitle: {
    fontSize: 12,
    color: TG.textSecondary,
    marginTop: 2,
  },

  submitBtn: {
    backgroundColor: TG.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnText: { color: TG.textWhite, fontSize: 16, fontWeight: '700' },
});
