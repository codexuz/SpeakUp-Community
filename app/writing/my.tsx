import { TG } from '@/constants/theme';
import { apiFetchMyWritingSessions } from '@/lib/api';
import type { WritingSession } from '@/lib/types';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Calendar, ChevronRight, FileText, Star } from 'lucide-react-native';
import React, { useCallback, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
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
      const res = await apiFetchMyWritingSessions(page, PAGE_LIMIT);
      const items = res.data || [];
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <ArrowLeft size={22} color={TG.textWhite} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Writing</Text>
        <View style={{ width: 22 }} />
      </View>

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
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={TG.accent} />
        </View>
      ) : (
        <FlatList
          style={{ flex: 1, backgroundColor: TG.bgSecondary }}
          data={sessions}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingBottom: 40, paddingTop: 8 }}
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
            const statusColor = hasReview ? TG.green : TG.orange;
            const statusLabel = hasReview ? 'Reviewed' : 'Pending';

            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.7}
                onPress={() => router.push({ pathname: '/writing/session/[id]', params: { id: String(item.id) } } as any)}
              >
                <View style={styles.cardTop}>
                  <View style={styles.cardTitleRow}>
                    <FileText size={16} color={TG.accent} />
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {(item as any).test?.title || `Session #${item.id}`}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                    <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
                  </View>
                </View>

                <View style={styles.cardBottom}>
                  <View style={styles.metaRow}>
                    <Calendar size={12} color={TG.textHint} />
                    <Text style={styles.metaText}>{formatDate(item.createdAt)}</Text>
                  </View>
                  {item.scoreAvg != null && (
                    <View style={styles.metaRow}>
                      <Star size={12} color={TG.orange} />
                      <Text style={styles.metaText}>Score: {item.scoreAvg}</Text>
                    </View>
                  )}
                  <ChevronRight size={16} color={TG.textHint} />
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.centered}>
              <FileText size={40} color={TG.separator} />
              <Text style={styles.emptyText}>No writing sessions yet</Text>
              <Text style={{ color: TG.textHint, fontSize: 13, marginTop: 4 }}>
                Take a writing test to get started
              </Text>
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
    paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: TG.textWhite, flex: 1 },
  tabBar: {
    flexDirection: 'row', backgroundColor: TG.bg,
    paddingHorizontal: 12, paddingVertical: 8, gap: 8,
    borderBottomWidth: 0.5, borderBottomColor: TG.separator,
  },
  tab: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 16, backgroundColor: TG.bgSecondary,
  },
  tabActive: { backgroundColor: TG.accent },
  tabText: { fontSize: 13, fontWeight: '600', color: TG.textSecondary },
  tabTextActive: { color: TG.textWhite },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingTop: 80, backgroundColor: TG.bgSecondary },
  card: {
    backgroundColor: TG.bg, marginHorizontal: 12, marginTop: 8,
    borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8,
    elevation: 1,
  },
  cardTop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: TG.textPrimary, flexShrink: 1 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '700' },
  cardBottom: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: TG.textHint },
  emptyText: { color: TG.textSecondary, fontSize: 15, marginTop: 8 },
});
