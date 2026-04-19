import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import { apiFetchWritingSession, apiFetchWritingSessionFeedbacks } from '@/lib/api';
import type { WritingResponse, WritingSession, WritingSessionFeedbackResponse } from '@/lib/types';
import { useAuth } from '@/store/auth';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Bot, ChevronRight, Clock, Pen, Star, User } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <ArrowLeft size={22} color={TG.textWhite} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Writing Session</Text>
        {canReview ? (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push({ pathname: '/writing/review/[sessionId]', params: { sessionId: id } } as any)}
          >
            <Pen size={20} color={TG.textWhite} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 22 }} />
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={TG.accent} />
        </View>
      ) : !session ? (
        <View style={styles.centered}>
          <Text style={{ color: TG.textSecondary }}>Session not found</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1, backgroundColor: TG.bgSecondary }}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Session info card */}
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Test</Text>
              <Text style={styles.infoValue} numberOfLines={1}>{(session as any).test?.title || `Test`}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status</Text>
              <View style={[
                styles.statusBadge,
                { backgroundColor: (session.reviews?.length ? TG.green : TG.orange) + '20' },
              ]}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: session.reviews?.length ? TG.green : TG.orange }}>
                  {session.reviews?.length ? 'Reviewed' : 'Pending'}
                </Text>
              </View>
            </View>
            {session.scoreAvg != null && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Overall Score</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Star size={14} color={TG.orange} />
                  <Text style={[styles.infoValue, { color: TG.orange, fontWeight: '700' }]}>{session.scoreAvg}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Responses */}
          <Text style={styles.sectionTitle}>Responses</Text>
          {(session.responses || []).map((response: WritingResponse, index: number) => {
            const fb = feedbacks?.feedbacks?.find((f) => f.responseId === response.id);

            return (
              <View key={response.id} style={styles.responseCard}>
                <View style={styles.responseHeader}>
                  <View style={styles.partBadge}>
                    <Text style={styles.partBadgeText}>{(response as any).task?.part || `Task ${index + 1}`}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Clock size={12} color={TG.textHint} />
                    <Text style={styles.metaText}>{formatTime(response.timeTakenSec || 0)}</Text>
                  </View>
                </View>

                {/* Essay text preview */}
                <Text style={styles.essayPreview} numberOfLines={4}>
                  {response.essayText}
                </Text>

                {/* Word count */}
                <Text style={styles.wordCount}>
                  {response.essayText.trim().split(/\s+/).filter(Boolean).length} words
                </Text>

                {/* AI Feedback button */}
                {fb && (
                  <TouchableOpacity
                    style={styles.feedbackBtn}
                    activeOpacity={0.7}
                    onPress={() => router.push({ pathname: '/writing/ai-feedback/[responseId]', params: { responseId: String(response.id) } } as any)}
                  >
                    <Bot size={16} color={TG.accent} />
                    <Text style={styles.feedbackBtnText}>AI Feedback</Text>
                    <View style={{ flex: 1 }} />
                    {fb.overallScore != null && (
                      <Text style={styles.scoreBadge}>{fb.overallScore}</Text>
                    )}
                    <ChevronRight size={16} color={TG.textHint} />
                  </TouchableOpacity>
                )}

                {/* Teacher review */}
                {session.reviews?.[0] && (
                  <View style={styles.reviewSection}>
                    <View style={styles.reviewHeader}>
                      <User size={14} color={TG.green} />
                      <Text style={styles.reviewHeaderText}>Teacher Review</Text>
                    </View>
                    <View style={styles.reviewScoreRow}>
                      <Star size={14} color={TG.orange} />
                      <Text style={styles.reviewScore}>{session.reviews[0].score}</Text>
                    </View>
                    {session.reviews[0].feedback && (
                      <Text style={styles.reviewFeedback}>{session.reviews[0].feedback}</Text>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TG.headerBg },
  header: {
    backgroundColor: TG.headerBg,
    paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: TG.textWhite, flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: TG.bgSecondary },
  content: { padding: 16, paddingBottom: 40 },
  infoCard: {
    backgroundColor: TG.bg, borderRadius: 14, padding: 16,
    gap: 12, marginBottom: 20,
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8,
    elevation: 1,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  infoLabel: { fontSize: 13, color: TG.textSecondary },
  infoValue: { fontSize: 14, fontWeight: '600', color: TG.textPrimary },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: TG.textPrimary, marginBottom: 12 },
  responseCard: {
    backgroundColor: TG.bg, borderRadius: 14, padding: 16,
    marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8,
    elevation: 1,
  },
  responseHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10,
  },
  partBadge: {
    backgroundColor: TG.accentLight, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8,
  },
  partBadgeText: { fontSize: 12, fontWeight: '700', color: TG.accent },
  metaText: { fontSize: 12, color: TG.textHint },
  essayPreview: { fontSize: 14, color: TG.textPrimary, lineHeight: 20, marginBottom: 8 },
  wordCount: { fontSize: 12, color: TG.textHint, marginBottom: 10 },
  feedbackBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: TG.accentLight, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 8,
  },
  feedbackBtnText: { fontSize: 14, fontWeight: '600', color: TG.accent },
  scoreBadge: {
    fontSize: 14, fontWeight: '800', color: TG.accent,
    backgroundColor: TG.bg, paddingHorizontal: 10, paddingVertical: 2,
    borderRadius: 8, overflow: 'hidden',
  },
  reviewSection: {
    backgroundColor: TG.greenLight, borderRadius: 12,
    padding: 12, gap: 6,
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reviewHeaderText: { fontSize: 13, fontWeight: '700', color: TG.green },
  reviewScoreRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reviewScore: { fontSize: 16, fontWeight: '800', color: TG.orange },
  reviewFeedback: { fontSize: 13, color: TG.textPrimary, lineHeight: 18 },
});
