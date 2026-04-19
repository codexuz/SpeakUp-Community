import { TG } from '@/constants/theme';
import { apiFetchMyWritingSessions } from '@/lib/api';
import type { WritingSession } from '@/lib/types';
import { getScoreColor } from '@/lib/types';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Pen
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

type FilterTab = 'all' | 'pending' | 'reviewed';

const PAGE_LIMIT = 15;

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function MyWritingSessionsScreen() {
  const router = useRouter();
  const [sessions, setSessions] = useState<WritingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [totalPages, setTotalPages] = useState(1);
  const pageRef = useRef(1);

  const load = useCallback(async (filter?: FilterTab, page = 1) => {
    const tab = filter ?? activeTab;
    if (page === 1) setLoading(true); else setLoadingMore(true);
    try {
      const statusParam = tab === 'all' ? undefined : tab;
      const res = await apiFetchMyWritingSessions(page, PAGE_LIMIT, statusParam);
      let items = res.data || [];
      // Client-side fallback if backend doesn't filter by status
      if (tab === 'pending') items = items.filter((s) => !(s.reviews?.length));
      else if (tab === 'reviewed') items = items.filter((s) => !!(s.reviews?.length));
      if (page === 1) {
        setSessions(items);
      } else {
        setSessions((prev) => [...prev, ...items]);
      }
      setTotalPages(res.pagination?.totalPages ?? 1);
      pageRef.current = page;
    } catch (e) {
      console.error('Error loading writing sessions', e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [activeTab]);

  useFocusEffect(
    useCallback(() => {
      load(undefined, 1);
    }, [load])
  );

  const loadMore = () => {
    if (loadingMore || loading) return;
    if (pageRef.current >= totalPages) return;
    load(activeTab, pageRef.current + 1);
  };

  const changeTab = (tab: FilterTab) => {
    setActiveTab(tab);
    load(tab, 1);
  };

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'reviewed', label: 'Reviewed' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={TG.headerBg} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={22} color={TG.textWhite} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Writing</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* ── Filter Tabs ──────────────── */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            activeOpacity={0.7}
            onPress={() => changeTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={TG.aiFeedback} />
          <Text style={styles.loadingText}>Loading sessions...</Text>
        </View>
      ) : (
        <FlatList
          style={styles.listView}
          data={sessions}
          keyExtractor={(item) => String(item.id)}
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
          renderItem={({ item }) => {
            const hasReview = (item.reviews?.length ?? 0) > 0;
            const responseCount = item.responses?.length ?? 0;

            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.7}
                onPress={() => router.push({ pathname: '/writing/session/[id]', params: { id: String(item.id) } } as any)}
              >
                {/* Top row: title + status */}
                <View style={styles.cardTopRow}>
                  <View style={styles.cardTitleRow}>
                    <FileText size={16} color={TG.accent} />
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {(item as any).test?.title || `Session #${item.id}`}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: hasReview ? TG.greenLight : TG.orangeLight }]}>
                    {hasReview ? (
                      <CheckCircle2 size={11} color={TG.green} />
                    ) : (
                      <Clock size={11} color={TG.orange} />
                    )}
                    <Text style={[styles.statusText, { color: hasReview ? TG.green : TG.orange }]}>
                      {hasReview ? 'Reviewed' : 'Pending'}
                    </Text>
                  </View>
                </View>

                {/* Separator */}
                <View style={styles.cardSeparator} />

                {/* Bottom row: meta + score + arrow */}
                <View style={styles.cardBottomRow}>
                  <View style={styles.metaGroup}>
                    <View style={styles.metaPill}>
                      <Calendar size={10} color={TG.textHint} />
                      <Text style={styles.metaPillText}>{formatDate(item.createdAt)}</Text>
                    </View>
                    {responseCount > 0 && (
                      <View style={styles.metaPill}>
                        <Pen size={10} color={TG.textHint} />
                        <Text style={styles.metaPillText}>{responseCount} task{responseCount > 1 ? 's' : ''}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.cardTrailing}>
                    {item.scoreAvg != null && (
                      <View style={[styles.scoreCircleMini, { borderColor: getScoreColor(Math.round((item.scoreAvg / 9) * 100)) }]}>
                        <Text style={[styles.scoreCircleMiniText, { color: getScoreColor(Math.round((item.scoreAvg / 9) * 100)) }]}>
                          {item.scoreAvg}
                        </Text>
                      </View>
                    )}
                    <ChevronRight size={16} color={TG.textHint} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <FileText size={32} color={TG.textHint} />
              </View>
              <Text style={styles.emptyTitle}>No writing sessions yet</Text>
              <Text style={styles.emptySub}>Take a writing test to get started</Text>
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

  // Tabs
  tabBar: {
    flexDirection: 'row',
    backgroundColor: TG.bg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: TG.separatorLight,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: TG.bgSecondary,
  },
  tabActive: { backgroundColor: TG.accent },
  tabText: { fontSize: 13, fontWeight: '600', color: TG.textSecondary },
  tabTextActive: { color: TG.textWhite },

  // Loading
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: TG.bg, gap: 14 },
  loadingText: { fontSize: 15, color: TG.textSecondary },

  // List
  listView: { flex: 1, backgroundColor: TG.bgSecondary },
  listContent: { paddingBottom: 40, paddingTop: 6 },

  // Card
  card: {
    backgroundColor: TG.bg,
    marginHorizontal: 14,
    marginTop: 8,
    borderRadius: 14,
    overflow: 'hidden',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 8 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: TG.textPrimary, flexShrink: 1 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  cardSeparator: { height: 0.5, backgroundColor: TG.separatorLight, marginHorizontal: 14 },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
  },
  metaGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: TG.bgSecondary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  metaPillText: { fontSize: 11, fontWeight: '600', color: TG.textSecondary },
  cardTrailing: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scoreCircleMini: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreCircleMiniText: { fontSize: 12, fontWeight: '800' },

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
