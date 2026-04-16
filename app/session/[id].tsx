import { useToast } from '@/components/Toast';
import WaveformPlayer from '@/components/WaveformPlayer';
import { TG } from '@/constants/theme';
import { apiFetchSessionDetail, apiUpdateSpeaking, SpeakingResponse, TestSession } from '@/lib/api';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  BarChart3,
  Bot,
  Calendar,
  ChevronRight,
  Clock,
  Globe,
  Loader,
  Lock,
  MessageSquare,
  Mic,
  Star,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
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

function ScoreRing({ score, max = 75 }: { score: number; max?: number }) {
  const pct = Math.min(score / max, 1);
  const color =
    pct >= 0.8 ? TG.green : pct >= 0.6 ? TG.accent : pct >= 0.4 ? TG.orange : TG.red;
  return (
    <View style={[styles.scoreRing, { borderColor: color }]}>
      <Text style={[styles.scoreRingText, { color }]}>{score}</Text>
      <Text style={styles.scoreRingMax}>/{max}</Text>
    </View>
  );
}

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [session, setSession] = useState<TestSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [visibilityUpdating, setVisibilityUpdating] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

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

  const handleToggleVisibility = async () => {
    if (!session || visibilityUpdating) return;

    const previousVisibility = session.visibility;
    const nextVisibility = previousVisibility === 'community' ? 'private' : 'community';
    const sessionId = session.id;

    // Optimistic update so icon/state changes immediately.
    setSession((prev) => (prev ? { ...prev, visibility: nextVisibility } : prev));
    setVisibilityUpdating(true);

    try {
      await apiUpdateSpeaking(sessionId, nextVisibility);
      toast.success('Visibility', nextVisibility === 'community' ? 'Shared to community' : 'Set to private');
    } catch (e: any) {
      // Roll back if API call fails.
      setSession((prev) => (prev ? { ...prev, visibility: previousVisibility } : prev));
      toast.error('Error', e.message || 'Failed to update visibility');
    } finally {
      setVisibilityUpdating(false);
    }
  };

  const responses = session?.responses || [];

  const renderResponse = ({ item, index }: { item: SpeakingResponse; index: number }) => {
    const question = item.question;
    const hasReview = item.teacherScore != null;
    const partColor = PART_COLORS[question?.part || '']?.fg || TG.accent;

    return (
      <View style={styles.responseCard}>
        {/* Card header: index + part badge */}
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

        {/* Review section */}
        {hasReview && (
          <View style={styles.reviewSection}>
            <View style={styles.reviewTop}>
              <ScoreRing score={item.teacherScore!} max={session?.examType === 'ielts' ? 9 : 75} />
              <View style={styles.reviewMeta}>
                <Text style={styles.reviewLabel}>Teacher Review</Text>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      size={12}
                      color={TG.orange}
                      fill={s <= Math.round((item.teacherScore! / 75) * 5) ? TG.orange : 'transparent'}
                    />
                  ))}
                </View>
              </View>
            </View>
            {item.teacherFeedback ? (
              <View style={styles.feedbackBox}>
                <MessageSquare size={12} color={TG.textHint} />
                <Text style={styles.feedbackText}>{item.teacherFeedback}</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* AI Feedback button */}
        <TouchableOpacity
          style={styles.aiFeedbackBtn}
          onPress={() => router.push(`/ai-feedback/${item.id}` as any)}
          activeOpacity={0.7}
        >
          <Bot size={16} color={TG.aiFeedback} />
          <Text style={styles.aiFeedbackBtnText}>AI Feedback</Text>
          <ChevronRight size={16} color={TG.textHint} />
        </TouchableOpacity>
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
            {session?.test?.title || 'Session Detail'}
          </Text>
          {session && (
            <Text style={styles.headerSub}>
              {responses.length} response{responses.length !== 1 ? 's' : ''}
            </Text>
          )}
        </View>
        <TouchableOpacity
          onPress={handleToggleVisibility}
          activeOpacity={0.7}
          disabled={visibilityUpdating}
          style={visibilityUpdating ? { opacity: 0.7 } : undefined}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {visibilityUpdating ? (
            <ActivityIndicator size="small" color={TG.textWhite} />
          ) : session?.visibility === 'community' ? (
            <Globe size={22} color={TG.textWhite} />
          ) : (
            <Lock size={22} color={'rgba(255,255,255,0.5)'} />
          )}
        </TouchableOpacity>
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
                  {session.cefrLevel && (
                    <CefrBadge level={session.cefrLevel} />
                  )}
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
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Mic size={44} color={TG.separator} />
                <Text style={styles.emptyText}>No responses recorded</Text>
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
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
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

  // ─── Part badge ───
  partBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  partText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },

  // ─── CEFR ───
  cefrBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10 },
  cefrText: { fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },

  // ─── Review ───
  reviewSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: TG.separator,
  },
  reviewTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  scoreRing: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreRingText: { fontSize: 15, fontWeight: '800', lineHeight: 18 },
  scoreRingMax: { fontSize: 9, color: TG.textHint, marginTop: -2 },
  reviewMeta: { gap: 4 },
  reviewLabel: { fontSize: 12, color: TG.textSecondary, fontWeight: '500' },
  starsRow: { flexDirection: 'row', gap: 2 },
  feedbackBox: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    backgroundColor: TG.bgSecondary,
    borderRadius: 10,
    padding: 10,
  },
  feedbackText: { fontSize: 13, color: TG.textSecondary, lineHeight: 19, flex: 1 },
  aiFeedbackBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: TG.aiFeedbackLight, borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 14, marginTop: 12,
  },
  aiFeedbackBtnText: {
    flex: 1, fontSize: 13, fontWeight: '600', color: TG.aiFeedback,
  },

  // ─── Empty ───
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: { color: TG.textSecondary, fontSize: 16, fontWeight: '600' },
});
