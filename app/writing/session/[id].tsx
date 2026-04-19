import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import { apiFetchWritingSession, apiFetchWritingSessionFeedbacks } from '@/lib/api';
import type { WritingResponse, WritingSession, WritingSessionFeedbackResponse } from '@/lib/types';
import { getScoreColor } from '@/lib/types';
import { useAuth } from '@/store/auth';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Pen,
  Star,
  User,
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export default function WritingSessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [session, setSession] = useState<WritingSession | null>(null);
  const [feedbacks, setFeedbacks] = useState<WritingSessionFeedbackResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      apiFetchWritingSession(id),
      apiFetchWritingSessionFeedbacks(id),
    ])
      .then(([s, f]) => {
        setSession(s);
        setFeedbacks(f);
      })
      .catch((e: any) => toast.error('Error', e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const isTeacher = user?.role === 'admin' || (user?.role === 'teacher' && user?.verifiedTeacher);
  const canReview = isTeacher && !(session?.reviews?.length);
  const isReviewed = !!(session?.reviews?.length);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={TG.headerBg} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <ArrowLeft size={22} color={TG.textWhite} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Writing Session</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={TG.aiFeedback} />
          <Text style={styles.loadingText}>Loading session...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={TG.headerBg} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <ArrowLeft size={22} color={TG.textWhite} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Writing Session</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.loadingContainer}>
          <AlertTriangle size={40} color={TG.red} />
          <Text style={styles.errorText}>Session not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={TG.headerBg} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={22} color={TG.textWhite} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Writing Session</Text>
        {canReview ? (
          <TouchableOpacity
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => router.push({ pathname: '/writing/review/[sessionId]', params: { sessionId: id } } as any)}
          >
            <Pen size={20} color={TG.textWhite} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 22 }} />
        )}
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── Session Info ────────────────── */}
        <View style={styles.sectionCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Test</Text>
            <Text style={styles.infoValue} numberOfLines={1}>{(session as any).test?.title || 'Test'}</Text>
          </View>
          <View style={styles.infoSeparator} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status</Text>
            <View style={[styles.statusBadge, { backgroundColor: isReviewed ? TG.greenLight : TG.orangeLight }]}>
              {isReviewed ? (
                <CheckCircle2 size={12} color={TG.green} />
              ) : (
                <Clock size={12} color={TG.orange} />
              )}
              <Text style={[styles.statusText, { color: isReviewed ? TG.green : TG.orange }]}>
                {isReviewed ? 'Reviewed' : 'Pending'}
              </Text>
            </View>
          </View>
          {session.scoreAvg != null && (
            <>
              <View style={styles.infoSeparator} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Overall Score</Text>
                <View style={styles.overallScoreRow}>
                  <View style={[styles.miniScoreCircle, { borderColor: getScoreColor(Math.round((session.scoreAvg / 9) * 100)) }]}>
                    <Text style={[styles.miniScoreValue, { color: getScoreColor(Math.round((session.scoreAvg / 9) * 100)) }]}>
                      {session.scoreAvg}
                    </Text>
                  </View>
                </View>
              </View>
            </>
          )}
        </View>

        {/* ── Teacher Review ────────────── */}
        {session.reviews?.[0] && (
          <View style={[styles.sectionCard, { backgroundColor: TG.greenLight }]}>
            <View style={styles.sectionHeader}>
              <User size={16} color={TG.green} />
              <Text style={[styles.sectionTitle, { color: TG.green }]}>Teacher Review</Text>
            </View>
            <View style={styles.reviewContent}>
              <View style={styles.reviewScoreRow}>
                <Star size={16} color={TG.gold} fill={TG.gold} />
                <Text style={styles.reviewScoreValue}>{session.reviews[0].score}</Text>
                <Text style={styles.reviewScoreMax}>/9</Text>
              </View>
              {session.reviews[0].feedback && (
                <Text style={styles.reviewFeedbackText}>{session.reviews[0].feedback}</Text>
              )}
              {session.reviews[0].reviewer && (
                <Text style={styles.reviewerName}>
                  — {session.reviews[0].reviewer.fullName}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* ── Responses ──────────────────── */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <FileText size={16} color={TG.accent} />
            <Text style={styles.sectionTitle}>Responses</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{(session.responses || []).length}</Text>
            </View>
          </View>
          {(session.responses || []).map((response: WritingResponse, index: number) => {
            const fb = feedbacks?.feedbacks?.find((f) => f.responseId === response.id);
            const wordCount = response.essayText.trim().split(/\s+/).filter(Boolean).length;

            return (
              <View key={response.id} style={styles.responseItem}>
                {/* Response header */}
                <View style={styles.responseItemHeader}>
                  <View style={styles.partBadge}>
                    <Text style={styles.partBadgeText}>{(response as any).task?.part || `Task ${index + 1}`}</Text>
                  </View>
                  <View style={styles.responseMeta}>
                    <View style={styles.metaPill}>
                      <Clock size={10} color={TG.textHint} />
                      <Text style={styles.metaPillText}>{formatTime(response.timeTakenSec || 0)}</Text>
                    </View>
                    <View style={styles.metaPill}>
                      <Text style={styles.metaPillText}>{wordCount} words</Text>
                    </View>
                  </View>
                </View>

                {/* Essay preview */}
                <Text style={styles.essayPreview} numberOfLines={4}>
                  {response.essayText}
                </Text>

                {/* AI Feedback button */}
                {fb && (
                  <TouchableOpacity
                    style={styles.aiFeedbackBtn}
                    activeOpacity={0.7}
                    onPress={() => router.push({ pathname: '/writing/ai-feedback/[responseId]', params: { responseId: String(response.id) } } as any)}
                  >
                    <Bot size={16} color={TG.aiFeedback} />
                    <Text style={styles.aiFeedbackBtnText}>AI Feedback</Text>
                    <View style={{ flex: 1 }} />
                    {fb.overallScore != null && (
                      <View style={[styles.aiFeedbackScorePill, { backgroundColor: getScoreColor(Math.round((fb.overallScore / 9) * 100)) + '20' }]}>
                        <Text style={[styles.aiFeedbackScoreText, { color: getScoreColor(Math.round((fb.overallScore / 9) * 100)) }]}>
                          {fb.overallScore}
                        </Text>
                      </View>
                    )}
                    <ChevronRight size={16} color={TG.textHint} />
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>

        {/* ── Review CTA ─────────────────── */}
        {canReview && (
          <TouchableOpacity
            style={styles.reviewCta}
            activeOpacity={0.7}
            onPress={() => router.push({ pathname: '/writing/review/[sessionId]', params: { sessionId: id } } as any)}
          >
            <Pen size={18} color="#fff" />
            <Text style={styles.reviewCtaText}>Write a Review</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
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
  headerTitle: { fontSize: 18, fontWeight: '700', color: TG.textWhite },

  // Loading / Error
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: TG.bg, paddingHorizontal: 40, gap: 14 },
  loadingText: { fontSize: 15, color: TG.textSecondary },
  errorText: { fontSize: 15, color: TG.red, textAlign: 'center' },

  // Scroll
  scrollView: { flex: 1, backgroundColor: TG.bgSecondary },
  scrollContent: { paddingBottom: 100 },

  // Section Card
  sectionCard: {
    backgroundColor: TG.bg,
    marginHorizontal: 14,
    marginTop: 10,
    borderRadius: 14,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: TG.separatorLight,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: TG.textPrimary },
  countBadge: {
    backgroundColor: TG.accent,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  countBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // Info card rows
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  infoSeparator: { height: 0.5, backgroundColor: TG.separatorLight, marginHorizontal: 14 },
  infoLabel: { fontSize: 13, color: TG.textSecondary },
  infoValue: { fontSize: 14, fontWeight: '600', color: TG.textPrimary, maxWidth: '60%' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusText: { fontSize: 12, fontWeight: '700' },
  overallScoreRow: { flexDirection: 'row', alignItems: 'center' },
  miniScoreCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniScoreValue: { fontSize: 14, fontWeight: '800' },

  // Teacher Review (green card)
  reviewContent: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 6,
  },
  reviewScoreRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reviewScoreValue: { fontSize: 22, fontWeight: '800', color: TG.gold },
  reviewScoreMax: { fontSize: 14, color: TG.textHint, fontWeight: '600' },
  reviewFeedbackText: { fontSize: 14, color: TG.textPrimary, lineHeight: 21, marginTop: 4 },
  reviewerName: { fontSize: 12, color: TG.textSecondary, fontStyle: 'italic', marginTop: 2 },

  // Response items
  responseItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: TG.separatorLight,
  },
  responseItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  partBadge: {
    backgroundColor: TG.accentLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  partBadgeText: { fontSize: 12, fontWeight: '700', color: TG.accent },
  responseMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: TG.bgSecondary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  metaPillText: { fontSize: 11, fontWeight: '600', color: TG.textSecondary },
  essayPreview: { fontSize: 14, color: TG.textPrimary, lineHeight: 21, marginBottom: 10 },

  // AI Feedback button
  aiFeedbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: TG.aiFeedbackLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  aiFeedbackBtnText: { fontSize: 14, fontWeight: '600', color: TG.aiFeedback },
  aiFeedbackScorePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  aiFeedbackScoreText: { fontSize: 13, fontWeight: '800' },

  // Review CTA
  reviewCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: TG.accent,
    marginHorizontal: 14,
    marginTop: 14,
    paddingVertical: 14,
    borderRadius: 14,
  },
  reviewCtaText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
