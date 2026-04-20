import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import { useCachedFetch } from '@/hooks/useCachedFetch';
import { apiFetchCommunityFeed, apiPostReview } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { useRouter } from 'expo-router';
import { ChevronRight, Flame, Heart, MessageCircle, Mic, Star, TrendingUp } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Strategy = 'latest' | 'trending' | 'top';
type ExamType = 'cefr' | 'ielts';

export default function CommunityScreen() {
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher';
  const toast = useToast();
  const router = useRouter();

  const [strategy, setStrategy] = useState<Strategy>('latest');
  const [examType, setExamType] = useState<ExamType>('cefr');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [extraItems, setExtraItems] = useState<any[]>([]);

  const [reviewModal, setReviewModal] = useState(false);
  const [selectedSub, setSelectedSub] = useState<any>(null);
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: cachedFeed, isLoading: loading, refresh } = useCachedFetch<{ data: any[]; pagination: any }>({
    cacheKey: `student_community_${strategy}_${examType}`,
    apiFn: () => apiFetchCommunityFeed(strategy, 1, 20, strategy === 'top' ? examType : undefined),
    deps: [strategy, examType],
    staleTime: 60_000,
  });

  // Reset pagination when strategy or examType changes
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    setExtraItems([]);
  }, [strategy, examType]);

  // Update hasMore from cached data
  useEffect(() => {
    if (cachedFeed?.pagination) {
      setHasMore(1 < cachedFeed.pagination.totalPages);
    }
  }, [cachedFeed]);

  const submissions = [...(cachedFeed?.data || []), ...extraItems];

  const changeStrategy = (s: Strategy) => {
    setStrategy(s);
  };

  const changeExamType = (e: ExamType) => {
    setExamType(e);
  };

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

  const openReviewModal = (sub: any) => {
    setSelectedSub(sub);
    setScore('');
    setFeedback('');
    setReviewModal(true);
  };

  const handleReview = async () => {
    if (!selectedSub || !score) return;
    const numScore = parseInt(score, 10);
    if (isNaN(numScore) || numScore < 0 || numScore > 75) {
      toast.warning('Invalid', 'Score must be between 0 and 75');
      return;
    }
    setSubmitting(true);
    try {
      await apiPostReview(selectedSub.id, numScore, feedback);
      setReviewModal(false);
      refresh();
    } catch (e: any) {
      toast.error('Error', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]} onPress={() => router.push(`/community/${item.id}` as any)}>
      {/* Top row: avatar, name+date, score pill, chevron */}
      <View style={styles.topRow}>
        <View style={styles.userTapArea}>
          <View style={styles.avatar}>
            {item.isAnonymous ? (
              <Text style={styles.avatarText}>A</Text>
            ) : item.user?.avatarUrl ? (
              <Image source={{ uri: item.user.avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{(item.user?.fullName || '?').charAt(0)}</Text>
            )}
          </View>
          <View style={styles.nameBlock}>
            <Text style={styles.userName} numberOfLines={1}>{item.isAnonymous ? 'Anonymous Student' : (item.user?.fullName || 'Unknown')}</Text>
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
        <View style={styles.chip}>
          <Heart size={12} color={item.isLiked ? TG.red : TG.textHint} fill={item.isLiked ? TG.red : 'none'} />
          <Text style={[styles.chipText, item.isLiked && { color: TG.red }]}>{item.likes || 0}</Text>
        </View>
        <View style={styles.chip}>
          <MessageCircle size={12} color={TG.textHint} />
          <Text style={styles.chipText}>{item.commentsCount || 0}</Text>
        </View>
        {isTeacher && (
          <TouchableOpacity style={styles.reviewBtn} activeOpacity={0.7} onPress={() => openReviewModal(item)}>
            <Text style={styles.reviewBtnText}>Review</Text>
          </TouchableOpacity>
        )}
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
    </Pressable>
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

      <Modal visible={reviewModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Review Submission</Text>
            {selectedSub && (
              <Text style={styles.modalSubtitle} numberOfLines={2}>
                {selectedSub.user?.fullName} - {selectedSub.test?.title}
              </Text>
            )}
            <Text style={styles.inputLabel}>Score (0-75)</Text>
            <TextInput
              style={styles.input}
              value={score}
              onChangeText={setScore}
              keyboardType="number-pad"
              maxLength={2}
              placeholder="0-75"
              placeholderTextColor={TG.textHint}
            />
            <Text style={styles.inputLabel}>Feedback</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={feedback}
              onChangeText={setFeedback}
              multiline
              numberOfLines={4}
              placeholder="Write helpful feedback..."
              placeholderTextColor={TG.textHint}
              textAlignVertical="top"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} activeOpacity={0.7} onPress={() => setReviewModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, (!score || submitting) && { opacity: 0.5 }]}
                activeOpacity={0.7}
                onPress={handleReview}
                disabled={!score || submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Submit</Text>
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
  chipText: { fontSize: 12, color: TG.textHint, fontWeight: '500' },
  reviewBtn: { marginLeft: 'auto', backgroundColor: TG.accent, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10 },
  reviewBtnText: { fontSize: 12, fontWeight: '600', color: TG.textWhite },
  reviewsFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: TG.bg, borderBottomLeftRadius: 14, borderBottomRightRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginTop: 12, marginHorizontal: -12, marginBottom: -12, borderTopWidth: 1, borderTopColor: TG.separator },
  reviewsFooterLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reviewAvatars: { flexDirection: 'row', alignItems: 'center' },
  reviewAvatarCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: TG.accentLight, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: TG.bgSecondary, marginLeft: -8 },
  reviewAvatarImage: { width: '100%', height: '100%', borderRadius: 12 },
  reviewAvatarInitials: { fontSize: 10, color: TG.accent, fontWeight: '700' },
  reviewsFooterText: { fontSize: 13, color: TG.textPrimary, fontWeight: '600' },
  emptyContainer: { alignItems: 'center', marginTop: 80, gap: 12 },
  emptyText: { color: TG.textSecondary, fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: TG.bg, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: TG.textPrimary, marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: TG.textSecondary, marginBottom: 16, lineHeight: 18 },
  inputLabel: { fontSize: 13, color: TG.textSecondary, fontWeight: '600', marginBottom: 6 },
  input: { backgroundColor: TG.bgSecondary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: TG.textPrimary, borderWidth: 0.5, borderColor: TG.separator, marginBottom: 12 },
  textArea: { minHeight: 80 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10, backgroundColor: TG.bgSecondary },
  cancelBtnText: { color: TG.textSecondary, fontWeight: '600' },
  submitBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10, backgroundColor: TG.accent },
  submitBtnText: { color: TG.textWhite, fontWeight: '600' },
});