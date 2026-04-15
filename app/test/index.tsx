import { useAlert } from '@/components/CustomAlert';
import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import { apiCreateTest, apiDeleteTest, apiFetchTests } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { ArrowLeft, BookOpen, ChevronRight, Plus, Trash2 } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Test {
  id: number;
  title: string;
  description: string | null;
  questions?: any[];
}

export default function TestManagementScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { alert } = useAlert();
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModal, setCreateModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const isAllowed = user?.role === 'admin' || (user?.role === 'teacher' && user?.verifiedTeacher);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetchTests();
      setTests(data || []);
    } catch (e: any) {
      toast.error('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.warning('Validation', 'Title is required');
      return;
    }
    setCreating(true);
    try {
      await apiCreateTest({ title: title.trim(), description: description.trim() || undefined });
      setCreateModal(false);
      setTitle('');
      setDescription('');
      load();
    } catch (e: any) {
      toast.error('Error', e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = (test: Test) => {
    alert(
      'Delete Test',
      `Delete "${test.title}"? This will also delete all its questions and responses.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiDeleteTest(test.id);
              setTests((prev) => prev.filter((t) => t.id !== test.id));
            } catch (e: any) {
              toast.error('Error', e.message);
            }
          },
        },
      ],
      'destructive',
    );
  };

  if (!isAllowed) {
    return (
      <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: TG.textSecondary, fontSize: 16 }}>Verified teacher access required</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <ArrowLeft size={22} color={TG.textWhite} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Tests</Text>
        <TouchableOpacity onPress={() => setCreateModal(true)} activeOpacity={0.7}>
          <Plus size={22} color={TG.textWhite} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={TG.accent} />
        </View>
      ) : (
        <FlatList
          style={{ flex: 1, backgroundColor: TG.bgSecondary }}
          data={tests}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.7}
              onPress={() => router.push({ pathname: '/test/[id]', params: { id: String(item.id) } } as any)}
            >
              <View style={styles.testIcon}>
                <BookOpen size={20} color={TG.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.testTitle}>{item.title}</Text>
                {item.description ? (
                  <Text style={styles.testDesc} numberOfLines={1}>{item.description}</Text>
                ) : null}
                <Text style={styles.testSub}>{item.questions?.length ?? 0} questions</Text>
              </View>
              <TouchableOpacity
                onPress={() => handleDelete(item)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.7}
              >
                <Trash2 size={18} color={TG.red} />
              </TouchableOpacity>
              <ChevronRight size={18} color={TG.textHint} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.centered}>
              <BookOpen size={40} color={TG.separator} />
              <Text style={styles.emptyText}>No tests yet</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => setCreateModal(true)} activeOpacity={0.7}>
                <Text style={styles.emptyBtnText}>Create First Test</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Create Test Modal */}
      <Modal visible={createModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Test</Text>

            <Text style={styles.inputLabel}>Title *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. IELTS Speaking Part 1"
              placeholderTextColor={TG.textHint}
            />

            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Optional description..."
              placeholderTextColor={TG.textHint}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                activeOpacity={0.7}
                onPress={() => {
                  setCreateModal(false);
                  setTitle('');
                  setDescription('');
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, creating && { opacity: 0.5 }]}
                activeOpacity={0.7}
                onPress={handleCreate}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator size="small" color={TG.textWhite} />
                ) : (
                  <Text style={styles.submitBtnText}>Create</Text>
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
    gap: 14,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: TG.textWhite, flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingTop: 80, backgroundColor: TG.bgSecondary },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TG.bg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: TG.separatorLight,
    gap: 12,
  },
  testIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: TG.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  testTitle: { fontSize: 15, fontWeight: '600', color: TG.textPrimary, marginBottom: 2 },
  testDesc: { fontSize: 13, color: TG.textSecondary, marginBottom: 2 },
  testSub: { fontSize: 12, color: TG.textHint },

  emptyText: { color: TG.textSecondary, fontSize: 15, marginTop: 8 },
  emptyBtn: {
    backgroundColor: TG.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 12,
  },
  emptyBtnText: { color: TG.textWhite, fontWeight: '600', fontSize: 14 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: TG.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: TG.textPrimary, marginBottom: 20 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: TG.textSecondary, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: TG.bgSecondary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: TG.textPrimary,
    borderWidth: 0.5,
    borderColor: TG.separator,
  },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: TG.bgSecondary,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: TG.textSecondary },
  submitBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: TG.accent,
    alignItems: 'center',
  },
  submitBtnText: { fontSize: 15, fontWeight: '600', color: TG.textWhite },
});
