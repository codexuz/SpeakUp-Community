import { useToast } from '@/components/Toast';
import WaveformPlayer from '@/components/WaveformPlayer';
import { TG } from '@/constants/theme';
import {
    apiFetchSessionDetail,
    apiPostReview,
    SpeakingResponse,
    TestSession,
} from '@/lib/api';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    ArrowLeft,
    BarChart3,
    Calendar,
    Clock,
    Loader,
    Mic,
    Star
} from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
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

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const CEFR_COLORS: Record<string, { fg: string; bg: string }> = {
  A1: { fg: TG.red, bg: TG.redLight },
  A2: { fg: TG.orange, bg: TG.orangeLight },
  B1: { fg: TG.accent, bg: TG.accentLight },
  B2: { fg: TG.green, bg: TG.greenLight },
  C1: { fg: TG.purple, bg: TG.purpleLight },
  C2: { fg: TG.purple, bg: TG.purpleLight },
};

const PART_COLORS: Record<string, { fg: string; bg: string }> = {
  'Part 1': { fg: TG.accent, bg: TG.accentLight },
  'Part 2': { fg: TG.green, bg: TG.greenLight },
  'Part 3': { fg: TG.purple, bg: TG.purpleLight },
};

function getCefrLabel(score: number): { level: string; color: string; bg: string } {
  if (score <= 37) return { level: 'A2', color: TG.red, bg: TG.redLight };
  if (score <= 50) return { level: 'B1', color: TG.orange, bg: TG.orangeLight };
  if (score <= 64) return { level: 'B2', color: TG.accent, bg: TG.accentLight };
  return { level: 'C1', color: TG.green, bg: TG.greenLight };
}

function CefrBadge({ level }: { level: string | null }) {
  if (!level) return null;
  const c = CEFR_COLORS[level] || { fg: TG.accent, bg: TG.accentLight };
  return (
    <View style={[styles.cefrBadge, { backgroundColor: c.bg }]}>
      <Text style={[styles.cefrText, { color: c.fg }]}>{level}</Text>
    </View>
  );
}

function PartBadge({ part }: { part: string }) {
  const c = PART_COLORS[part] || { fg: TG.accent, bg: TG.accentLight };
  return (
    <View style={[styles.partBadge, { backgroundColor: c.bg }]}>
      <Text style={[styles.partText, { color: c.fg }]}>{part}</Text>
    </View>
  );
}

function MetaChip({ icon, text, color }: { icon: React.ReactNode; text: string; color?: string }) {
  return (
    <View style={[styles.metaChip, color ? { backgroundColor: `${color}10` } : undefined]}>
      {icon}
      <Text style={[styles.metaChipText, color ? { color } : undefined]}>{text}</Text>
    </View>
  );
}

export default function ReviewDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [session, setSession] = useState<TestSession | null>(null);
  const [loading, setLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Review modal state
  const [reviewModal, setReviewModal] = useState(false);
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadSession = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await apiFetchSessionDetail(id);
      setSession(data);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }).start();
    } catch (e: any) {
      toast.error('Error', e.message || 'Failed to load session');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const openReview = () => {
    if (!session) return;
    setScore(session.scoreAvg != null ? String(Math.round(session.scoreAvg)) : '');
    setFeedback('');
    setReviewModal(true);
  };

  const handleSubmitReview = async () => {
    if (!session || !score) return;
    const numScore = parseInt(score, 10);
    if (isNaN(numScore) || numScore < 0 || numScore > 75) {
      toast.warning('Invalid', 'Score must be between 0 and 75');
      return;
    }
    setSubmitting(true);
    try {
      await apiPostReview(session.id, numScore, feedback);
      toast.success('Reviewed', 'Score submitted successfully');
      setReviewModal(false);
      loadSession();
    } catch (e: any) {
      toast.error('Error', e.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const hasSessionReview = session?.scoreAvg != null;

  const responses = session?.responses || [];
  const scoreNum = parseInt(score, 10);
  const scorePreview =
    !isNaN(scoreNum) && scoreNum >= 0 && scoreNum <= 75 ? getCefrLabel(scoreNum) : null;

  const renderResponse = ({ item, index }: { item: SpeakingResponse; index: number }) => {
    const question = item.question;
    const partColor = PART_COLORS[question?.part || '']?.fg || TG.accent;

    return (
      <View style={styles.responseCard}>
        {/* Card header */}
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.indexCircle, { backgroundColor: `${partColor}14` }]}>
              <Text style={[styles.indexText, { color: partColor }]}>{index + 1}</Text>
            </View>
            {question && <PartBadge part={question.part} />}
          </View>
          {question && (
            <View style={styles.timerChip}>
              <Clock size={11} color={TG.textHint} />
              <Text style={styles.timerChipText}>
                {formatDuration(question.speakingTimer)}
              </Text>
            </View>
          )}
        </View>

        {/* Question text */}
        <Text style={styles.questionText} numberOfLines={3}>
          {question?.qText || 'Question'}
        </Text>

        {/* Waveform Player */}
        <View style={styles.waveformWrapper}>
          {item.remoteUrl ? (
            <WaveformPlayer
              uri={item.remoteUrl}
              accentColor={partColor}
              disabled={!item.audioProcessed}
            />
          ) : (
            <View style={styles.noAudioRow}>
              <Loader size={14} color={TG.textHint} />
              <Text style={styles.noAudioText}>Audio not available</Text>
            </View>
          )}
          {!item.audioProcessed && item.remoteUrl && (
            <View style={styles.processingPill}>
              <ActivityIndicator size={10} color={TG.orange} />
              <Text style={styles.processingText}>Processing audio…</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={22} color={TG.textWhite} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {session?.test?.title || 'Review Session'}
          </Text>
          {session?.user && (
            <Text style={styles.headerSub}>
              {session.user.fullName} · {responses.length} response{responses.length !== 1 ? 's' : ''}
            </Text>
          )}
        </View>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={TG.accent} />
        </View>
      ) : !session ? (
        <View style={styles.centered}>
          <Mic size={48} color={TG.separator} />
          <Text style={styles.emptyText}>Session not found</Text>
        </View>
      ) : (
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <FlatList
            data={responses}
            keyExtractor={(item) => item.id}
            renderItem={renderResponse}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            ListHeaderComponent={
              <View style={styles.summaryCard}>
                <View style={styles.metaRow}>
                  <MetaChip
                    icon={<Mic size={13} color={TG.accent} />}
                    text={`${responses.length} response${responses.length !== 1 ? 's' : ''}`}
                    color={TG.accent}
                  />
                  {session.scoreAvg != null && (
                    <MetaChip
                      icon={<BarChart3 size={13} color={TG.orange} />}
                      text={`Avg ${session.scoreAvg.toFixed(0)}`}
                      color={TG.orange}
                    />
                  )}
                  {session.cefrLevel && <CefrBadge level={session.cefrLevel} />}
                  <View style={styles.metaSpacer} />
                  <View style={styles.dateChip}>
                    <Calendar size={11} color={TG.textHint} />
                    <Text style={styles.dateChipText}>
                      {new Date(session.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                </View>
              </View>
            }
            ListFooterComponent={
              responses.length > 0 ? (
                <TouchableOpacity
                  style={[styles.reviewBtn, hasSessionReview && styles.reviewBtnEdit]}
                  activeOpacity={0.7}
                  onPress={openReview}
                >
                  <Star size={16} color={hasSessionReview ? TG.accent : TG.textWhite} />
                  <Text style={[styles.reviewBtnText, hasSessionReview && styles.reviewBtnEditText]}>
                    {hasSessionReview ? 'Edit Review' : 'Add Review'}
                  </Text>
                </TouchableOpacity>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Mic size={44} color={TG.separator} />
                <Text style={styles.emptyText}>No responses in this session</Text>
              </View>
            }
          />
        </Animated.View>
      )}

      {/* Review Modal */}
      <Modal visible={reviewModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {hasSessionReview ? 'Edit Review' : 'Add Review'}
              </Text>

              <Text style={styles.modalQuestion} numberOfLines={1}>
                {session?.test?.title || 'Session'} · {responses.length} response{responses.length !== 1 ? 's' : ''}
              </Text>

              <View style={styles.scoreRow}>
                <View style={{ flex: 1 }}>
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
                </View>
                {scorePreview && (
                  <View style={[styles.cefrPreview, { backgroundColor: scorePreview.bg }]}>
                    <Text style={[styles.cefrPreviewText, { color: scorePreview.color }]}>
                      {scorePreview.level}
                    </Text>
                  </View>
                )}
              </View>

              <Text style={styles.cefrGuide}>
                A2: 0-37 · B1: 38-50 · B2: 51-64 · C1: 65-75
              </Text>

              <Text style={styles.inputLabel}>Feedback</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
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
                  onPress={() => setReviewModal(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitBtn, (!score || submitting) && { opacity: 0.5 }]}
                  onPress={handleSubmitReview}
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
  safeArea: { flex: 1, backgroundColor: TG.bgSecondary },
  header: {
    backgroundColor: TG.headerBg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: TG.textWhite },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },

  // ─── Summary card ───
  summaryCard: {
    backgroundColor: TG.bg,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: TG.bgSecondary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  metaChipText: { fontSize: 12, fontWeight: '600', color: TG.textSecondary },
  metaSpacer: { flex: 1 },
  dateChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateChipText: { fontSize: 11, color: TG.textHint },

  // ─── Response card ───
  listContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100 },
  responseCard: {
    backgroundColor: TG.bg,
    borderRadius: 16,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  indexCircle: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexText: { fontSize: 13, fontWeight: '800' },
  timerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: TG.bgSecondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  timerChipText: { fontSize: 11, color: TG.textHint, fontWeight: '600' },
  questionText: {
    fontSize: 14,
    color: TG.textPrimary,
    lineHeight: 21,
    marginBottom: 12,
  },

  // ─── Waveform ───
  waveformWrapper: {
    backgroundColor: TG.bgSecondary,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  noAudioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  noAudioText: { fontSize: 13, color: TG.textHint },
  processingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    alignSelf: 'center',
  },
  processingText: { fontSize: 11, color: TG.orange, fontWeight: '500' },

  // ─── Badges ───
  partBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  partText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  cefrBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10 },
  cefrText: { fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
  reviewedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: TG.greenLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  reviewedTagText: { fontSize: 10, fontWeight: '700', color: TG.green },

  // ─── Review display ───
  reviewDisplay: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: TG.separator,
  },
  reviewDisplayTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reviewDisplayScore: { fontSize: 14, fontWeight: '700', color: TG.orange },
  reviewDisplayFeedback: {
    fontSize: 12,
    color: TG.textSecondary,
    flex: 1,
    marginLeft: 4,
  },

  // ─── Review button ───
  reviewBtn: {
    backgroundColor: TG.green,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  reviewBtnEdit: { backgroundColor: TG.bgSecondary },
  reviewBtnText: { fontSize: 15, fontWeight: '700', color: TG.textWhite },
  reviewBtnEditText: { color: TG.accent },

  // ─── Modal ───
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: TG.bg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: TG.textPrimary, marginBottom: 6 },
  modalQuestion: {
    fontSize: 13,
    color: TG.textSecondary,
    lineHeight: 19,
    marginBottom: 14,
  },
  scoreRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  cefrPreview: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  cefrPreviewText: { fontSize: 16, fontWeight: '700' },
  cefrGuide: { fontSize: 11, color: TG.textHint, marginBottom: 12 },
  inputLabel: {
    fontSize: 13,
    color: TG.textSecondary,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    backgroundColor: TG.bgSecondary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: TG.textPrimary,
    borderWidth: 0.5,
    borderColor: TG.separator,
    marginBottom: 12,
  },
  textArea: { minHeight: 80 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: TG.bgSecondary,
  },
  cancelBtnText: { color: TG.textSecondary, fontWeight: '600' },
  submitBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: TG.accent,
  },
  submitBtnText: { color: TG.textWhite, fontWeight: '600' },

  // ─── Empty ───
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: { color: TG.textSecondary, fontSize: 16, fontWeight: '600' },
});
