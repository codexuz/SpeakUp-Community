import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import { apiFetchWritingSession, apiSubmitWritingReview } from '@/lib/api';
import type { WritingResponse, WritingSession } from '@/lib/types';
import { getScoreColor } from '@/lib/types';
import { useAuth } from '@/store/auth';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AlertTriangle,
  ArrowLeft,
  FileText,
  MessageSquare,
  Send,
  ShieldX,
  Star,
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const SCORE_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export default function WritingReviewScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const isAllowed = user?.role === 'admin' || (user?.role === 'teacher' && user?.verifiedTeacher);

  const [session, setSession] = useState<WritingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [score, setScore] = useState(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    apiFetchWritingSession(sessionId)
      .then((data) => setSession(data))
      .catch((e: any) => toast.error('Error', e.message))
      .finally(() => setLoading(false));
  }, [sessionId]);

  const handleSubmit = async () => {
    if (score === 0) {
      toast.warning('Validation', 'Please select a score');
      return;
    }
    setSubmitting(true);
    try {
      await apiSubmitWritingReview(sessionId, {
        score,
        feedback: feedbackText.trim() || undefined,
      });
      toast.success('Submitted', 'Review submitted successfully');
      router.back();
    } catch (e: any) {
      toast.error('Error', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAllowed) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={TG.headerBg} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <ArrowLeft size={22} color={TG.textWhite} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Review Writing</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ShieldX size={48} color={TG.red} />
          <Text style={styles.restrictedTitle}>Access Restricted</Text>
          <Text style={styles.restrictedSub}>Verified teacher access is required to review essays.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={TG.headerBg} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <ArrowLeft size={22} color={TG.textWhite} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Review Writing</Text>
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
          <Text style={styles.headerTitle}>Review Writing</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.loadingContainer}>
          <AlertTriangle size={40} color={TG.red} />
          <Text style={styles.errorText}>Session not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const scoreColor = score > 0 ? getScoreColor(Math.round((score / 9) * 100)) : TG.textHint;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={TG.headerBg} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={22} color={TG.textWhite} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review Writing</Text>
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Student Essays ────────────── */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <FileText size={16} color={TG.accent} />
              <Text style={styles.sectionTitle}>Student Essays</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{(session.responses || []).length}</Text>
              </View>
            </View>
            {(session.responses || []).map((response: WritingResponse, index: number) => (
              <View key={response.id} style={styles.essayItem}>
                <View style={styles.essayItemHeader}>
                  <View style={styles.partBadge}>
                    <Text style={styles.partBadgeText}>{(response as any).task?.part || `Task ${index + 1}`}</Text>
                  </View>
                  <View style={styles.wordCountBadge}>
                    <Text style={styles.wordCountText}>
                      {response.essayText.trim().split(/\s+/).filter(Boolean).length} words
                    </Text>
                  </View>
                </View>
                <Text style={styles.essayText}>{response.essayText}</Text>
              </View>
            ))}
          </View>

          {/* ── Score Selection ───────────── */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Star size={16} color={TG.gold} />
              <Text style={styles.sectionTitle}>Band Score</Text>
              {score > 0 && (
                <View style={[styles.selectedScoreBadge, { backgroundColor: scoreColor }]}>
                  <Text style={styles.selectedScoreText}>{score}</Text>
                </View>
              )}
            </View>
            <View style={styles.scoreGrid}>
              {SCORE_OPTIONS.map((s) => {
                const isActive = score === s;
                const chipColor = getScoreColor(Math.round((s / 9) * 100));
                return (
                  <TouchableOpacity
                    key={s}
                    style={[
                      styles.scoreChip,
                      isActive && { backgroundColor: chipColor, borderColor: chipColor },
                    ]}
                    onPress={() => setScore(s)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.scoreChipText, isActive && styles.scoreChipTextActive]}>{s}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Feedback ─────────────────── */}
          <View style={styles.sectionCard}>
            <View style={[styles.sectionHeader, { borderBottomWidth: 0 }]}>
              <MessageSquare size={16} color={TG.mentorTeal} />
              <Text style={styles.sectionTitle}>Feedback</Text>
              <Text style={styles.optionalLabel}>optional</Text>
            </View>
            <View style={styles.feedbackWrapper}>
              <TextInput
                style={styles.feedbackInput}
                value={feedbackText}
                onChangeText={setFeedbackText}
                placeholder="Write your feedback to the student..."
                placeholderTextColor={TG.textHint}
                multiline
                textAlignVertical="top"
              />
            </View>
          </View>

          <View style={{ height: 20 }} />
        </ScrollView>

        {/* ── Bottom Action Bar ──────────── */}
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.cancelBtn} activeOpacity={0.7} onPress={() => router.back()}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitBtn, (submitting || score === 0) && styles.submitBtnDisabled]}
            activeOpacity={0.7}
            onPress={handleSubmit}
            disabled={submitting || score === 0}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Send size={16} color="#fff" />
                <Text style={styles.submitBtnText}>Submit Review</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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

  // Loading / Error states
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: TG.bg, paddingHorizontal: 40, gap: 14 },
  loadingText: { fontSize: 15, color: TG.textSecondary },
  errorText: { fontSize: 15, color: TG.red, textAlign: 'center' },
  restrictedTitle: { fontSize: 18, fontWeight: '700', color: TG.textPrimary, marginTop: 4 },
  restrictedSub: { fontSize: 14, color: TG.textSecondary, textAlign: 'center', lineHeight: 20 },

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
  optionalLabel: { fontSize: 12, color: TG.textHint, fontStyle: 'italic', marginLeft: 'auto' },

  // Essay items
  essayItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: TG.separatorLight,
  },
  essayItemHeader: {
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
  wordCountBadge: {
    backgroundColor: TG.bgSecondary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  wordCountText: { fontSize: 11, fontWeight: '600', color: TG.textSecondary },
  essayText: { fontSize: 14, color: TG.textPrimary, lineHeight: 22 },

  // Score
  scoreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 16,
    justifyContent: 'center',
  },
  scoreChip: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: TG.bg,
    borderWidth: 2.5,
    borderColor: TG.separator,
  },
  scoreChipText: { fontSize: 17, fontWeight: '700', color: TG.textSecondary },
  scoreChipTextActive: { color: '#fff' },
  selectedScoreBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  selectedScoreText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  // Feedback
  feedbackWrapper: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  feedbackInput: {
    backgroundColor: TG.bgSecondary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: TG.textPrimary,
    minHeight: 120,
    lineHeight: 22,
  },

  // Bottom bar
  bottomBar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: TG.bg,
    borderTopWidth: 0.5,
    borderTopColor: TG.separatorLight,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: TG.bgSecondary,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 16, fontWeight: '600', color: TG.textSecondary },
  submitBtn: {
    flex: 1.5,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: TG.accent,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
