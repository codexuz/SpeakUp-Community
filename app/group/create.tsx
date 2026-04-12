import { createGroup, updateGroup } from '@/lib/groups';
import { useAuth } from '@/store/auth';
import { LinearGradient } from 'expo-linear-gradient';
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

export default function CreateGroupScreen() {
  const router = useRouter();
  const { user } = useAuth();
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
        await createGroup(name.trim(), description.trim(), user!.id);
      }
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0f172a', '#1e293b']} style={StyleSheet.absoluteFillObject} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEditing ? 'Edit Group' : 'Create Group'}</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.iconBox}>
            <Users size={40} color="#8b5cf6" strokeWidth={1.5} />
          </View>

          <Text style={styles.inputLabel}>GROUP NAME</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. IELTS Prep Class A"
            placeholderTextColor="#475569"
            value={name}
            onChangeText={setName}
            autoFocus
            maxLength={50}
          />

          <Text style={styles.inputLabel}>DESCRIPTION (OPTIONAL)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="What is this group about?"
            placeholderTextColor="#475569"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            maxLength={200}
          />

          <TouchableOpacity
            style={[styles.submitBtn, (!name.trim() || loading) && { opacity: 0.5 }]}
            activeOpacity={0.8}
            onPress={handleSubmit}
            disabled={!name.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>{isEditing ? 'SAVE CHANGES' : 'CREATE GROUP'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
    gap: 12,
  },
  backBtn: { padding: 8, backgroundColor: '#1e293b', borderRadius: 12, borderWidth: 2, borderColor: '#334155' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },

  content: { padding: 24 },
  iconBox: {
    alignSelf: 'center',
    marginBottom: 32,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    borderBottomWidth: 5,
  },

  inputLabel: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 16,
    color: '#fff',
    borderWidth: 2,
    borderColor: '#334155',
    marginBottom: 20,
    fontWeight: '600',
  },
  textArea: { minHeight: 80 },

  submitBtn: {
    backgroundColor: '#8b5cf6',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    borderBottomWidth: 4,
    borderColor: '#7c3aed',
    marginTop: 12,
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 1 },
});
