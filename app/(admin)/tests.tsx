import { useAlert } from '@/components/CustomAlert';
import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import { useCachedFetch } from '@/hooks/useCachedFetch';
import { apiDeleteTest, apiFetchTests } from '@/lib/api';
import { useRouter } from 'expo-router';
import { BookOpen, Check, ChevronRight, Plus, Trash2, X } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
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
  isPublished?: boolean;
  questions?: any[];
}

type FilterTab = 'all' | 'cefr' | 'ielts';

const PAGE_LIMIT = 15;

export default function AdminTestsScreen() {
  const router = useRouter();
  const toast = useToast();
  const { alert } = useAlert();
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [extraTests, setExtraTests] = useState<Test[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const pageRef = useRef(1);

  // Selection mode
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const { data: cachedResult, isLoading: loading, refresh } = useCachedFetch<{ data: Test[]; meta?: any }>({
    cacheKey: `admin_tests_${activeTab}`,
    apiFn: () => apiFetchTests({
      testType: activeTab === 'all' ? undefined : activeTab,
      page: 1,
      limit: PAGE_LIMIT,
    }),
    deps: [activeTab],
    staleTime: 60_000,
  });

  // Reset pagination when tab or cache changes
  useEffect(() => {
    setExtraTests([]);
    pageRef.current = 1;
    if (cachedResult?.meta?.totalPages) {
      setTotalPages(cachedResult.meta.totalPages);
    }
  }, [cachedResult, activeTab]);

  const tests = [...(cachedResult?.data || []), ...extraTests];

  const loadMore = () => {
    if (loadingMore || loading) return;
    if (pageRef.current >= totalPages) return;
    const nextPage = pageRef.current + 1;
    setLoadingMore(true);
    apiFetchTests({
      testType: activeTab === 'all' ? undefined : activeTab,
      page: nextPage,
      limit: PAGE_LIMIT,
    })
      .then((res) => {
        setExtraTests(prev => [...prev, ...(res.data || [])]);
        setTotalPages(res.meta?.totalPages ?? 1);
        pageRef.current = nextPage;
      })
      .catch((e: any) => toast.error('Error', e.message))
      .finally(() => setLoadingMore(false));
  };

  const changeTab = (tab: FilterTab) => {
    setActiveTab(tab);
    exitSelectMode();
  };

  const enterSelectMode = (testId: number) => {
    setSelectMode(true);
    setSelected(new Set([testId]));
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const toggleSelect = (testId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(testId)) {
        next.delete(testId);
        if (next.size === 0) {
          setSelectMode(false);
          return new Set();
        }
      } else {
        next.add(testId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === tests.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(tests.map((t) => t.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selected.size === 0) return;
    const count = selected.size;
    alert(
      `Delete ${count} Test${count > 1 ? 's' : ''}?`,
      `This will permanently delete ${count} test${count > 1 ? 's' : ''} and all associated questions and responses.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              const ids = Array.from(selected);
              await Promise.all(ids.map((id) => apiDeleteTest(id)));
              await refresh();
              toast.success('Deleted', `${count} test${count > 1 ? 's' : ''} deleted`);
              exitSelectMode();
            } catch (e: any) {
              toast.error('Error', e.message);
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
      'destructive',
    );
  };

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'cefr', label: 'CEFR' },
    { key: 'ielts', label: 'IELTS' },
  ];

  const allSelected = tests.length > 0 && selected.size === tests.length;

  return (
    <SafeAreaView style={styles.safeArea}>
      {selectMode ? (
        <View style={styles.selectHeader}>
          <TouchableOpacity onPress={exitSelectMode} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <X size={22} color={TG.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.selectHeaderTitle}>{selected.size} selected</Text>
          <View style={styles.selectHeaderActions}>
            <TouchableOpacity onPress={toggleSelectAll} activeOpacity={0.7} style={styles.selectAllBtn}>
              <Text style={styles.selectAllText}>{allSelected ? 'Deselect All' : 'Select All'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleBulkDelete}
              activeOpacity={0.7}
              disabled={deleting || selected.size === 0}
              style={[styles.deleteHeaderBtn, (deleting || selected.size === 0) && { opacity: 0.4 }]}
            >
              {deleting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Trash2 size={18} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Manage Tests</Text>
          <TouchableOpacity onPress={() => router.push('/test/create' as any)} activeOpacity={0.7}>
            <Plus size={22} color={TG.textWhite} />
          </TouchableOpacity>
        </View>
      )}

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
          contentContainerStyle={{ paddingBottom: 40 }}
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
            const isCefr = (item.testType || 'cefr') === 'cefr';
            const isSelected = selected.has(item.id);
            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.7}
                onPress={() => {
                  if (selectMode) {
                    toggleSelect(item.id);
                  } else {
                    router.push({ pathname: '/test/[id]', params: { id: String(item.id) } } as any);
                  }
                }}
                onLongPress={() => {
                  if (!selectMode) enterSelectMode(item.id);
                }}
              >
                {selectMode && (
                  <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                    {isSelected && <Check size={14} color="#fff" strokeWidth={3} />}
                  </View>
                )}
                <View style={styles.testIcon}>
                  <BookOpen size={20} color={TG.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.titleRow}>
                    <Text style={styles.testTitle} numberOfLines={1}>{item.title}</Text>
                    <View style={[styles.typeBadge, isCefr ? styles.typeBadgeCefr : styles.typeBadgeIelts]}>
                      <Text style={[styles.typeBadgeText, isCefr ? styles.typeBadgeTextCefr : styles.typeBadgeTextIelts]}>
                        {isCefr ? 'CEFR' : 'IELTS'}
                      </Text>
                    </View>
                    {!item.isPublished && (
                      <View style={styles.draftBadge}>
                        <Text style={styles.draftBadgeText}>Draft</Text>
                      </View>
                    )}
                  </View>
                  {item.description ? (
                    <Text style={styles.testDesc} numberOfLines={1}>{item.description}</Text>
                  ) : null}
                  <Text style={styles.testSub}>{item.questions?.length ?? 0} questions</Text>
                </View>
                {!selectMode && <ChevronRight size={18} color={TG.textHint} />}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.centered}>
              <BookOpen size={40} color={TG.separator} />
              <Text style={styles.emptyText}>
                {activeTab === 'all' ? 'No tests yet' : `No ${activeTab.toUpperCase()} tests found`}
              </Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/test/create' as any)} activeOpacity={0.7}>
                <Text style={styles.emptyBtnText}>Create First Test</Text>
              </TouchableOpacity>
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
  headerTitle: { fontSize: 20, fontWeight: '700', color: TG.textWhite },
  selectHeader: {
    backgroundColor: TG.bg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: TG.separator,
  },
  selectHeaderTitle: { fontSize: 17, fontWeight: '700', color: TG.textPrimary, flex: 1 },
  selectHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  selectAllBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 10, backgroundColor: TG.bgSecondary,
  },
  selectAllText: { fontSize: 13, fontWeight: '600', color: TG.accent },
  deleteHeaderBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: TG.red,
    alignItems: 'center', justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: TG.bg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: TG.separator,
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
    backgroundColor: TG.bg, paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 0.5, borderBottomColor: TG.separatorLight, gap: 12,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: TG.separator,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: TG.accent, borderColor: TG.accent },
  testIcon: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: TG.accentLight,
    justifyContent: 'center', alignItems: 'center',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  testTitle: { fontSize: 15, fontWeight: '600', color: TG.textPrimary, flexShrink: 1 },
  testDesc: { fontSize: 13, color: TG.textSecondary, marginTop: 2 },
  testSub: { fontSize: 12, color: TG.textHint, marginTop: 2 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  typeBadgeCefr: { backgroundColor: TG.accentLight },
  typeBadgeIelts: { backgroundColor: TG.purpleLight },
  typeBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  typeBadgeTextCefr: { color: TG.accent },
  typeBadgeTextIelts: { color: TG.purple },
  draftBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: '#FFF3CD' },
  draftBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, color: '#856404' },
  emptyText: { color: TG.textSecondary, fontSize: 15 },
  emptyBtn: { backgroundColor: TG.accent, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, marginTop: 8 },
  emptyBtnText: { color: TG.textWhite, fontWeight: '600', fontSize: 14 },
});
