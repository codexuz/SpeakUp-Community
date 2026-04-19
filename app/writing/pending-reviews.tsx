import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import { apiFetchPendingWritingReviews } from '@/lib/api';
import type { WritingSession } from '@/lib/types';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import {
    ArrowLeft,
    ChevronRight,
    FileText,
    Pen,
    Users,
} from 'lucide-react-native';
import React, { useCallback, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const PAGE_LIMIT = 20;

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function PendingWritingReviewsScreen() {
  const router = useRouter();
  const toast = useToast();
  const [sessions, setSessions] = useState<WritingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const pageRef = useRef(1);

  const load = useCallback(async (page = 1) => {
    if (page === 1) setLoading(true); else setLoadingMore(true);
    try {
      const res = await apiFetchPendingWritingReviews(page, PAGE_LIMIT);
      const items = res.data || [];
      if (page === 1) {
        setSessions(items);
      } else {
        setSessions((prev) => [...prev, ...items]);
      }
      setTotalPages(res.pagination?.totalPages ?? 1);
      pageRef.current = page;
    } catch (e: any) {
      toast.error('Error', e.message || 'Failed to load pending reviews');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(1);
    }, [load])
  );

  const loadMore = () => {
    if (loadingMore || loading) return;
    if (pageRef.current >= totalPages) return;
    load(pageRef.current + 1);
  };

  const renderItem = ({ item }: { item: WritingSession }) => {
    const testTitle = item.test?.title || 'Writing Test';
    const studentName = item.user?.fullName || 'Student';
    const initial = studentName.charAt(0).toUpperCase();
    const responseCount = (item as any)._count?.responses ?? item.responses?.length ?? 0;
    const groupName = (item as any).group?.name;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => router.push({ pathname: '/writing/session/[id]', params: { id: String(item.id) } } as any)}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.topRow}>
            <Text style={styles.studentName} numberOfLines={1}>{studentName}</Text>
            <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
          </View>
          <Text style={styles.testTitle} numberOfLines={1}>{testTitle}</Text>
          <View style={styles.metaRow}>
            {groupName && (
              <View style={styles.metaPill}>
                <Users size={10} color={TG.textHint} />
                <Text style={styles.metaPillText}>{groupName}</Text>
              </View>
            )}
            {responseCount > 0 && (
              <View style={styles.metaPill}>
                <Pen size={10} color={TG.textHint} />
                <Text style={styles.metaPillText}>{responseCount} task{responseCount > 1 ? 's' : ''}</Text>
              </View>
            )}
            {item.examType && (
              <View style={[styles.metaPill, { backgroundColor: TG.purpleLight }]}>
                <Text style={[styles.metaPillText, { color: TG.purple }]}>{item.examType.toUpperCase()}</Text>
              </View>
            )}
          </View>
        </View>
        <ChevronRight size={16} color={TG.textHint} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={TG.headerBg} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={22} color={TG.textWhite} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pending Writing Reviews</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={TG.aiFeedback} />
          <Text style={styles.loadingText}>Loading submissions...</Text>
        </View>
      ) : (
        <FlatList
          style={styles.listView}
          data={sessions}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={TG.accent} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <FileText size={32} color={TG.textHint} />
              </View>
              <Text style={styles.emptyTitle}>All caught up!</Text>
              <Text style={styles.emptySub}>No pending writing submissions to review</Text>
            </View>
          }
        />
      )}
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
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: TG.textWhite },

  // Loading
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: TG.bg, gap: 14 },
  loadingText: { fontSize: 15, color: TG.textSecondary },

  // List
  listView: { flex: 1, backgroundColor: TG.bgSecondary },
  listContent: { paddingBottom: 40 },

  // Card
  card: {
    backgroundColor: TG.bg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: TG.separatorLight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: TG.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: TG.accent },
  cardBody: { flex: 1 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  studentName: { fontSize: 15, fontWeight: '600', color: TG.textPrimary, flex: 1, marginRight: 8 },
  dateText: { fontSize: 11, color: TG.textHint },
  testTitle: { fontSize: 13, color: TG.textSecondary, marginBottom: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: TG.bgSecondary,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  metaPillText: { fontSize: 10, fontWeight: '600', color: TG.textSecondary },

  // Empty state
  emptyContainer: { alignItems: 'center', paddingTop: 80, gap: 6 },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: TG.bgSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: TG.textPrimary },
  emptySub: { fontSize: 13, color: TG.textHint },
});
