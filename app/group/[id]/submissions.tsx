import { useAlert } from '@/components/CustomAlert';
import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import { apiPostReview } from '@/lib/api';
import {
    fetchGroupById,
    fetchGroupSubmissions,
    Group,
} from '@/lib/groups';
import { useAuth } from '@/store/auth';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    ArrowLeft,
    Award,
    Star,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function GroupSubmissionsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { alert } = useAlert();

  const [group, setGroup] = useState<Group | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [subPage, setSubPage] = useState(1);
  const [hasMoreSubs, setHasMoreSubs] = useState(true);

  // Review modal
  const [reviewModal, setReviewModal] = useState(false);
  const [selectedSub, setSelectedSub] = useState<any>(null);
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [g, sResult] = await Promise.all([
        fetchGroupById(id),
        fetchGroupSubmissions(id, 1),
      ]);
      setGroup(g);
      setSubmissions(sResult?.data || []);
      setHasMoreSubs(1 < (sResult?.pagination?.totalPages ?? 1));
      setSubPage(1);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadMoreSubs = async () => {
    if (!hasMoreSubs || !id) return;
    const next = subPage + 1;
    try {
      const result = await fetchGroupSubmissions(id, next);
      setSubmissions((prev) => [...prev, ...(result?.data || [])]);
      setHasMoreSubs(next < (result?.pagination?.totalPages ?? 1));
      setSubPage(next);
    } catch (e) {
      console.error(e);
    }
  };

  const openReviewModal = (sub: any) => {
    setSelectedSub(sub);
    setScore(sub.scoreAvg?.toString() || '');
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
      loadData();
    } catch (e: any) {
      toast.error('Error', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft size={22} color={TG.textWhite} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Submissions</Text>
          <Text style={styles.headerSub}>
            {submissions.length} total
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={TG.accent} />
        </View>
      ) : (
        <FlatList
          data={submissions}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMoreSubs}
          onEndReachedThreshold={0.3}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item: sub }) => (
            <View style={styles.subCard}>
              <View style={styles.subHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.subStudent}>
                    {sub.user?.fullName || 'Unknown'}
                  </Text>
                  <Text style={styles.subQuestion} numberOfLines={2}>
                    {sub.test?.title || 'Unknown Test'}
                  </Text>
                  <Text style={styles.subMeta}>
                    {sub._count?.responses || 0} responses
                    {sub.cefrLevel ? ` · ${sub.cefrLevel}` : ''}
                  </Text>
                </View>
                {sub.scoreAvg != null ? (
                  <View style={styles.scoreBadge}>
                    <Star size={13} color={TG.orange} fill={TG.orange} />
                    <Text style={styles.scoreBadgeText}>
                      {Number(sub.scoreAvg).toFixed(1)}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingBadgeText}>NEW</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={styles.reviewBtn}
                activeOpacity={0.7}
                onPress={() => openReviewModal(sub)}
              >
                <Text style={styles.reviewBtnText}>Review</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Award size={40} color={TG.separator} />
              <Text style={styles.emptyText}>No submissions yet</Text>
            </View>
          }
        />
      )}

      {/* Review Modal */}
      <Modal visible={reviewModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
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
                style={styles.modalInput}
                value={score}
                onChangeText={setScore}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="0-75"
                placeholderTextColor={TG.textHint}
              />
              <Text style={styles.inputLabel}>Feedback</Text>
              <TextInput
                style={[styles.modalInput, styles.textArea]}
                value={feedback}
                onChangeText={setFeedback}
                multiline
                numberOfLines={4}
                placeholder="Write feedback..."
                placeholderTextColor={TG.textHint}
                textAlignVertical="top"
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  activeOpacity={0.7}
                  onPress={() => setReviewModal(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.submitBtn,
                    (!score || submitting) && { opacity: 0.5 },
                  ]}
                  activeOpacity={0.7}
                  onPress={handleReview}
                  disabled={!score || submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color={TG.textWhite} />
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
  safe: { flex: 1, backgroundColor: TG.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TG.headerBg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: TG.textWhite },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },

  listContent: { paddingVertical: 6, paddingBottom: 40 },
  sep: { height: 8 },

  subCard: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  subStudent: {
    fontSize: 15,
    fontWeight: '600',
    color: TG.accent,
    marginBottom: 2,
  },
  subQuestion: { fontSize: 14, color: TG.textSecondary, lineHeight: 20 },
  subMeta: { fontSize: 12, color: TG.textHint, marginTop: 2 },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: TG.orangeLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  scoreBadgeText: { fontSize: 14, fontWeight: '700', color: TG.orange },
  pendingBadge: {
    backgroundColor: TG.accentLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pendingBadgeText: { fontSize: 11, fontWeight: '700', color: TG.accent },
  reviewBtn: {
    alignSelf: 'flex-start',
    backgroundColor: TG.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  reviewBtnText: { color: TG.textWhite, fontWeight: '600', fontSize: 14 },

  emptyText: { color: TG.textSecondary, fontSize: 15 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: TG.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TG.textPrimary,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: TG.textSecondary,
    marginBottom: 20,
    lineHeight: 20,
  },
  inputLabel: {
    fontSize: 13,
    color: TG.textSecondary,
    fontWeight: '600',
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: TG.bgSecondary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: TG.textPrimary,
    borderWidth: 0.5,
    borderColor: TG.separator,
    marginBottom: 16,
  },
  textArea: { minHeight: 100 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: TG.bgSecondary,
  },
  cancelBtnText: { color: TG.textSecondary, fontWeight: '600' },
  submitBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: TG.accent,
  },
  submitBtnText: { color: TG.textWhite, fontWeight: '600' },
});
