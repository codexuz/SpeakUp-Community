import { useAlert } from '@/components/CustomAlert';
import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import { apiDeleteWritingTask, apiFetchWritingTest } from '@/lib/api';
import type { WritingTask, WritingTest } from '@/lib/types';
import { useAuth } from '@/store/auth';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Clock, Edit2, FileText, Plus, Trash2 } from 'lucide-react-native';
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

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  return `${m} min`;
}

export default function WritingTestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { alert } = useAlert();
  const [test, setTest] = useState<WritingTest | null>(null);
  const [loading, setLoading] = useState(true);

  const isAllowed = user?.role === 'admin' || (user?.role === 'teacher' && user?.verifiedTeacher);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await apiFetchWritingTest(Number(id));
      setTest(data);
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

  const handleDeleteTask = (task: WritingTask) => {
    alert('Delete Task', `Delete this task?\n\n"${task.taskText.substring(0, 80)}..."`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiDeleteWritingTask(task.id);
            setTest((prev) =>
              prev ? { ...prev, tasks: (prev.tasks || []).filter((t) => t.id !== task.id) } : prev,
            );
            toast.success('Deleted', 'Task deleted');
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
    return TG.purple;
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
          <Text style={styles.headerTitle}>Writing Test</Text>
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
          <Text style={styles.headerTitle}>Writing Test</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.centered}>
          <Text style={{ color: TG.textSecondary }}>Test not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const tasks = test.tasks || [];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <ArrowLeft size={22} color={TG.textWhite} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{test.title}</Text>
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/writing/[id]/edit', params: { id: String(test.id) } } as any)}
          activeOpacity={0.7}
        >
          <Edit2 size={18} color={TG.textWhite} />
        </TouchableOpacity>
      </View>

      {/* Test info */}
      <View style={styles.infoBar}>
        <View style={[styles.typeBadge, test.examType === 'cefr' ? styles.typeBadgeCefr : styles.typeBadgeIelts]}>
          <Text style={[styles.typeBadgeText, test.examType === 'cefr' ? styles.typeBadgeTextCefr : styles.typeBadgeTextIelts]}>
            {test.examType === 'cefr' ? 'CEFR' : 'IELTS'}
          </Text>
        </View>
        {!test.isPublished && (
          <View style={styles.draftBadge}>
            <Text style={styles.draftBadgeText}>Draft</Text>
          </View>
        )}
        <Text style={styles.taskCount}>{tasks.length} task{tasks.length !== 1 ? 's' : ''}</Text>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Tasks</Text>
        <TouchableOpacity
          style={styles.addBtn}
          activeOpacity={0.7}
          onPress={() =>
            router.push({ pathname: '/writing/task', params: { testId: String(test.id) } } as any)
          }
        >
          <Plus size={16} color={TG.textWhite} />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        style={{ flex: 1, backgroundColor: TG.bgSecondary }}
        data={tasks}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => {
          const color = partColor(item.part);
          return (
            <View style={styles.taskCard}>
              <View style={styles.taskHeader}>
                <View style={[styles.indexCircle, { backgroundColor: `${color}14` }]}>
                  <Text style={[styles.indexText, { color }]}>{index + 1}</Text>
                </View>
                <View style={[styles.partBadge, { backgroundColor: `${color}14` }]}>
                  <Text style={[styles.partText, { color }]}>{item.part}</Text>
                </View>
                <View style={{ flex: 1 }} />
                <TouchableOpacity
                  onPress={() =>
                    router.push({ pathname: '/writing/task', params: { testId: String(test.id), taskId: String(item.id) } } as any)
                  }
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Edit2 size={16} color={TG.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDeleteTask(item)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ marginLeft: 12 }}
                >
                  <Trash2 size={16} color={TG.red} />
                </TouchableOpacity>
              </View>
              <Text style={styles.taskText} numberOfLines={3}>{item.taskText}</Text>
              <View style={styles.taskMeta}>
                <View style={styles.metaChip}>
                  <FileText size={11} color={TG.textHint} />
                  <Text style={styles.metaChipText}>{item.minWords}–{item.maxWords} words</Text>
                </View>
                <View style={styles.metaChip}>
                  <Clock size={11} color={TG.textHint} />
                  <Text style={styles.metaChipText}>{formatTime(item.timeLimit)}</Text>
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.centered}>
            <FileText size={40} color={TG.separator} />
            <Text style={styles.emptyText}>No tasks yet</Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => router.push({ pathname: '/writing/task', params: { testId: String(test.id) } } as any)}
              activeOpacity={0.7}
            >
              <Text style={styles.emptyBtnText}>Add First Task</Text>
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
    paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: TG.textWhite, flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingTop: 80, backgroundColor: TG.bgSecondary },
  infoBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: TG.bg,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 0.5, borderBottomColor: TG.separator,
  },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  typeBadgeCefr: { backgroundColor: TG.accentLight },
  typeBadgeIelts: { backgroundColor: TG.purpleLight },
  typeBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  typeBadgeTextCefr: { color: TG.accent },
  typeBadgeTextIelts: { color: TG.purple },
  draftBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: '#FFF3CD' },
  draftBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, color: '#856404' },
  taskCount: { fontSize: 13, color: TG.textSecondary },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: TG.bg, paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 0.5, borderBottomColor: TG.separator,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: TG.textPrimary },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: TG.accent, paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 10,
  },
  addBtnText: { fontSize: 13, fontWeight: '700', color: TG.textWhite },
  taskCard: {
    backgroundColor: TG.bg, paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 0.5, borderBottomColor: TG.separatorLight,
  },
  taskHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8,
  },
  indexCircle: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  indexText: { fontSize: 13, fontWeight: '800' },
  partBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  partText: { fontSize: 11, fontWeight: '700' },
  taskText: { fontSize: 14, color: TG.textPrimary, lineHeight: 20, marginBottom: 8 },
  taskMeta: { flexDirection: 'row', gap: 12 },
  metaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: TG.bgSecondary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  },
  metaChipText: { fontSize: 11, color: TG.textHint },
  emptyText: { color: TG.textSecondary, fontSize: 15, marginTop: 8 },
  emptyBtn: {
    backgroundColor: TG.accent, paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 10, marginTop: 12,
  },
  emptyBtnText: { color: TG.textWhite, fontWeight: '600', fontSize: 14 },
});
