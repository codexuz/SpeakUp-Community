import { TG } from '@/constants/theme';
import { apiFetchCommunityFeed, apiLikeSpeaking, apiPostReview, apiUnlikeSpeaking } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { useFocusEffect } from '@react-navigation/native';
import { Flame, Heart, MessageCircle, Star, TrendingUp } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Strategy = 'latest' | 'trending' | 'top';

export default function CommunityScreen() {
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher';

  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [strategy, setStrategy] = useState<Strategy>('latest');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [reviewModal, setReviewModal] = useState(false);
  const [selectedSub, setSelectedSub] = useState<any>(null);
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadFeed = async (s: Strategy = strategy, p = 1, append = false) => {
    if (p === 1) setLoading(true);
    else setLoadingMore(true);
    try {
      const result = await apiFetchCommunityFeed(s, p);
      const items = result.data || [];
      if (append) {
        setSubmissions(prev => [...prev, ...items]);
      } else {
        setSubmissions(items);
      }
      setHasMore(p < result.pagination.totalPages);
      setPage(p);
    } catch (e) {
      console.error('Failed to load community feed', e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadFeed(strategy, 1);
    }, [strategy])
  );

  const changeStrategy = (s: Strategy) => {
    setStrategy(s);
    setPage(1);
    setHasMore(true);
  };

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      loadFeed(strategy, page + 1, true);
    }
  };

  const toggleLike = async (item: any) => {
    try {
      if (item.isLiked) {
        await apiUnlikeSpeaking(item.id);
        setSubmissions(prev => prev.map(s => s.id === item.id ? { ...s, isLiked: false, likes: (s.likes || 1) - 1 } : s));
      } else {
        await apiLikeSpeaking(item.id);
        setSubmissions(prev => prev.map(s => s.id === item.id ? { ...s, isLiked: true, likes: (s.likes || 0) + 1 } : s));
      }
    } catch (e: any) {
      console.warn('Like error', e.message);
    }
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
      Alert.alert('Invalid', 'Score must be between 0 and 75');
      return;
    }
    setSubmitting(true);
    try {
      await apiPostReview(selectedSub.id, numScore, feedback);
      setReviewModal(false);
      loadFeed(strategy, 1);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(item.user?.fullName || '?').charAt(0)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.userName}>{item.user?.fullName || 'Unknown'}</Text>
          <Text style={styles.userHandle}>@{item.user?.username || '?'}</Text>
        </View>
        {item.scoreAvg != null && (
          <View style={styles.scorePill}>
            <Star size={12} color={TG.orange} fill={TG.orange} />
            <Text style={styles.scoreText}>{item.scoreAvg.toFixed(1)}</Text>
          </View>
        )}
      </View>

      <Text style={styles.questionText} numberOfLines={3}>
        {item.test?.title || 'Unknown Test'}
      </Text>
      <Text style={styles.metaText}>{item._count?.responses || 0} responses · {new Date(item.createdAt).toLocaleDateString()}</Text>

      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.actionBtn} activeOpacity={0.6} onPress={() => toggleLike(item)}>
          <Heart size={18} color={item.isLiked ? TG.red : TG.textHint} fill={item.isLiked ? TG.red : 'none'} />
          <Text style={[styles.actionText, item.isLiked && { color: TG.red }]}>{item.likes || 0}</Text>
        </TouchableOpacity>
        <View style={styles.actionBtn}>
          <MessageCircle size={18} color={TG.textHint} />
          <Text style={styles.actionText}>{item.commentsCount || 0}</Text>
        </View>
        {isTeacher && (
          <TouchableOpacity style={styles.reviewBtn} activeOpacity={0.7} onPress={() => openReviewModal(item)}>
            <Text style={styles.reviewBtnText}>Review</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
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

      {loading ? (
        <ActivityIndicator size="large" color={TG.accent} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
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
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TG.bgSecondary },
  header: { backgroundColor: TG.headerBg, paddingHorizontal: 16, paddingVertical: 14 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: TG.textWhite },
  tabBar: { flexDirection: 'row', backgroundColor: TG.bg, paddingHorizontal: 12, paddingVertical: 8, gap: 8, borderBottomWidth: 0.5, borderBottomColor: TG.separator },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: TG.bgSecondary },
  tabActive: { backgroundColor: TG.accent },
  tabText: { fontSize: 13, fontWeight: '600', color: TG.textSecondary },
  tabTextActive: { color: TG.textWhite },
  listContent: { paddingBottom: 100 },
  card: { backgroundColor: TG.bg, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: TG.separatorLight },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: TG.accentLight, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 16, fontWeight: '700', color: TG.accent },
  userName: { fontSize: 15, fontWeight: '600', color: TG.textPrimary },
  userHandle: { fontSize: 12, color: TG.textSecondary },
  scorePill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: TG.orangeLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  scoreText: { fontSize: 13, fontWeight: '700', color: TG.orange },
  questionText: { fontSize: 15, color: TG.textPrimary, lineHeight: 21, marginBottom: 4 },
  metaText: { fontSize: 12, color: TG.textHint, marginBottom: 10 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: { fontSize: 13, color: TG.textHint, fontWeight: '500' },
  reviewBtn: { marginLeft: 'auto', backgroundColor: TG.accent, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14 },
  reviewBtnText: { fontSize: 13, fontWeight: '600', color: TG.textWhite },
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