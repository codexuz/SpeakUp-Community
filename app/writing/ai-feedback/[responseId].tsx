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
    Lightbulb,
    Target
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function ScoreRing({ label, score, max = 9 }: { label: string; score: number; max?: number }) {
  const color = getScoreColor(Math.round((score / max) * 100));
  return (
    <View style={styles.scoreRing}>
      <View style={[styles.scoreCircle, { borderColor: color }]}>
        <Text style={[styles.scoreValue, { color }]}>{score}</Text>
      </View>
      <Text style={styles.scoreLabel} numberOfLines={2}>{label}</Text>
    </View>
  );
}

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <ArrowLeft size={22} color={TG.textWhite} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI Writing Feedback</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={TG.accent} />
          <Text style={styles.loadingText}>Loading feedback...</Text>
        </View>
      ) : error === 'processing' ? (
        <View style={styles.centered}>
          <Brain size={48} color={TG.accent} />
          <Text style={styles.processingTitle}>AI is analyzing your essay</Text>
          <Text style={styles.processingDesc}>This usually takes 10–30 seconds</Text>
          <ActivityIndicator size="small" color={TG.accent} style={{ marginTop: 16 }} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <AlertTriangle size={40} color={TG.red} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadFeedback} activeOpacity={0.7}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : feedback ? (
        <ScrollView
          style={{ flex: 1, backgroundColor: TG.bgSecondary }}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Overall band score */}
          {feedback.overallScore != null && (
            <View style={styles.overallCard}>
              <Text style={styles.overallLabel}>Overall Band Score</Text>
              <Text style={[styles.overallScore, { color: getScoreColor(Math.round((feedback.overallScore / 9) * 100)) }]}>
                {feedback.overallScore}
              </Text>
            </View>
          )}

          {/* 4 Criteria scores */}
          <View style={styles.scoresGrid}>
            <ScoreRing label="Task Achievement" score={feedback.taskAchievement} />
            <ScoreRing label="Coherence & Cohesion" score={feedback.coherenceCohesion} />
            <ScoreRing label="Lexical Resource" score={feedback.lexicalResource} />
            <ScoreRing label="Grammatical Range" score={feedback.grammaticalRange} />
          </View>

          {/* Coherence notes */}
          {feedback.coherenceNotes?.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Target size={18} color={TG.accent} />
                <Text style={styles.sectionTitle}>Coherence Notes</Text>
              </View>
              {feedback.coherenceNotes.map((note, i) => (
                <View key={i} style={styles.vocabItem}>
                  <Text style={styles.vocabOriginal}>{note.issue}</Text>
                  <Text style={styles.vocabArrow}>→</Text>
                  <Text style={styles.vocabSuggestion}>{note.suggestion}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Grammar Issues */}
          {feedback.grammarIssues?.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <AlertTriangle size={18} color={TG.orange} />
                <Text style={styles.sectionTitle}>Grammar Issues ({feedback.grammarIssues.length})</Text>
              </View>
              {feedback.grammarIssues.map((issue, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.grammarItem}
                  activeOpacity={0.7}
                  onPress={() => setExpandedGrammar(expandedGrammar === i ? null : i)}
                >
                  <View style={styles.grammarRow}>
                    <View style={styles.grammarOriginal}>
                      <Text style={styles.grammarOriginalText}>"{issue.original}"</Text>
                    </View>
                    {expandedGrammar === i ? (
                      <ChevronUp size={16} color={TG.textHint} />
                    ) : (
                      <ChevronDown size={16} color={TG.textHint} />
                    )}
                  </View>
                  {expandedGrammar === i && (
                    <View style={styles.grammarExpanded}>
                      <View style={styles.correctionRow}>
                        <Text style={styles.correctionLabel}>Correction:</Text>
                        <Text style={styles.correctionText}>{issue.corrected}</Text>
                      </View>
                      <Text style={styles.explanationText}>{issue.explanation}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Vocabulary suggestions */}
          {feedback.vocabSuggestions?.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <BookOpen size={18} color={TG.purple} />
                <Text style={styles.sectionTitle}>Vocabulary Suggestions ({feedback.vocabSuggestions.length})</Text>
              </View>
              {feedback.vocabSuggestions.map((sug, i) => (
                <View key={i} style={styles.vocabItem}>
                  <Text style={styles.vocabOriginal}>"{sug.word}"</Text>
                  <Text style={styles.vocabArrow}>→</Text>
                  <Text style={styles.vocabSuggestion}>{sug.alternatives.join(', ')}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Improved essay */}
          {feedback.improvedEssay && (
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.sectionHeader}
                activeOpacity={0.7}
                onPress={() => setShowImproved(!showImproved)}
              >
                <Lightbulb size={18} color={TG.green} />
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
        </ScrollView>
      ) : null}
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: TG.bgSecondary, gap: 8 },
  loadingText: { color: TG.textSecondary, fontSize: 14, marginTop: 8 },
  processingTitle: { fontSize: 18, fontWeight: '700', color: TG.textPrimary, marginTop: 12 },
  processingDesc: { fontSize: 14, color: TG.textSecondary },
  errorText: { color: TG.red, fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
  retryBtn: {
    backgroundColor: TG.accent, paddingHorizontal: 24, paddingVertical: 10,
    borderRadius: 14, marginTop: 12,
  },
  retryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  content: { padding: 16, paddingBottom: 40 },

  // Overall score
  overallCard: {
    backgroundColor: TG.bg, borderRadius: 16, padding: 20,
    alignItems: 'center', marginBottom: 16,
    shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, shadowRadius: 10,
    elevation: 2,
  },
  overallLabel: { fontSize: 13, color: TG.textSecondary, marginBottom: 4 },
  overallScore: { fontSize: 48, fontWeight: '800' },

  // Score grid
  scoresGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  scoreRing: { width: '48%', alignItems: 'center', marginBottom: 16 },
  scoreCircle: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 4, justifyContent: 'center', alignItems: 'center',
    backgroundColor: TG.bg,
    marginBottom: 6,
  },
  scoreValue: { fontSize: 22, fontWeight: '800' },
  scoreLabel: { fontSize: 12, color: TG.textSecondary, textAlign: 'center' },

  // Sections
  section: {
    backgroundColor: TG.bg, borderRadius: 14, padding: 16,
    marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8,
    elevation: 1,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: TG.textPrimary },
  sectionText: { fontSize: 14, color: TG.textPrimary, lineHeight: 20 },

  // Grammar
  grammarItem: {
    backgroundColor: TG.bgSecondary, borderRadius: 12, padding: 12,
    marginBottom: 8,
  },
  grammarRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  grammarOriginal: {},
  grammarOriginalText: { fontSize: 14, color: TG.red, fontStyle: 'italic' },
  grammarExpanded: { marginTop: 10, gap: 6 },
  correctionRow: { flexDirection: 'row', gap: 6 },
  correctionLabel: { fontSize: 13, color: TG.textSecondary },
  correctionText: { fontSize: 13, fontWeight: '600', color: TG.green },
  explanationText: { fontSize: 13, color: TG.textSecondary, lineHeight: 18 },

  // Vocab
  vocabItem: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: TG.bgSecondary, borderRadius: 10,
    padding: 10, marginBottom: 6,
  },
  vocabOriginal: { fontSize: 13, color: TG.textSecondary, fontStyle: 'italic' },
  vocabArrow: { fontSize: 14, color: TG.textHint },
  vocabSuggestion: { fontSize: 13, fontWeight: '600', color: TG.purple },

  // Improved essay
  improvedEssayBox: {
    backgroundColor: TG.greenLight, borderRadius: 12, padding: 14,
  },
  improvedEssayText: { fontSize: 14, color: TG.textPrimary, lineHeight: 22 },
});
