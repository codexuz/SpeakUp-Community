import { useAlert } from '@/components/CustomAlert';
import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import { apiDeleteQuestion, apiDeleteTest, apiFetchTests, apiUpdateTest } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Edit2, MessageSquare, Plus, Trash2 } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
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

interface Question {
  id: number;
  testId: number;
  qText: string;
  part: string;
  image: string | null;
  speakingTimer: number;
  prepTimer: number;
}

interface Test {
  id: number;
  title: string;
  description: string | null;
  questions: Question[];
}

export default function TestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { alert } = useAlert();
  const [test, setTest] = useState<Test | null>(null);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const isAllowed = user?.role === 'admin' || (user?.role === 'teacher' && user?.verifiedTeacher);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const tests = await apiFetchTests();
      const found = tests.find((t: any) => String(t.id) === id);
      if (found) {
        const normalized: Test = {
          id: found.id,
          title: found.title,
          description: found.description,
          questions: (found.questions || []).map((q: any) => ({
            id: q.id,
            testId: q.testId ?? q.test_id,
            qText: q.qText ?? q.q_text,
            part: q.part,
            image: q.image,
            speakingTimer: q.speakingTimer ?? q.speaking_timer ?? 30,
            prepTimer: q.prepTimer ?? q.prep_timer ?? 5,
          })),
        };
        setTest(normalized);
      }
    } catch (e: any) {
      toast.error('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const openEditModal = () => {
    if (!test) return;
    setEditTitle(test.title);
    setEditDesc(test.description || '');
    setEditModal(true);
  };

  const handleSave = async () => {
    if (!editTitle.trim()) {
      toast.warning('Validation', 'Title is required');
      return;
    }
    setSaving(true);
    try {
      const updated = await apiUpdateTest(test!.id, {
        title: editTitle.trim(),
        description: editDesc.trim() || undefined,
      });
      setTest((prev) => prev ? { ...prev, title: updated.title, description: updated.description } : prev);
      setEditModal(false);
    } catch (e: any) {
      toast.error('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTest = () => {
    alert('Delete Test', 'Delete this test and all its questions?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiDeleteTest(test!.id);
            router.back();
          } catch (e: any) {
            toast.error('Error', e.message);
          }
        },
      },
    ], 'destructive');
  };

  const handleDeleteQuestion = (q: Question) => {
    alert('Delete Question', `Delete this question?\n\n"${q.qText}"`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiDeleteQuestion(q.id);
            setTest((prev) =>
              prev ? { ...prev, questions: prev.questions.filter((x) => x.id !== q.id) } : prev,
            );
          } catch (e: any) {
            toast.error('Error', e.message);
          }
        },
      },
    ], 'destructive');
  };

  const partColor = (part: string) => {
    if (part.includes('1')) return TG.accent;
    if (part.includes('2')) return TG.green;
    if (part.includes('3')) return TG.purple;
    return TG.orange;
  };

  if (!isAllowed) {
    return (
      <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: TG.textSecondary, fontSize: 16 }}>Verified teacher access required</Text>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <ArrowLeft size={22} color={TG.textWhite} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Test</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={TG.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!test) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <ArrowLeft size={22} color={TG.textWhite} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Test</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.centered}>
          <Text style={{ color: TG.textSecondary }}>Test not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <ArrowLeft size={22} color={TG.textWhite} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{test.title}</Text>
        <TouchableOpacity onPress={openEditModal} activeOpacity={0.7}>
          <Edit2 size={18} color={TG.textWhite} />
        </TouchableOpacity>
      </View>

      {/* Test info banner */}
      <View style={styles.infoBanner}>
        <View style={{ flex: 1 }}>
          {test.description ? (
            <Text style={styles.infoDesc}>{test.description}</Text>
          ) : (
            <Text style={[styles.infoDesc, { fontStyle: 'italic' }]}>No description</Text>
          )}
          <Text style={styles.infoSub}>{test.questions.length} questions</Text>
        </View>
        <TouchableOpacity onPress={handleDeleteTest} activeOpacity={0.7}>
          <Trash2 size={18} color={TG.red} />
        </TouchableOpacity>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Questions</Text>
        <TouchableOpacity
          style={styles.addBtn}
          activeOpacity={0.7}
          onPress={() =>
            router.push({ pathname: '/test/question', params: { testId: String(test.id) } } as any)
          }
        >
          <Plus size={16} color={TG.textWhite} />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={test.questions}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={styles.qCard}
            activeOpacity={0.7}
            onPress={() =>
              router.push({
                pathname: '/test/question',
                params: { testId: String(test.id), questionId: String(item.id) },
              } as any)
            }
          >
            <View style={[styles.qNumber, { backgroundColor: partColor(item.part) + '18' }]}>
              <Text style={[styles.qNumberText, { color: partColor(item.part) }]}>{index + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.qText} numberOfLines={2}>{item.qText}</Text>
              <View style={styles.qMeta}>
                <View style={[styles.partChip, { backgroundColor: partColor(item.part) + '18' }]}>
                  <Text style={[styles.partChipText, { color: partColor(item.part) }]}>{item.part}</Text>
                </View>
                <Text style={styles.qTimer}>
                  Prep {item.prepTimer}s • Speaking {item.speakingTimer}s
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => handleDeleteQuestion(item)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
            >
              <Trash2 size={16} color={TG.red} />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.centered}>
            <MessageSquare size={36} color={TG.separator} />
            <Text style={styles.emptyText}>No questions yet</Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              activeOpacity={0.7}
              onPress={() =>
                router.push({ pathname: '/test/question', params: { testId: String(test.id) } } as any)
              }
            >
              <Text style={styles.emptyBtnText}>Add First Question</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Edit Test Modal */}
      <Modal visible={editModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Test</Text>

            <Text style={styles.inputLabel}>Title *</Text>
            <TextInput
              style={styles.input}
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="Test title"
              placeholderTextColor={TG.textHint}
            />

            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              value={editDesc}
              onChangeText={setEditDesc}
              placeholder="Optional description..."
              placeholderTextColor={TG.textHint}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} activeOpacity={0.7} onPress={() => setEditModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, saving && { opacity: 0.5 }]}
                activeOpacity={0.7}
                onPress={handleSave}
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
    gap: 14,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: TG.textWhite, flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingTop: 60 },

  infoBanner: {
    backgroundColor: TG.bg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: TG.separator,
  },
  infoDesc: { fontSize: 14, color: TG.textSecondary, marginBottom: 4 },
  infoSub: { fontSize: 12, color: TG.textHint },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: TG.textPrimary },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TG.accent,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    gap: 6,
  },
  addBtnText: { color: TG.textWhite, fontSize: 13, fontWeight: '600' },

  qCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TG.bg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: TG.separatorLight,
    gap: 12,
  },
  qNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qNumberText: { fontSize: 15, fontWeight: '700' },
  qText: { fontSize: 14, color: TG.textPrimary, marginBottom: 6, lineHeight: 20 },
  qMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  partChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  partChipText: { fontSize: 11, fontWeight: '700' },
  qTimer: { fontSize: 11, color: TG.textHint },

  emptyText: { color: TG.textSecondary, fontSize: 15 },
  emptyBtn: {
    backgroundColor: TG.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
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
