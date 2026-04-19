import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import { apiFetchWritingAIFeedback } from '@/lib/api';
import type { WritingAIFeedback } from '@/lib/types';
import { getScoreColor } from '@/lib/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Brain,
  ChevronDown,
  ChevronUp,
  FileText,
  Lightbulb,
  Target,
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

const ScoreCircle = ({ label, score, size = 56 }: { label: string; score: number; size?: number }) => {
  const color = getScoreColor(Math.round((score / 9) * 100));
  return (
    <View style={styles.scoreCircleContainer}>
      <View style={[styles.scoreCircle, { width: size, height: size, borderColor: color }]}>
        <Text style={[styles.scoreCircleValue, { color }]}>{score}</Text>
      </View>
      <Text style={styles.scoreCircleLabel} numberOfLines={2}>{label}</Text>
    </View>
  );
};

export default function WritingAIFeedbackScreen() {
  const { responseId } = useLocalSearchParams<{ responseId: string }>();
  const router = useRouter();
  const toast = useToast();
  const [feedback, setFeedback] = useState<WritingAIFeedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedGrammar, setExpandedGrammar] = useState<number | null>(null);
  const [showImproved, setShowImproved] = useState(false);

  const loadFeedback = useCallback(async () => {
    if (!responseId) return;
    setLoading(true);
    setError('');
    try {
      const data = await apiFetchWritingAIFeedback(responseId);
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

  // Auto-retry if processing
  useEffect(() => {
    if (error !== 'processing') return;
    const timer = setTimeout(() => loadFeedback(), 5000);
    return () => clearTimeout(timer);
  }, [error, loadFeedback]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={TG.headerBg} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <ArrowLeft size={22} color={TG.textWhite} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>AI Writing Feedback</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={TG.aiFeedback} />
          <Text style={styles.loadingText}>Analyzing your essay...</Text>
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
          <Text style={styles.headerTitle}>AI Writing Feedback</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.loadingContainer}>
          <Brain size={48} color={TG.aiFeedback} />
          <Text style={styles.processingTitle}>Processing Your Essay</Text>
          <Text style={styles.processingSub}>AI is analyzing your writing. This usually takes 10–30 seconds.</Text>
          <ActivityIndicator size="small" color={TG.aiFeedback} style={{ marginTop: 8 }} />
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
          <Text style={styles.headerTitle}>AI Writing Feedback</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.loadingContainer}>
          <AlertTriangle size={40} color={TG.red} />
          <Text style={styles.errorText}>{error || 'No feedback available'}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadFeedback}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const overallColor = getScoreColor(Math.round((feedback.overallScore / 9) * 100));

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={TG.headerBg} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={22} color={TG.textWhite} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI Writing Feedback</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── Overall Band Score ─────────── */}
        <View style={styles.overallCard}>
          <View style={[styles.overallCircle, { borderColor: overallColor }]}>
            <Text style={[styles.overallScore, { color: overallColor }]}>
              {feedback.overallScore}
            </Text>
          </View>
          <Text style={styles.overallLabel}>
            {feedback.overallScore >= 7 ? 'Excellent!' : feedback.overallScore >= 5.5 ? 'Good job!' : feedback.overallScore >= 4 ? 'Keep practicing!' : 'Room to grow!'}
          </Text>
          {feedback.cefrLevel && (
            <View style={styles.cefrBadge}>
              <Text style={styles.cefrBadgeText}>{feedback.cefrLevel}</Text>
            </View>
          )}
        </View>

        {/* ── Score Breakdown ────────────── */}
        <View style={styles.scoresRow}>
          <ScoreCircle label="Task" score={feedback.taskAchievement} />
          <ScoreCircle label="Coherence" score={feedback.coherenceCohesion} />
          <ScoreCircle label="Lexical" score={feedback.lexicalResource} />
          <ScoreCircle label="Grammar" score={feedback.grammaticalRange} />
        </View>

        {/* ── Task Notes ─────────────────── */}
        {feedback.taskNotes && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <FileText size={16} color={TG.accent} />
              <Text style={styles.sectionTitle}>Task Notes</Text>
            </View>
            <Text style={styles.sectionBodyText}>{feedback.taskNotes}</Text>
          </View>
        )}

        {/* ── Coherence Notes ────────────── */}
        {feedback.coherenceNotes?.length > 0 && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Target size={16} color={TG.mentorTeal} />
              <Text style={styles.sectionTitle}>Coherence Notes</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{feedback.coherenceNotes.length}</Text>
              </View>
            </View>
            {feedback.coherenceNotes.map((note, i) => (
              <View key={i} style={styles.coherenceItem}>
                <Text style={styles.coherenceIssue}>{note.issue}</Text>
                <Text style={styles.coherenceCorrected}>→ {note.suggestion}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Grammar Issues ─────────────── */}
        {feedback.grammarIssues?.length > 0 && (
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
        {feedback.vocabSuggestions?.length > 0 && (
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
                {sug.context ? <Text style={styles.vocabContext}>{sug.context}</Text> : null}
              </View>
            ))}
          </View>
        )}

        {/* ── Improved Essay ──────────────── */}
        {feedback.improvedEssay && (
          <View style={styles.sectionCard}>
            <TouchableOpacity
              style={[styles.sectionHeader, !showImproved && { borderBottomWidth: 0 }]}
              activeOpacity={0.7}
              onPress={() => setShowImproved(!showImproved)}
            >
              <BookOpen size={16} color={TG.green} />
              <Text style={styles.sectionTitle}>Improved Essay</Text>
              <View style={{ flex: 1 }} />
              {showImproved ? (
                <ChevronUp size={16} color={TG.textHint} />
              ) : (
                <ChevronDown size={16} color={TG.textHint} />
              )}
            </TouchableOpacity>
            {showImproved && (
              <View style={styles.improvedEssayBox}>
                <Text style={styles.improvedEssayText}>{feedback.improvedEssay}</Text>
              </View>
            )}
          </View>
        )}

        {/* ── AI Summary ─────────────────── */}
        {feedback.aiSummary && (
          <View style={[styles.sectionCard, { backgroundColor: TG.aiFeedbackLight, borderWidth: 0 }]}>
            <View style={[styles.sectionHeader, { borderBottomWidth: 0 }]}>
              <Brain size={16} color={TG.aiFeedback} />
              <Text style={[styles.sectionTitle, { color: TG.aiFeedback }]}>AI Summary</Text>
            </View>
            <Text style={styles.summaryText}>{feedback.aiSummary}</Text>
          </View>
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
  cefrBadge: {
    backgroundColor: TG.aiFeedbackLight,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 8,
  },
  cefrBadgeText: { fontSize: 13, fontWeight: '700', color: TG.aiFeedback },

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
  scoreCircleLabel: { fontSize: 11, color: TG.textSecondary, textAlign: 'center' },

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
  sectionBodyText: {
    fontSize: 14,
    color: TG.textPrimary,
    lineHeight: 22,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
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

  // Coherence Notes
  coherenceItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: TG.separatorLight,
  },
  coherenceIssue: { fontSize: 14, color: TG.scoreRed, textDecorationLine: 'line-through', marginBottom: 4 },
  coherenceCorrected: { fontSize: 14, color: TG.scoreGreen, fontWeight: '600' },

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

  // Improved essay
  improvedEssayBox: {
    backgroundColor: TG.greenLight,
    marginHorizontal: 14,
    marginBottom: 14,
    borderRadius: 12,
    padding: 14,
  },
  improvedEssayText: { fontSize: 14, color: TG.textPrimary, lineHeight: 22 },

  // Summary
  summaryText: { fontSize: 14, color: TG.aiFeedback, lineHeight: 21, paddingHorizontal: 14, paddingBottom: 14, fontWeight: '500' },
});
