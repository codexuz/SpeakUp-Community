import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import { apiFetchAIFeedback, apiMarkHelpful } from '@/lib/api';
import type { AIFeedback } from '@/lib/types';
import { getScoreColor } from '@/lib/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    AlertTriangle,
    ArrowLeft,
    BookOpen,
    Brain,
    ChevronDown,
    ChevronUp,
    Lightbulb,
    Mic,
    PauseCircle,
    ThumbsUp,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
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

export default function AIFeedbackScreen() {
  const { responseId } = useLocalSearchParams<{ responseId: string }>();
  const router = useRouter();
  const toast = useToast();
  const [feedback, setFeedback] = useState<AIFeedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedGrammar, setExpandedGrammar] = useState<number | null>(null);
  const [helpfulSent, setHelpfulSent] = useState(false);
  const [helpfulLoading, setHelpfulLoading] = useState(false);

  const loadFeedback = useCallback(async () => {
    if (!responseId) return;
    setLoading(true);
    setError('');
    try {
      const data = await apiFetchAIFeedback(responseId);
      setFeedback(data);
    } catch (e: any) {
      if (e.message?.includes('404')) {
        setError('processing');
      } else {
        setError(e.message || 'Failed to load feedback');
      }
    } finally {
      setLoading(false);
    }
  }, [responseId]);

  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  const handleHelpful = async () => {
    if (!responseId || helpfulSent || helpfulLoading) return;
    setHelpfulLoading(true);
    try {
      await apiMarkHelpful(responseId);
      setHelpfulSent(true);
      toast.show('success', 'Marked as helpful!');
    } catch (e: any) {
      toast.show('error', e.message || 'Failed to mark helpful');
    } finally {
      setHelpfulLoading(false);
    }
  };

  const ScoreCircle = ({ label, score, size = 56 }: { label: string; score: number; size?: number }) => {
    const color = getScoreColor(score);
    return (
      <View style={styles.scoreCircleContainer}>
        <View style={[styles.scoreCircle, { width: size, height: size, borderColor: color }]}>
          <Text style={[styles.scoreCircleValue, { color }]}>{score}</Text>
        </View>
        <Text style={styles.scoreCircleLabel}>{label}</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={TG.headerBg} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <ArrowLeft size={22} color={TG.textWhite} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>AI Feedback</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={TG.aiFeedback} />
          <Text style={styles.loadingText}>Analyzing your speech...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error === 'processing') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={TG.headerBg} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <ArrowLeft size={22} color={TG.textWhite} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>AI Feedback</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.loadingContainer}>
          <Brain size={48} color={TG.aiFeedback} />
          <Text style={styles.processingTitle}>Processing Your Recording</Text>
          <Text style={styles.processingSub}>AI is analyzing your speech. This usually takes 5–15 seconds.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadFeedback}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !feedback) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={TG.headerBg} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <ArrowLeft size={22} color={TG.textWhite} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>AI Feedback</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>{error || 'No feedback available'}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadFeedback}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const fillerEntries = Object.entries(feedback.fillerWords || {});

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={TG.headerBg} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={22} color={TG.textWhite} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI Feedback</Text>
        <TouchableOpacity onPress={handleHelpful} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ThumbsUp size={20} color={helpfulSent ? TG.gold : TG.textWhite} fill={helpfulSent ? TG.gold : 'none'} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── Overall Score ──────────────── */}
        <View style={styles.overallCard}>
          <View style={[styles.overallCircle, { borderColor: getScoreColor(feedback.overallScore) }]}>
            <Text style={[styles.overallScore, { color: getScoreColor(feedback.overallScore) }]}>
              {feedback.overallScore}
            </Text>
          </View>
          <Text style={styles.overallLabel}>
            {feedback.overallScore >= 80 ? 'Excellent!' : feedback.overallScore >= 60 ? 'Good job!' : feedback.overallScore >= 40 ? 'Keep practicing!' : 'Room to grow!'}
          </Text>
        </View>

        {/* ── Score Breakdown ────────────── */}
        <View style={styles.scoresRow}>
          <ScoreCircle label="Grammar" score={feedback.grammarScore} />
          <ScoreCircle label="Fluency" score={feedback.fluencyScore} />
          <ScoreCircle label="Vocab" score={feedback.vocabDiversity} />
          <ScoreCircle label="Pronun." score={feedback.pronScore} />
        </View>

        {/* ── Fluency WPM ────────────────── */}
        <View style={styles.wpmBanner}>
          <Mic size={16} color={TG.aiFeedback} />
          <Text style={styles.wpmText}>{feedback.fluencyWPM.toFixed(0)} words/min</Text>
        </View>

        {/* ── Transcript ─────────────────── */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <BookOpen size={16} color={TG.accent} />
            <Text style={styles.sectionTitle}>Transcript</Text>
          </View>
          <Text style={styles.transcriptText}>{feedback.transcript}</Text>
        </View>

        {/* ── Grammar Issues ─────────────── */}
        {feedback.grammarIssues.length > 0 && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <AlertTriangle size={16} color={TG.scoreOrange} />
              <Text style={styles.sectionTitle}>Grammar Issues</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{feedback.grammarIssues.length}</Text>
              </View>
            </View>
            {feedback.grammarIssues.map((issue, i) => (
              <TouchableOpacity
                key={i}
                style={styles.issueCard}
                activeOpacity={0.7}
                onPress={() => setExpandedGrammar(expandedGrammar === i ? null : i)}
              >
                <View style={styles.issueTopRow}>
                  <Text style={styles.issueOriginal}>{issue.original}</Text>
                  {expandedGrammar === i ? (
                    <ChevronUp size={16} color={TG.textHint} />
                  ) : (
                    <ChevronDown size={16} color={TG.textHint} />
                  )}
                </View>
                <Text style={styles.issueCorrected}>→ {issue.corrected}</Text>
                {expandedGrammar === i && (
                  <Text style={styles.issueExplanation}>{issue.explanation}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Vocabulary Tips ────────────── */}
        {feedback.vocabSuggestions.length > 0 && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Lightbulb size={16} color={TG.gold} />
              <Text style={styles.sectionTitle}>Vocabulary Tips</Text>
            </View>
            {feedback.vocabSuggestions.map((sug, i) => (
              <View key={i} style={styles.vocabItem}>
                <Text style={styles.vocabWord}>Instead of "{sug.word}" try:</Text>
                <View style={styles.vocabAltsRow}>
                  {sug.alternatives.map((alt, j) => (
                    <View key={j} style={styles.vocabAltPill}>
                      <Text style={styles.vocabAltText}>{alt}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.vocabContext}>{sug.context}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Pronunciation ──────────────── */}
        {feedback.pronIssues.length > 0 && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Mic size={16} color={TG.achievePurple} />
              <Text style={styles.sectionTitle}>Pronunciation</Text>
            </View>
            {feedback.pronIssues.map((pron, i) => (
              <View key={i} style={styles.pronItem}>
                <Text style={styles.pronWord}>"{pron.word}"</Text>
                <Text style={styles.pronIssue}>{pron.issue}</Text>
                <Text style={styles.pronTip}>{pron.tip}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Filler Words & Pauses ──────── */}
        {(fillerEntries.length > 0 || feedback.pauseCount > 0) && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <PauseCircle size={16} color={TG.textSecondary} />
              <Text style={styles.sectionTitle}>Speech Patterns</Text>
            </View>
            <View style={styles.fillerRow}>
              {fillerEntries.map(([word, count]) => (
                <View key={word} style={styles.fillerPill}>
                  <Text style={styles.fillerPillText}>
                    "{word}" × {count}
                  </Text>
                </View>
              ))}
              {feedback.pauseCount > 0 && (
                <View style={[styles.fillerPill, { backgroundColor: TG.orangeLight }]}>
                  <Text style={[styles.fillerPillText, { color: TG.orange }]}>
                    {feedback.pauseCount} long pause{feedback.pauseCount > 1 ? 's' : ''}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── Naturalness ────────────────── */}
        {feedback.naturalness && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Brain size={16} color={TG.aiFeedback} />
              <Text style={styles.sectionTitle}>Naturalness</Text>
            </View>
            <Text style={styles.naturalnessText}>{feedback.naturalness}</Text>
          </View>
        )}

        {/* ── AI Summary ─────────────────── */}
        <View style={[styles.sectionCard, { backgroundColor: TG.aiFeedbackLight, borderWidth: 0 }]}>
          <View style={[styles.sectionHeader, { borderBottomWidth: 0 }]}>
            <Brain size={16} color={TG.aiFeedback} />
            <Text style={[styles.sectionTitle, { color: TG.aiFeedback }]}>AI Summary</Text>
          </View>
          <Text style={styles.summaryText}>{feedback.aiSummary}</Text>
        </View>

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
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: TG.bg, paddingHorizontal: 40, gap: 14 },
  loadingText: { fontSize: 15, color: TG.textSecondary },
  processingTitle: { fontSize: 18, fontWeight: '700', color: TG.textPrimary, marginTop: 8 },
  processingSub: { fontSize: 14, color: TG.textSecondary, textAlign: 'center', lineHeight: 20 },
  retryBtn: {
    backgroundColor: TG.aiFeedback,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 8,
  },
  retryText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  errorText: { fontSize: 15, color: TG.red, textAlign: 'center' },

  scrollView: { flex: 1, backgroundColor: TG.bgSecondary },
  scrollContent: { paddingBottom: 100 },

  // Overall
  overallCard: {
    alignItems: 'center',
    paddingVertical: 28,
    backgroundColor: TG.bg,
    marginHorizontal: 14,
    marginTop: 14,
    borderRadius: 16,
  },
  overallCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  overallScore: { fontSize: 32, fontWeight: '800' },
  overallLabel: { fontSize: 16, fontWeight: '600', color: TG.textPrimary },

  // Score Circles
  scoresRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    paddingHorizontal: 14,
    backgroundColor: TG.bg,
    marginHorizontal: 14,
    marginTop: 10,
    borderRadius: 16,
  },
  scoreCircleContainer: { alignItems: 'center', gap: 6 },
  scoreCircle: {
    borderRadius: 28,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreCircleValue: { fontSize: 18, fontWeight: '700' },
  scoreCircleLabel: { fontSize: 11, color: TG.textSecondary },

  // WPM
  wpmBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: TG.aiFeedbackLight,
    marginHorizontal: 14,
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 10,
  },
  wpmText: { fontSize: 14, fontWeight: '600', color: TG.aiFeedback },

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
    backgroundColor: TG.scoreOrange,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  countBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // Transcript
  transcriptText: {
    fontSize: 14,
    color: TG.textPrimary,
    lineHeight: 22,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },

  // Grammar Issues
  issueCard: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: TG.separatorLight,
  },
  issueTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  issueOriginal: { fontSize: 14, color: TG.scoreRed, textDecorationLine: 'line-through', flex: 1 },
  issueCorrected: { fontSize: 14, color: TG.scoreGreen, fontWeight: '600', marginTop: 4 },
  issueExplanation: { fontSize: 13, color: TG.textSecondary, marginTop: 6, lineHeight: 19 },

  // Vocab
  vocabItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: TG.separatorLight,
  },
  vocabWord: { fontSize: 13, color: TG.textSecondary },
  vocabAltsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  vocabAltPill: {
    backgroundColor: TG.goldLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  vocabAltText: { fontSize: 13, fontWeight: '600', color: TG.gold },
  vocabContext: { fontSize: 12, color: TG.textHint, marginTop: 4, fontStyle: 'italic' },

  // Pronunciation
  pronItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: TG.separatorLight,
  },
  pronWord: { fontSize: 15, fontWeight: '700', color: TG.achievePurple },
  pronIssue: { fontSize: 13, color: TG.textSecondary, marginTop: 2 },
  pronTip: { fontSize: 13, color: TG.accent, marginTop: 4 },

  // Fillers
  fillerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 14,
  },
  fillerPill: {
    backgroundColor: TG.redLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  fillerPillText: { fontSize: 12, fontWeight: '600', color: TG.red },

  // Naturalness
  naturalnessText: { fontSize: 14, color: TG.textPrimary, lineHeight: 21, paddingHorizontal: 14, paddingBottom: 14 },

  // Summary
  summaryText: { fontSize: 14, color: TG.aiFeedback, lineHeight: 21, paddingHorizontal: 14, paddingBottom: 14, fontWeight: '500' },
});
