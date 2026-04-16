import { TG } from '@/constants/theme';
import { apiFetchTests } from '@/lib/api';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, BookOpen, ChevronRight, FileText, MessageSquare, Mic, Play } from 'lucide-react-native';
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

interface Test {
  id: number;
  title: string;
  description: string | null;
  testType?: 'cefr' | 'ielts';
  questions?: any[];
}

type FilterTab = 'all' | 'cefr' | 'ielts';

const PAGE_LIMIT = 15;

export default function SpeakingTestsScreen() {
  const router = useRouter();
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [totalPages, setTotalPages] = useState(1);
  const pageRef = useRef(1);

  const load = useCallback(async (filter?: FilterTab, page = 1) => {
    const tab = filter ?? activeTab;
    if (page === 1) setLoading(true); else setLoadingMore(true);
    try {
      const res = await apiFetchTests({
        testType: tab === 'all' ? undefined : tab,
        page,
        limit: PAGE_LIMIT,
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
      console.error('Error loading tests', e);
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

  const tabs: { key: FilterTab; label: string; icon: React.ReactNode }[] = [
    { key: 'all', label: 'All Tests', icon: <BookOpen size={14} color={activeTab === 'all' ? '#fff' : TG.textSecondary} /> },
    { key: 'cefr', label: 'CEFR', icon: <FileText size={14} color={activeTab === 'cefr' ? '#fff' : TG.textSecondary} /> },
    { key: 'ielts', label: 'IELTS', icon: <FileText size={14} color={activeTab === 'ielts' ? '#fff' : TG.textSecondary} /> },
  ];

  const renderTestCard = ({ item }: { item: Test }) => {
    const isCefr = (item.testType || 'cefr') === 'cefr';
    const qCount = item.questions?.length ?? 0;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => router.push({ pathname: '/speaking/[id]', params: { id: String(item.id) } } as any)}
      >
        <View style={styles.cardLeft}>
          <LinearGradient
            colors={isCefr ? [TG.accent, TG.accentDark] : [TG.purple, '#7C3AED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardIcon}
          >
            <Mic size={22} color="#fff" />
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
            <View style={styles.metaPill}>
              <MessageSquare size={12} color={TG.textHint} />
              <Text style={styles.metaText}>{qCount} question{qCount !== 1 ? 's' : ''}</Text>
            </View>
          </View>
        </View>

        <View style={styles.cardPlayBtn}>
          <Play size={16} color={TG.accent} fill={TG.accent} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ArrowLeft size={22} color={TG.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Mic size={20} color={TG.accent} />
          <Text style={styles.headerTitle}>Speaking Tests</Text>
        </View>
        <View style={{ width: 22 }} />
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            activeOpacity={0.7}
            onPress={() => changeTab(tab.key)}
          >
            {tab.icon}
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
          style={styles.list}
          data={tests}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderTestCard}
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
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <Mic size={40} color={TG.separator} />
              </View>
              <Text style={styles.emptyTitle}>
                {activeTab === 'all' ? 'No speaking tests available' : `No ${activeTab.toUpperCase()} tests found`}
              </Text>
              <Text style={styles.emptyDesc}>
                Check back later — your teacher will add new tests soon.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TG.bgSecondary },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
    backgroundColor: TG.bgSecondary,
    gap: 14,
  },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: TG.textPrimary },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: TG.bg,
  },
  tabActive: { backgroundColor: TG.accent },
  tabText: { fontSize: 13, fontWeight: '600', color: TG.textSecondary },
  tabTextActive: { color: '#fff' },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingBottom: 40 },

  // Card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TG.bg,
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  cardLeft: {},
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: TG.textPrimary, flexShrink: 1 },
  cardDesc: { fontSize: 12, color: TG.textSecondary, lineHeight: 16, marginBottom: 4 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: TG.bgSecondary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  metaText: { fontSize: 11, fontWeight: '600', color: TG.textHint },
  cardPlayBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: TG.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Type Badges
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  typeBadgeCefr: { backgroundColor: TG.accentLight },
  typeBadgeIelts: { backgroundColor: TG.purpleLight },
  typeBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  typeBadgeTextCefr: { color: TG.accent },
  typeBadgeTextIelts: { color: TG.purple },

  // Empty
  emptyWrap: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: TG.bg,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: TG.textPrimary, textAlign: 'center', marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: TG.textSecondary, textAlign: 'center', lineHeight: 20 },
});
