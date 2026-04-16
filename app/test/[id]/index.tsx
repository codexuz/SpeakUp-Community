import { useAlert } from '@/components/CustomAlert';
import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import { apiDeleteQuestion, apiFetchTests } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Edit2, MessageSquare, Plus, Trash2 } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
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

  const isAllowed = user?.role === 'admin' || (user?.role === 'teacher' && user?.verifiedTeacher);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetchTests({ limit: 100 });
      const found = (res.data || []).find((t: any) => String(t.id) === id);
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

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

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
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/test/[id]/edit', params: { id: String(test.id) } } as any)}
          activeOpacity={0.7}
        >
          <Edit2 size={18} color={TG.textWhite} />
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
        style={{ flex: 1, backgroundColor: TG.bgSecondary }}
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingTop: 60, backgroundColor: TG.bgSecondary },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: TG.textWhite },
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
});
