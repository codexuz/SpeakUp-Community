import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import { apiFetchWritingSession, apiSubmitWritingReview } from '@/lib/api';
import type { WritingResponse, WritingSession } from '@/lib/types';
import { useAuth } from '@/store/auth';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Send } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
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
      <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: TG.textSecondary, fontSize: 16 }}>Verified teacher access required</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <ArrowLeft size={22} color={TG.textWhite} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review Writing</Text>
        <View style={{ width: 22 }} />
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
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            style={{ flex: 1, backgroundColor: TG.bgSecondary }}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Student essays */}
            <Text style={styles.sectionTitle}>Student Essays</Text>
            {(session.responses || []).map((response: WritingResponse, index: number) => (
              <View key={response.id} style={styles.essayCard}>
                <View style={styles.essayHeader}>
                  <View style={styles.partBadge}>
                    <Text style={styles.partBadgeText}>{(response as any).task?.part || `Task ${index + 1}`}</Text>
                  </View>
                  <Text style={styles.wordCount}>
                    {response.essayText.trim().split(/\s+/).filter(Boolean).length} words
                  </Text>
                </View>
                <Text style={styles.essayText}>{response.essayText}</Text>
              </View>
            ))}

            {/* Score selection */}
            <Text style={styles.sectionTitle}>Score</Text>
            <View style={styles.scoreRow}>
              {SCORE_OPTIONS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.scoreChip, score === s && styles.scoreChipActive]}
                  onPress={() => setScore(s)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.scoreChipText, score === s && styles.scoreChipTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Feedback */}
            <Text style={styles.sectionTitle}>Feedback (optional)</Text>
            <TextInput
              style={styles.feedbackInput}
              value={feedbackText}
              onChangeText={setFeedbackText}
              placeholder="Write your feedback to the student..."
              placeholderTextColor={TG.textHint}
              multiline
              textAlignVertical="top"
            />
          </ScrollView>

          <View style={styles.bottomBar}>
            <TouchableOpacity style={styles.cancelBtn} activeOpacity={0.7} onPress={() => router.back()}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitBtn, (submitting || score === 0) && { opacity: 0.5 }]}
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
  sectionTitle: { fontSize: 16, fontWeight: '700', color: TG.textPrimary, marginBottom: 12, marginTop: 16 },
  essayCard: {
    backgroundColor: TG.bg, borderRadius: 14, padding: 16,
    marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8,
    elevation: 1,
  },
  essayHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10,
  },
  partBadge: {
    backgroundColor: TG.accentLight, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8,
  },
  partBadgeText: { fontSize: 12, fontWeight: '700', color: TG.accent },
  wordCount: { fontSize: 12, color: TG.textHint },
  essayText: { fontSize: 14, color: TG.textPrimary, lineHeight: 22 },
  scoreRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8,
  },
  scoreChip: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: TG.bg,
    borderWidth: 2, borderColor: TG.separator,
  },
  scoreChipActive: { backgroundColor: TG.accent, borderColor: TG.accent },
  scoreChipText: { fontSize: 16, fontWeight: '700', color: TG.textSecondary },
  scoreChipTextActive: { color: '#fff' },
  feedbackInput: {
    backgroundColor: TG.bg, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: TG.textPrimary,
    minHeight: 120, lineHeight: 22,
    borderWidth: 1, borderColor: TG.separator,
  },
  bottomBar: {
    flexDirection: 'row', gap: 12,
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: TG.bg,
    borderTopWidth: 1, borderTopColor: TG.separator,
  },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    backgroundColor: TG.bgSecondary, alignItems: 'center',
  },
  cancelBtnText: { fontSize: 16, fontWeight: '600', color: TG.textSecondary },
  submitBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    backgroundColor: TG.accent, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center', gap: 8,
  },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
