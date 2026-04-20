import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import { useDatabase } from '@/expo-local-db/DatabaseProvider';
import { useOfflineCache } from '@/expo-local-db/hooks/useOfflineCache';
import { apiFetchCommunityFeed, apiLikeSpeaking, apiUnlikeSpeaking } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { useRouter } from 'expo-router';
import { ChevronRight, Flame, Heart, MessageCircle, Mic, Star, TrendingUp } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Strategy = 'latest' | 'trending' | 'top';
type ExamType = 'cefr' | 'ielts';

export default function CommunityScreen() {
  const { user } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const { isReady } = useDatabase();

  const [strategy, setStrategy] = useState<Strategy>('latest');
  const [examType, setExamType] = useState<ExamType>('cefr');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pendingLikeIds, setPendingLikeIds] = useState<Set<string>>(new Set());
  const [extraItems, setExtraItems] = useState<any[]>([]);

  // Offline-first: caches page 1 as JSON in SQLite
  const { data: cachedFeed, isLoading: loading } = useOfflineCache<{ data: any[]; pagination: any }>({
    cacheKey: `teacher_community_${strategy}_${examType}`,
    apiFn: () => apiFetchCommunityFeed(strategy, 1, 20, strategy === 'top' ? examType : undefined),
    enabled: isReady,
    deps: [strategy, examType],
    staleTime: 30_000,
  });

  const submissions = [...(cachedFeed?.data || []), ...extraItems];

  useEffect(() => {
    setExtraItems([]);
    setPage(1);
    setHasMore(true);
  }, [strategy, examType]);

  useEffect(() => {
    if (cachedFeed?.pagination) {
      setHasMore(1 < cachedFeed.pagination.totalPages);
    }
  }, [cachedFeed]);

  const loadMore = () => {
    if (loadingMore || !hasMore) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    apiFetchCommunityFeed(strategy, nextPage, 20, strategy === 'top' ? examType : undefined)
      .then((result) => {
        setExtraItems(prev => [...prev, ...(result.data || [])]);
        setHasMore(nextPage < result.pagination.totalPages);
        setPage(nextPage);
      })
      .catch((e) => console.error('Failed to load more', e))
      .finally(() => setLoadingMore(false));
  };

  const changeStrategy = (s: Strategy) => {
    setStrategy(s);
  };

  const changeExamType = (e: ExamType) => {
    setExamType(e);
  };

  const toggleLike = async (item: any) => {
    if (pendingLikeIds.has(item.id)) return;

    const wasLiked = !!item.isLiked;
    const prevLikes = Number(item.likes || 0);
    const nextLiked = !wasLiked;
    const nextLikes = Math.max(0, prevLikes + (wasLiked ? -1 : 1));

    setSubmissions((prev) =>
      prev.map((s) =>
        s.id === item.id ? { ...s, isLiked: nextLiked, likes: nextLikes } : s
      )
    );
    setPendingLikeIds((prev) => {
      const next = new Set(prev);
      next.add(item.id);
      return next;
    });

    try {
      if (wasLiked) {
        await apiUnlikeSpeaking(item.id);
      } else {
        await apiLikeSpeaking(item.id);
      }
    } catch (e: any) {
      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === item.id ? { ...s, isLiked: wasLiked, likes: prevLikes } : s
        )
      );
      console.warn('Like error', e.message);
      toast.error('Error', e.message || 'Failed to update like');
    } finally {
      setPendingLikeIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => router.push(`/community/${item.id}` as any)}>
      {/* Top row: avatar, name+date, score pill, chevron */}
      <View style={styles.topRow}>
        <View style={styles.userTapArea}>
          <View style={styles.avatar}>
            {item.user?.avatarUrl ? (
              <Image source={{ uri: item.user.avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{(item.user?.fullName || '?').charAt(0)}</Text>
            )}
          </View>
          <View style={styles.nameBlock}>
            <Text style={styles.userName} numberOfLines={1}>{item.user?.fullName || 'Unknown'}</Text>
            <Text style={styles.dateText}>
              {new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </Text>
          </View>
        </View>
        {item.scoreAvg != null && (
          <View style={styles.scorePill}>
            <Star size={11} color={TG.orange} fill={TG.orange} />
            <Text style={styles.scoreText}>{item.scoreAvg.toFixed(1)}</Text>
          </View>
        )}
        <ChevronRight size={16} color={TG.textHint} />
      </View>

      {/* Test title */}
      <Text style={styles.titleText} numberOfLines={2}>
        {item.test?.title || 'Unknown Test'}
      </Text>

      {/* Bottom bar: meta chips + actions */}
      <View style={styles.bottomRow}>
        <View style={styles.chip}>
          <Mic size={12} color={TG.accent} />
          <Text style={styles.chipText}>{item._count?.responses || 0}</Text>
        </View>
        <TouchableOpacity
          style={[styles.chip, pendingLikeIds.has(item.id) && styles.chipDisabled]}
          activeOpacity={0.6}
          onPress={() => toggleLike(item)}
          disabled={pendingLikeIds.has(item.id)}
        >
          <Heart size={12} color={item.isLiked ? TG.red : TG.textHint} fill={item.isLiked ? TG.red : 'none'} />
          <Text style={[styles.chipText, item.isLiked && { color: TG.red }]}>{item.likes || 0}</Text>
        </TouchableOpacity>
        <View style={styles.chip}>
          <MessageCircle size={12} color={TG.textHint} />
          <Text style={styles.chipText}>{item.commentsCount || 0}</Text>
        </View>
      </View>

      {/* Reviews Footer */}
      <TouchableOpacity style={styles.reviewsFooter} activeOpacity={0.7} onPress={() => router.push(`/review/${item.id}` as any)}>
          <View style={styles.reviewsFooterLeft}>
            <View style={styles.reviewAvatars}>
              {item.reviews?.length > 0 ? (
                item.reviews.slice(0, 3).map((r: any, i: number) => (
                  <View key={i} style={[styles.reviewAvatarCircle, i === 0 && { marginLeft: 0 }]}>
                    {r.reviewer?.avatarUrl ? (
                      <Image source={{ uri: r.reviewer.avatarUrl }} style={styles.reviewAvatarImage} />
                    ) : (
                      <Text style={styles.reviewAvatarInitials}>{(r.reviewer?.fullName || '?').charAt(0)}</Text>
                    )}
                  </View>
                ))
              ) : (
                <View style={[styles.reviewAvatarCircle, { marginLeft: 0 }]}>
                  <Text style={styles.reviewAvatarInitials}>R</Text>
                </View>
              )}
            </View>
            <Text style={styles.reviewsFooterText}>
              {item._count?.reviews || 0} review{(item._count?.reviews || 0) !== 1 ? 's' : ''}
            </Text>
          </View>
          <ChevronRight size={16} color={TG.textHint} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const strategies: { key: Strategy; label: string; icon: React.ReactNode }[] = [
    { key: 'latest', label: 'Latest', icon: <MessageCircle size={14} color={strategy === 'latest' ? TG.textWhite : TG.textSecondary} /> },
    { key: 'trending', label: 'Trending', icon: <Flame size={14} color={strategy === 'trending' ? TG.textWhite : TG.textSecondary} /> },
    { key: 'top', label: 'Top', icon: <TrendingUp size={14} color={strategy === 'top' ? TG.textWhite : TG.textSecondary} /> },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Community</Text>
      </View>

      <View style={styles.tabBar}>
        {strategies.map(s => (
          <TouchableOpacity
            key={s.key}
            style={[styles.tab, strategy === s.key && styles.tabActive]}
            activeOpacity={0.7}
            onPress={() => changeStrategy(s.key)}
          >
            {s.icon}
            <Text style={[styles.tabText, strategy === s.key && styles.tabTextActive]}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {strategy === 'top' && (
        <View style={styles.examTypeBar}>
          {(['cefr', 'ielts'] as ExamType[]).map(e => (
            <TouchableOpacity
              key={e}
              style={[styles.examTypeTab, examType === e && styles.examTypeTabActive]}
              activeOpacity={0.7}
              onPress={() => changeExamType(e)}
            >
              <Text style={[styles.examTypeText, examType === e && styles.examTypeTextActive]}>
                {e.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {loading ? (
        <View style={{ flex: 1, backgroundColor: TG.bgSecondary, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={TG.accent} />
        </View>
      ) : (
        <FlatList
          style={{ flex: 1, backgroundColor: TG.bgSecondary }}
          data={submissions}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={TG.accent} style={{ paddingVertical: 16 }} /> : null}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MessageCircle size={40} color={TG.separator} />
              <Text style={styles.emptyText}>No submissions yet</Text>
            </View>
          }
        />
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TG.headerBg },
  header: { backgroundColor: TG.headerBg, paddingHorizontal: 16, paddingVertical: 14 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: TG.textWhite },
  tabBar: { flexDirection: 'row', backgroundColor: TG.bg, paddingHorizontal: 12, paddingVertical: 8, gap: 8, borderBottomWidth: 0.5, borderBottomColor: TG.separator },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: TG.bgSecondary },
  tabActive: { backgroundColor: TG.accent },
  tabText: { fontSize: 13, fontWeight: '600', color: TG.textSecondary },
  tabTextActive: { color: TG.textWhite },
  examTypeBar: { flexDirection: 'row', backgroundColor: TG.bg, paddingHorizontal: 12, paddingBottom: 8, paddingTop: 8, gap: 8, borderBottomWidth: 0.5, borderBottomColor: TG.separator },
  examTypeTab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12, backgroundColor: TG.bgSecondary },
  examTypeTabActive: { backgroundColor: TG.accent },
  examTypeText: { fontSize: 12, fontWeight: '700', color: TG.textSecondary },
  examTypeTextActive: { color: TG.textWhite },
  listContent: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 100 },
  card: {
    backgroundColor: TG.bg,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  userTapArea: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: TG.accentLight, justifyContent: 'center', alignItems: 'center' },
  avatarImage: { width: '100%', height: '100%', borderRadius: 17 },
  avatarText: { fontSize: 14, fontWeight: '700', color: TG.accent },
  nameBlock: { flex: 1 },
  userName: { fontSize: 14, fontWeight: '600', color: TG.textPrimary },
  dateText: { fontSize: 11, color: TG.textHint, marginTop: 1 },
  scorePill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: TG.orangeLight, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  scoreText: { fontSize: 12, fontWeight: '700', color: TG.orange },
  titleText: { fontSize: 14, fontWeight: '500', color: TG.textPrimary, lineHeight: 20, marginBottom: 8 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chipDisabled: { opacity: 0.55 },
  chipText: { fontSize: 12, color: TG.textHint, fontWeight: '500' },
  reviewsFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: TG.bg, borderBottomLeftRadius: 14, borderBottomRightRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginTop: 12, marginHorizontal: -12, marginBottom: -12, borderTopWidth: 1, borderTopColor: TG.separator },
  reviewsFooterLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reviewAvatars: { flexDirection: 'row', alignItems: 'center' },
  reviewAvatarCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: TG.accentLight, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: TG.bgSecondary, marginLeft: -8 },
  reviewAvatarImage: { width: '100%', height: '100%', borderRadius: 12 },
  reviewAvatarInitials: { fontSize: 10, color: TG.accent, fontWeight: '700' },
  reviewsFooterText: { fontSize: 13, color: TG.textPrimary, fontWeight: '600' },  emptyContainer: { alignItems: 'center', marginTop: 80, gap: 12 },
  emptyText: { color: TG.textSecondary, fontSize: 15 },
});