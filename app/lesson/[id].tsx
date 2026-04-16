import { TG } from '@/constants/theme';
import { apiCompleteLesson, apiFetchLesson } from '@/lib/api';
import type { Exercise, LessonDetail } from '@/lib/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    ArrowLeft,
    Check,
    ChevronRight,
    Mic,
    Volume2,
    X
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LessonPlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [reorderWords, setReorderWords] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [results, setResults] = useState<{ progress: any; xpEarned: number } | null>(null);

  const loadLesson = useCallback(async () => {
    if (!id) return;
    try {
      const data = await apiFetchLesson(id);
      setLesson(data);
    } catch (e) {
      console.error('Failed to load lesson', e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadLesson();
  }, [loadLesson]);

  const exercises = useMemo(() => lesson?.exercises?.sort((a, b) => a.order - b.order) || [], [lesson]);
  const currentExercise = exercises[currentIndex];
  const totalExercises = exercises.length;
  const progress = totalExercises > 0 ? ((currentIndex + (completed ? 1 : 0)) / totalExercises) * 100 : 0;

  const handleAnswer = (exerciseId: string, answer: string) => {
    setAnswers((prev) => ({ ...prev, [exerciseId]: answer }));
  };

  const handleOptionSelect = (exerciseId: string, option: string) => {
    setSelectedOptions((prev) => ({ ...prev, [exerciseId]: option }));
  };

  const handleReorder = (exerciseId: string, word: string) => {
    setReorderWords((prev) => {
      const current = prev[exerciseId] || [];
      if (current.includes(word)) {
        return { ...prev, [exerciseId]: current.filter((w) => w !== word) };
      }
      return { ...prev, [exerciseId]: [...current, word] };
    });
  };

  const isCurrentAnswered = () => {
    if (!currentExercise) return false;
    const { id: eid, type } = currentExercise;
    switch (type) {
      case 'multipleChoice':
        return !!selectedOptions[eid];
      case 'fillInBlank':
      case 'translate':
      case 'speakTheAnswer':
      case 'listenRepeat':
        return !!(answers[eid]?.trim());
      case 'reorderWords':
        return (reorderWords[eid]?.length || 0) > 0;
      case 'matchPairs':
        return !!selectedOptions[eid];
      default:
        return true;
    }
  };

  const checkAnswer = () => {
    if (!currentExercise) return;
    setRevealed((prev) => ({ ...prev, [currentExercise.id]: true }));
  };

  const isCorrect = (exercise: Exercise): boolean => {
    if (!exercise.correctAnswer) return true;
    const correct = exercise.correctAnswer.toLowerCase().trim();
    switch (exercise.type) {
      case 'multipleChoice':
      case 'matchPairs':
        return (selectedOptions[exercise.id] || '').toLowerCase().trim() === correct;
      case 'fillInBlank':
      case 'translate':
      case 'speakTheAnswer':
      case 'listenRepeat':
        return (answers[exercise.id] || '').toLowerCase().trim() === correct;
      case 'reorderWords':
        return (reorderWords[exercise.id] || []).join(' ').toLowerCase().trim() === correct;
      default:
        return false;
    }
  };

  const goNext = () => {
    if (currentIndex < totalExercises - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    if (!lesson) return;
    setSubmitting(true);
    try {
      let correctCount = 0;
      for (const ex of exercises) {
        if (isCorrect(ex)) correctCount++;
      }
      const score = totalExercises > 0 ? Math.round((correctCount / totalExercises) * 100) : 0;
      const res = await apiCompleteLesson(lesson.id, score);
      setResults(res);
      setCompleted(true);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to submit lesson');
    } finally {
      setSubmitting(false);
    }
  };

  const getExerciseIcon = (type: Exercise['type']) => {
    switch (type) {
      case 'listenRepeat': return '🎧';
      case 'speakTheAnswer': return '🎤';
      case 'fillInBlank': return '✏️';
      case 'multipleChoice': return '📋';
      case 'reorderWords': return '🔀';
      case 'matchPairs': return '🔗';
      case 'translate': return '🌐';
      default: return '📝';
    }
  };

  const getExerciseLabel = (type: Exercise['type']) => {
    switch (type) {
      case 'listenRepeat': return 'Listen & Repeat';
      case 'speakTheAnswer': return 'Speak the Answer';
      case 'fillInBlank': return 'Fill in the Blank';
      case 'multipleChoice': return 'Multiple Choice';
      case 'reorderWords': return 'Reorder Words';
      case 'matchPairs': return 'Match Pairs';
      case 'translate': return 'Translate';
      default: return 'Exercise';
    }
  };

  // ─── LOADING ─────────
  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={TG.headerBg} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={TG.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!lesson || exercises.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={TG.headerBg} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft size={22} color={TG.textWhite} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Lesson</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.emptyText}>No exercises found</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── COMPLETE SCREEN ──
  if (completed && results) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={TG.headerBg} />
        <View style={styles.completeContainer}>
          <View style={styles.completeIconWrap}>
            <Text style={styles.completeEmoji}>{'🎉'}</Text>
          </View>
          <Text style={styles.completeTitle}>Lesson Complete!</Text>
          <Text style={styles.completeXP}>+{results.xpEarned} XP</Text>
          <View style={styles.completeActions}>
            <TouchableOpacity
              style={[styles.completeBtn, { backgroundColor: TG.accent }]}
              onPress={() => router.back()}
            >
              <Text style={styles.completeBtnText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ─── EXERCISE VIEW ────
  const ex = currentExercise;
  const isRevealed = revealed[ex.id];
  const correct = isRevealed ? isCorrect(ex) : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={TG.headerBg} />

      {/* Header with progress */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            Alert.alert('Leave Lesson?', 'Your progress will be lost.', [
              { text: 'Stay', style: 'cancel' },
              { text: 'Leave', style: 'destructive', onPress: () => router.back() },
            ]);
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <X size={22} color={TG.textWhite} />
        </TouchableOpacity>
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
          </View>
        </View>
        <Text style={styles.progressLabel}>
          {currentIndex + 1}/{totalExercises}
        </Text>
      </View>

      <ScrollView
        style={styles.exerciseContainer}
        contentContainerStyle={styles.exerciseContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Exercise type label */}
        <View style={styles.exerciseTypeRow}>
          <Text style={styles.exerciseIcon}>{getExerciseIcon(ex.type)}</Text>
          <Text style={styles.exerciseTypeLabel}>{getExerciseLabel(ex.type)}</Text>
        </View>

        {/* Prompt */}
        <Text style={styles.promptText}>{ex.prompt}</Text>

        {/* Audio play button for listen-based exercises */}
        {(ex.type === 'listenRepeat') && ex.audioUrl && (
          <TouchableOpacity style={styles.audioBtn}>
            <Volume2 size={22} color="#fff" />
            <Text style={styles.audioBtnText}>Play Audio</Text>
          </TouchableOpacity>
        )}

        {/* ── Input Area ──────────────── */}
        {(ex.type === 'fillInBlank' || ex.type === 'translate') && (
          <TextInput
            style={[styles.textInput, isRevealed && (correct ? styles.inputCorrect : styles.inputWrong)]}
            placeholder="Type your answer..."
            placeholderTextColor={TG.textHint}
            value={answers[ex.id] || ''}
            onChangeText={(text) => handleAnswer(ex.id, text)}
            editable={!isRevealed}
            multiline
          />
        )}

        {(ex.type === 'listenRepeat' || ex.type === 'speakTheAnswer') && (
          <View style={styles.speakSection}>
            <TextInput
              style={[styles.textInput, isRevealed && (correct ? styles.inputCorrect : styles.inputWrong)]}
              placeholder="Type or speak your answer..."
              placeholderTextColor={TG.textHint}
              value={answers[ex.id] || ''}
              onChangeText={(text) => handleAnswer(ex.id, text)}
              editable={!isRevealed}
              multiline
            />
            <TouchableOpacity style={styles.micBtn}>
              <Mic size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {ex.type === 'multipleChoice' && ex.options && (
          <View style={styles.optionsContainer}>
            {ex.options.map((opt, i) => {
              const isSelected = selectedOptions[ex.id] === opt;
              const isCorrectOpt = isRevealed && opt.toLowerCase().trim() === (ex.correctAnswer || '').toLowerCase().trim();
              const isWrongSelected = isRevealed && isSelected && !isCorrectOpt;
              return (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.optionBtn,
                    isSelected && !isRevealed && styles.optionSelected,
                    isCorrectOpt && styles.optionCorrect,
                    isWrongSelected && styles.optionWrong,
                  ]}
                  onPress={() => !isRevealed && handleOptionSelect(ex.id, opt)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.optionText,
                      isSelected && !isRevealed && styles.optionTextSelected,
                      isCorrectOpt && styles.optionTextCorrect,
                    ]}
                  >
                    {opt}
                  </Text>
                  {isCorrectOpt && <Check size={16} color={TG.scoreGreen} />}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {ex.type === 'reorderWords' && ex.options && (
          <View>
            <View style={styles.reorderAnswer}>
              {(reorderWords[ex.id] || []).map((word, i) => (
                <TouchableOpacity
                  key={`ans-${i}`}
                  style={styles.reorderWordActive}
                  onPress={() => !isRevealed && handleReorder(ex.id, word)}
                >
                  <Text style={styles.reorderWordActiveText}>{word}</Text>
                </TouchableOpacity>
              ))}
              {(reorderWords[ex.id] || []).length === 0 && (
                <Text style={styles.reorderPlaceholder}>Tap words to build sentence...</Text>
              )}
            </View>
            <View style={styles.reorderPool}>
              {ex.options.map((word, i) => {
                const used = (reorderWords[ex.id] || []).includes(word);
                return (
                  <TouchableOpacity
                    key={`pool-${i}`}
                    style={[styles.reorderWord, used && styles.reorderWordUsed]}
                    onPress={() => !isRevealed && !used && handleReorder(ex.id, word)}
                  >
                    <Text style={[styles.reorderWordText, used && styles.reorderWordTextUsed]}>{word}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Hints */}
        {ex.hints && ex.hints.length > 0 && (
          <View style={styles.hintContainer}>
            <Text style={styles.hintLabel}>💡 Hint</Text>
            {ex.hints.map((h, i) => (
              <Text key={i} style={styles.hintText}>{h}</Text>
            ))}
          </View>
        )}

        {/* Revealed result */}
        {isRevealed && (
          <View style={[styles.resultBanner, correct ? styles.resultCorrect : styles.resultWrong]}>
            <Text style={styles.resultText}>{correct ? '✅ Correct!' : '❌ Incorrect'}</Text>
            {!correct && ex.correctAnswer && (
              <Text style={styles.resultAnswer}>Answer: {ex.correctAnswer}</Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* Bottom action */}
      <View style={styles.bottomBar}>
        {!isRevealed ? (
          <TouchableOpacity
            style={[styles.checkBtn, !isCurrentAnswered() && styles.checkBtnDisabled]}
            onPress={checkAnswer}
            disabled={!isCurrentAnswered()}
          >
            <Text style={styles.checkBtnText}>Check</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.nextBtn} onPress={goNext} disabled={submitting}>
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.nextBtnText}>
                  {currentIndex < totalExercises - 1 ? 'Continue' : 'Finish'}
                </Text>
                <ChevronRight size={18} color="#fff" />
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TG.headerBg },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: TG.bgSecondary },
  emptyText: { fontSize: 15, color: TG.textSecondary },

  // Header
  header: {
    backgroundColor: TG.headerBg,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: TG.textWhite, flex: 1 },
  progressBarContainer: { flex: 1 },
  progressBarBg: { height: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: 8, borderRadius: 4, backgroundColor: TG.scoreGreen },
  progressLabel: { fontSize: 13, fontWeight: '700', color: TG.textWhite, minWidth: 36, textAlign: 'right' },

  // Exercise content
  exerciseContainer: { flex: 1, backgroundColor: TG.bgSecondary },
  exerciseContent: { padding: 20, paddingBottom: 120 },
  exerciseTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  exerciseIcon: { fontSize: 22 },
  exerciseTypeLabel: { fontSize: 14, fontWeight: '600', color: TG.textSecondary },
  promptText: { fontSize: 20, fontWeight: '700', color: TG.textPrimary, lineHeight: 28, marginBottom: 24 },

  // Audio button
  audioBtn: {
    backgroundColor: TG.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 20,
  },
  audioBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Text input
  textInput: {
    backgroundColor: TG.bg,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: TG.textPrimary,
    borderWidth: 2,
    borderColor: TG.separator,
    minHeight: 56,
  },
  inputCorrect: { borderColor: TG.scoreGreen, backgroundColor: TG.scoreGreen + '10' },
  inputWrong: { borderColor: TG.scoreRed, backgroundColor: TG.scoreRed + '10' },

  // Speak section
  speakSection: { gap: 10 },
  micBtn: {
    backgroundColor: TG.streakOrange,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },

  // Multiple choice
  optionsContainer: { gap: 10 },
  optionBtn: {
    backgroundColor: TG.bg,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: TG.separator,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionSelected: { borderColor: TG.accent, backgroundColor: TG.accentLight },
  optionCorrect: { borderColor: TG.scoreGreen, backgroundColor: TG.scoreGreen + '10' },
  optionWrong: { borderColor: TG.scoreRed, backgroundColor: TG.scoreRed + '10' },
  optionText: { fontSize: 15, color: TG.textPrimary, flex: 1 },
  optionTextSelected: { color: TG.accent, fontWeight: '600' },
  optionTextCorrect: { color: TG.scoreGreen, fontWeight: '600' },

  // Reorder
  reorderAnswer: {
    backgroundColor: TG.bg,
    borderRadius: 14,
    padding: 14,
    minHeight: 56,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    borderWidth: 2,
    borderColor: TG.separator,
    marginBottom: 14,
  },
  reorderPlaceholder: { color: TG.textHint, fontSize: 14 },
  reorderPool: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reorderWord: {
    backgroundColor: TG.bg,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: TG.separator,
  },
  reorderWordUsed: { opacity: 0.3 },
  reorderWordText: { fontSize: 15, color: TG.textPrimary, fontWeight: '500' },
  reorderWordTextUsed: { color: TG.textHint },
  reorderWordActive: {
    backgroundColor: TG.accentLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  reorderWordActiveText: { fontSize: 15, color: TG.accent, fontWeight: '600' },

  // Hints
  hintContainer: {
    marginTop: 16,
    backgroundColor: TG.gold + '10',
    borderRadius: 12,
    padding: 12,
  },
  hintLabel: { fontSize: 13, fontWeight: '700', color: TG.gold, marginBottom: 4 },
  hintText: { fontSize: 13, color: TG.textSecondary, lineHeight: 19 },

  // Result banner
  resultBanner: {
    marginTop: 20,
    borderRadius: 14,
    padding: 16,
  },
  resultCorrect: { backgroundColor: TG.scoreGreen + '15' },
  resultWrong: { backgroundColor: TG.scoreRed + '15' },
  resultText: { fontSize: 17, fontWeight: '700', color: TG.textPrimary },
  resultAnswer: { fontSize: 14, color: TG.textSecondary, marginTop: 4 },

  // Bottom bar
  bottomBar: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: TG.bg,
    borderTopWidth: 0.5,
    borderTopColor: TG.separator,
  },
  checkBtn: {
    backgroundColor: TG.accent,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  checkBtnDisabled: { opacity: 0.4 },
  checkBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  nextBtn: {
    backgroundColor: TG.scoreGreen,
    paddingVertical: 16,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  nextBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  // Complete
  completeContainer: {
    flex: 1,
    backgroundColor: TG.bgSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  completeIconWrap: { marginBottom: 20 },
  completeEmoji: { fontSize: 64 },
  completeTitle: { fontSize: 26, fontWeight: '800', color: TG.textPrimary, marginBottom: 8 },
  completeScore: { fontSize: 20, fontWeight: '700', color: TG.textSecondary, marginBottom: 4 },
  completeXP: { fontSize: 18, fontWeight: '700', color: TG.gold, marginBottom: 30 },
  completeActions: { width: '100%' },
  completeBtn: { paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  completeBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
