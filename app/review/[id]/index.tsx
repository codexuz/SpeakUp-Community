import { useToast } from '@/components/Toast';
import WaveformPlayer from '@/components/WaveformPlayer';
import { TG } from '@/constants/theme';
import {
  apiFetchReviews,
  apiFetchSessionDetail,
  SpeakingResponse,
  TestSession,
} from '@/lib/api';
import { useAuth } from '@/store/auth';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  BarChart3,
  Calendar,
  ChevronRight,
  Clock,
  Loader,
  MessageSquare,
  Mic,
  Star,
} from 'lucide-react-native';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  StyleSheet,
  Text,
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
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher';
  const [session, setSession] = useState<TestSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<any[]>([]);
  const [hasMyReview, setHasMyReview] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadSession = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [data, reviews] = await Promise.all([
        apiFetchSessionDetail(id),
        apiFetchReviews(id).catch(() => []),
      ]);
      setSession(data);
      setReviews(reviews || []);
      setHasMyReview(
        (reviews || []).some((r: any) => r.reviewerId === user?.id),
      );
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
  }, [id, user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadSession();
    }, [loadSession])
  );

  const openReviewEdit = () => {
    if (!session) return;
    router.push(`/review/${session.id}/edit` as any);
  };

  const hasSessionReview = session?.scoreAvg != null;

  const responses = session?.responses || [];

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
        <Animated.View style={{ flex: 1, opacity: fadeAnim, backgroundColor: TG.bgSecondary }}>
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
                      text={`Avg ${session.scoreAvg.toFixed(session.examType === 'ielts' ? 1 : 0)}`}
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
                <View style={{ gap: 10, marginTop: 16 }}>
                  {/* Reviews List */}
                  {reviews.length > 0 && (
                    <View style={styles.reviewsListSection}>
                      <Text style={styles.reviewsListTitle}>Reviews ({reviews.length})</Text>
                      {reviews.map((rev: any) => {
                        const isOwn = rev.reviewerId === user?.id;
                        const cefrInfo = getCefrLabel(rev.score);
                        return (
                          <TouchableOpacity
                            key={rev.id}
                            style={styles.reviewListItem}
                            activeOpacity={isOwn && isTeacher ? 0.7 : 1}
                            onPress={() => isOwn && isTeacher ? router.push(`/review/${id}/edit` as any) : null}
                            disabled={!isOwn || !isTeacher}
                          >
                            <View style={styles.reviewListAvatar}>
                              {rev.reviewer?.avatarUrl ? (
                                <Image source={{ uri: rev.reviewer.avatarUrl }} style={styles.reviewListAvatarImage} />
                              ) : (
                                <Text style={styles.reviewListAvatarText}>
                                  {(rev.reviewer?.fullName || '?').charAt(0)}
                                </Text>
                              )}
                            </View>
                            <View style={styles.reviewListBody}>
                              <View style={styles.reviewListTop}>
                                <Text style={styles.reviewListName} numberOfLines={1}>
                                  {rev.reviewer?.fullName || 'Reviewer'}
                                  {isOwn ? ' (You)' : ''}
                                </Text>
                                <View style={[styles.reviewListCefr, { backgroundColor: cefrInfo.bg }]}>
                                  <Text style={[styles.reviewListCefrText, { color: cefrInfo.color }]}>{cefrInfo.level}</Text>
                                </View>
                                <Text style={styles.reviewListScore}>
                                  {rev.score}{session?.examType === 'ielts' ? ' / 9.0' : ' / 75'}
                                </Text>
                              </View>
                              {rev.feedback ? (
                                <View style={styles.reviewListFeedbackRow}>
                                  <MessageSquare size={11} color={TG.textHint} />
                                  <Text style={styles.reviewListFeedback} numberOfLines={2}>{rev.feedback}</Text>
                                </View>
                              ) : null}
                              <Text style={styles.reviewListDate}>
                                {new Date(rev.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </Text>
                            </View>
                            {isOwn && isTeacher && <ChevronRight size={16} color={TG.textHint} />}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}

                  {/* Teacher-only: Add/Edit Review button */}
                  {isTeacher && (
                    <TouchableOpacity
                      style={[styles.reviewBtn, hasSessionReview && styles.reviewBtnEdit]}
                      activeOpacity={0.7}
                      onPress={openReviewEdit}
                    >
                      <Star size={16} color={hasSessionReview ? TG.accent : TG.textWhite} />
                      <Text style={[styles.reviewBtnText, hasSessionReview && styles.reviewBtnEditText]}>
                        {hasMyReview ? 'Edit My Review' : 'Add Review'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
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

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TG.headerBg },
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: TG.bgSecondary },

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

  // ─── Reviews list ───
  reviewsListSection: {
    backgroundColor: TG.bg,
    borderRadius: 14,
    padding: 14,
    gap: 0,
  },
  reviewsListTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: TG.textPrimary,
    marginBottom: 12,
  },
  reviewListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: TG.separator,
  },
  reviewListAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: TG.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewListAvatarImage: { width: '100%', height: '100%', borderRadius: 18 },
  reviewListAvatarText: { fontSize: 14, fontWeight: '700', color: TG.accent },
  reviewListBody: { flex: 1 },
  reviewListTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  reviewListName: { fontSize: 13, fontWeight: '600', color: TG.textPrimary, flexShrink: 1 },
  reviewListCefr: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  reviewListCefrText: { fontSize: 10, fontWeight: '800' },
  reviewListScore: { fontSize: 12, fontWeight: '700', color: TG.orange },
  reviewListFeedbackRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginTop: 2 },
  reviewListFeedback: { fontSize: 12, color: TG.textSecondary, lineHeight: 17, flex: 1 },
  reviewListDate: { fontSize: 10, color: TG.textHint, marginTop: 2 },

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: { color: TG.textSecondary, fontSize: 16, fontWeight: '600' },
});
