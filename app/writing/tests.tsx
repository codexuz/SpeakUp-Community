import { TG } from '@/constants/theme';
import { apiFetchWritingTests } from '@/lib/api';
import type { WritingTest } from '@/lib/types';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, ChevronRight, FileText } from 'lucide-react-native';
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

type FilterTab = 'all' | 'cefr' | 'ielts';

const PAGE_LIMIT = 15;

export default function WritingTestsStudentScreen() {
  const router = useRouter();
  const [tests, setTests] = useState<WritingTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [totalPages, setTotalPages] = useState(1);
  const pageRef = useRef(1);

  const load = useCallback(async (filter?: FilterTab, page = 1) => {
    const tab = filter ?? activeTab;
    if (page === 1) setLoading(true); else setLoadingMore(true);
    try {
      const res = await apiFetchWritingTests({
        examType: tab === 'all' ? undefined : tab,
        page,
        limit: PAGE_LIMIT,
        isPublished: true,
      });
      const items = res.data || [];
      if (page === 1) {
        setTests(items);
      } else {
        setTests((prev) => [...prev, ...items]);
      }
      setTotalPages(res.meta?.totalPages ?? 1);
      pageRef.current = page;
    } catch (e) {
      console.error('Error loading writing tests', e);
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
    { key: 'all', label: 'All Tests' },
    { key: 'cefr', label: 'CEFR' },
    { key: 'ielts', label: 'IELTS' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <ArrowLeft size={22} color={TG.textWhite} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Writing Tests</Text>
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
          data={tests}
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
            const isCefr = item.examType === 'cefr';
            const taskCount = item.tasks?.length ?? 0;

            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.7}
                onPress={() => router.push({ pathname: '/writing/submit', params: { testId: String(item.id) } } as any)}
              >
                <View style={styles.cardLeft}>
                  <LinearGradient
                    colors={isCefr ? [TG.accent, TG.accentDark] : [TG.purple, '#7C3AED']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.cardIcon}
                  >
                    <FileText size={22} color="#fff" />
                  </LinearGradient>
                </View>

                <View style={styles.cardBody}>
                  <View style={styles.cardTitleRow}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                    <View style={[styles.typeBadge, isCefr ? styles.typeBadgeCefr : styles.typeBadgeIelts]}>
                      <Text style={[styles.typeBadgeText, isCefr ? styles.typeBadgeTextCefr : styles.typeBadgeTextIelts]}>
                        {isCefr ? 'CEFR' : 'IELTS'}
                      </Text>
                    </View>
                  </View>
                  {item.description ? (
                    <Text style={styles.cardDesc} numberOfLines={1}>{item.description}</Text>
                  ) : null}
                  <View style={styles.cardMeta}>
                    <View style={styles.metaItem}>
                      <FileText size={12} color={TG.textHint} />
                      <Text style={styles.metaText}>{taskCount} task{taskCount !== 1 ? 's' : ''}</Text>
                    </View>
                  </View>
                </View>

                <ChevronRight size={18} color={TG.textHint} />
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.centered}>
              <FileText size={40} color={TG.separator} />
              <Text style={styles.emptyText}>No writing tests available</Text>
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
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 16, backgroundColor: TG.bgSecondary,
  },
  tabActive: { backgroundColor: TG.accent },
  tabText: { fontSize: 13, fontWeight: '600', color: TG.textSecondary },
  tabTextActive: { color: TG.textWhite },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingTop: 80, backgroundColor: TG.bgSecondary },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: TG.bg, marginHorizontal: 12, marginTop: 8,
    borderRadius: 14, padding: 14, gap: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8,
    elevation: 1,
  },
  cardLeft: {},
  cardIcon: {
    width: 48, height: 48, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  cardBody: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: TG.textPrimary, flexShrink: 1 },
  cardDesc: { fontSize: 13, color: TG.textSecondary, marginTop: 2 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: TG.textHint },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  typeBadgeCefr: { backgroundColor: TG.accentLight },
  typeBadgeIelts: { backgroundColor: TG.purpleLight },
  typeBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  typeBadgeTextCefr: { color: TG.accent },
  typeBadgeTextIelts: { color: TG.purple },
  emptyText: { color: TG.textSecondary, fontSize: 15, marginTop: 8 },
});
