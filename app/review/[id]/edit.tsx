import { useAlert } from '@/components/CustomAlert';
import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import {
  apiDeleteReview,
  apiFetchReviews,
  apiFetchSessionDetail,
  apiPostReview,
} from '@/lib/api';
import { useAuth } from '@/store/auth';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Star, Trash2 } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
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

function getCefrLabel(score: number, isIelts: boolean = false): { level: string; color: string; bg: string } {
  if (isIelts) {
    if (score <= 3.5) return { level: 'A2', color: TG.red, bg: TG.redLight };
    if (score <= 4.5) return { level: 'B1', color: TG.orange, bg: TG.orangeLight };
    if (score <= 6.0) return { level: 'B2', color: TG.accent, bg: TG.accentLight };
    if (score <= 7.5) return { level: 'C1', color: TG.green, bg: TG.greenLight };
    return { level: 'C2', color: TG.purple, bg: TG.purpleLight };
  } else {
    if (score <= 37) return { level: 'A2', color: TG.red, bg: TG.redLight };
    if (score <= 50) return { level: 'B1', color: TG.orange, bg: TG.orangeLight };
    if (score <= 64) return { level: 'B2', color: TG.accent, bg: TG.accentLight };
    return { level: 'C1', color: TG.green, bg: TG.greenLight };
  }
}

export default function ReviewEditScreen() {
  const { id: sessionId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { alert } = useAlert();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [sessionTitle, setSessionTitle] = useState('');
  const [responseCount, setResponseCount] = useState(0);
  const [examType, setExamType] = useState<'cefr' | 'ielts'>('cefr');
  const [hasExisting, setHasExisting] = useState(false);

  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const [session, reviews] = await Promise.all([
        apiFetchSessionDetail(sessionId),
        apiFetchReviews(sessionId),
      ]);

      setSessionTitle(session.test?.title || 'Untitled Session');
      setResponseCount(session.responses?.length || session._count?.responses || 0);
      setExamType(session.examType || 'cefr');

      // Find the current user's existing review
      const myReview = (reviews || []).find(
        (r: any) => r.reviewerId === user?.id,
      );
      if (myReview) {
        setHasExisting(true);
        setScore(String(myReview.score));
        setFeedback(myReview.feedback || '');
      }
    } catch (e: any) {
      toast.error('Error', e.message || 'Failed to load session');
    } finally {
      setLoading(false);
    }
  }, [sessionId, user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const isIelts = examType === 'ielts';
  const scoreNum = parseFloat(score);
  const scorePreview =
    !isNaN(scoreNum) && scoreNum >= 0 && (isIelts ? scoreNum <= 9 : scoreNum <= 75)
      ? getCefrLabel(scoreNum, isIelts)
      : null;

  const handleSubmit = async () => {
    if (!sessionId || !score) return;
    const num = parseFloat(score);
    const max = isIelts ? 9 : 75;

    if (isNaN(num) || num < 0 || num > max) {
      toast.warning('Invalid', `Score must be between 0 and ${max}`);
      return;
    }
    if (isIelts && (num * 2) % 1 !== 0) {
      toast.warning('Invalid', 'IELTS score must be in 0.5 steps (e.g. 5.5, 6.0)');
      return;
    }
    if (!isIelts && !Number.isInteger(num)) {
      toast.warning('Invalid', 'CEFR score must be a whole number');
      return;
    }

    setSubmitting(true);
    try {
      await apiPostReview(sessionId, num, feedback);
      toast.success('Saved', hasExisting ? 'Review updated' : 'Review submitted');
      router.back();
    } catch (e: any) {
      toast.error('Error', e.message || 'Failed to save review');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!sessionId) return;
    alert(
      'Delete Review',
      'Are you sure you want to delete your review? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await apiDeleteReview(sessionId);
              toast.success('Deleted', 'Your review has been removed');
              router.back();
            } catch (e: any) {
              toast.error('Error', e.message || 'Failed to delete review');
              setDeleting(false);
            }
          },
        },
      ],
      'warning',
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <ArrowLeft size={22} color={TG.textWhite} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Review</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={TG.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <ArrowLeft size={22} color={TG.textWhite} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {hasExisting ? 'Edit Review' : 'Add Review'}
        </Text>
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView style={{ flex: 1, backgroundColor: TG.bgSecondary }} contentContainerStyle={styles.content}>
          {/* Session info card */}
          <View style={styles.sessionCard}>
            <Star size={18} color={TG.orange} />
            <View style={{ flex: 1 }}>
              <Text style={styles.sessionTitle} numberOfLines={2}>
                {sessionTitle}
              </Text>
              <Text style={styles.sessionSub}>
                {responseCount} response{responseCount !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>

          {/* Score input */}
          <Text style={styles.inputLabel}>Score (0–{isIelts ? '9' : '75'})</Text>
          <View style={styles.scoreRow}>
            <TextInput
              style={[styles.input, styles.scoreInput]}
              value={score}
              onChangeText={setScore}
              keyboardType={isIelts ? 'decimal-pad' : 'number-pad'}
              maxLength={isIelts ? 3 : 2}
              placeholder={isIelts ? '0.0–9.0' : '0–75'}
              placeholderTextColor={TG.textHint}
            />
            {scorePreview && (
              <View style={[styles.cefrPreview, { backgroundColor: scorePreview.bg }]}>
                <Text style={[styles.cefrPreviewLevel, { color: scorePreview.color }]}>
                  {scorePreview.level}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.cefrGuide}>
            {isIelts 
              ? 'A2: 0–3.5 · B1: 4.0–4.5 · B2: 5.0–6.0 · C1: 6.5–7.5 · C2: 8.0–9.0'
              : 'A2: 0–37 · B1: 38–50 · B2: 51–64 · C1: 65–75'}
          </Text>

          {/* Feedback input */}
          <Text style={styles.inputLabel}>Feedback</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={feedback}
            onChangeText={setFeedback}
            multiline
            numberOfLines={6}
            placeholder="Write your feedback here..."
            placeholderTextColor={TG.textHint}
            textAlignVertical="top"
          />

          {/* Submit button */}
          <TouchableOpacity
            style={[styles.submitBtn, (!score || submitting) && { opacity: 0.5 }]}
            activeOpacity={0.7}
            onPress={handleSubmit}
            disabled={!score || submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={TG.textWhite} />
            ) : (
              <Text style={styles.submitBtnText}>
                {hasExisting ? 'Update Review' : 'Submit Review'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Delete button (bottom) */}
          {hasExisting && (
            <TouchableOpacity
              style={styles.deleteBtn}
              activeOpacity={0.7}
              onPress={handleDelete}
              disabled={deleting}
            >
              <Trash2 size={16} color={TG.red} />
              <Text style={styles.deleteBtnText}>Delete Review</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TG.headerBg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: TG.bgSecondary },

  header: {
    backgroundColor: TG.headerBg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: TG.textWhite },

  content: {
    padding: 16,
    paddingBottom: 50,
  },

  // Session info
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TG.bg,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    marginBottom: 24,
  },
  sessionTitle: { fontSize: 15, fontWeight: '600', color: TG.textPrimary },
  sessionSub: { fontSize: 12, color: TG.textSecondary, marginTop: 2 },

  // Form
  inputLabel: {
    fontSize: 13,
    color: TG.textSecondary,
    fontWeight: '600',
    marginBottom: 8,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  input: {
    backgroundColor: TG.bg,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: TG.textPrimary,
    borderWidth: 0.5,
    borderColor: TG.separator,
  },
  scoreInput: {
    flex: 1,
    marginBottom: 0,
  },
  textArea: {
    minHeight: 120,
    marginBottom: 24,
  },
  cefrPreview: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
  },
  cefrPreviewLevel: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cefrGuide: {
    fontSize: 11,
    color: TG.textHint,
    marginTop: 8,
    marginBottom: 20,
  },

  // Buttons
  submitBtn: {
    backgroundColor: TG.accent,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    color: TG.textWhite,
    fontSize: 16,
    fontWeight: '700',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: TG.redLight,
  },
  deleteBtnText: {
    color: TG.red,
    fontSize: 15,
    fontWeight: '600',
  },
});
