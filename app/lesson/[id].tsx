import { TG } from '@/constants/theme';
import { apiCompleteSession, apiFetchLesson, apiStartLessonSession, apiSubmitAttempt } from '@/lib/api';
import type { Exercise, ExerciseSession, ExerciseType, LessonDetail } from '@/lib/types';
import { useAudioPlayer } from 'expo-audio';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Check,
  Flag,
  Heart,
  Mic,
  RotateCcw,
  Volume2,
  X
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Confetti } from 'react-native-fast-confetti';
import { SafeAreaView } from 'react-native-safe-area-context';

const correctSound = require('@/assets/audios/correct.mp3');
const wrongSound = require('@/assets/audios/wrong.mp3');
const lessonCompleteSound = require('@/assets/audios/lesson-complete.mp3');

// ─── Constants ──────────────────────────────────────────────

const MAX_HEARTS = 5;
const SCREEN_WIDTH = Dimensions.get('window').width;

const TYPE_META: Record<ExerciseType, { icon: string; label: string }> = {
  listenRepeat: { icon: '🎧', label: 'Listen & Repeat' },
  speakTheAnswer: { icon: '🎤', label: 'Speak the Answer' },
  fillInBlank: { icon: '✏️', label: 'Fill in the Blank' },
  multipleChoice: { icon: '📋', label: 'Choose the Correct Answer' },
  listenAndChoose: { icon: '👂', label: 'Listen & Choose' },
  tapWhatYouHear: { icon: '🔊', label: 'Tap What You Hear' },
  pronunciation: { icon: '🗣️', label: 'Pronunciation' },
  matchPairs: { icon: '🔗', label: 'Match Pairs' },
  reorderWords: { icon: '🔀', label: 'Reorder Words' },
  translateSentence: { icon: '🌐', label: 'Translate Sentence' },
  completeConversation: { icon: '💬', label: 'Complete Conversation' },
  roleplay: { icon: '🎭', label: 'Roleplay' },
};

// ─── Answer validation ──────────────────────────────────────

function normalizeText(s: string) {
  return s.toLowerCase().trim().replace(/[.,!?;:'"]/g, '').replace(/\s+/g, ' ');
}

function validateAnswer(exercise: Exercise, userAnswer: string, selectedOption?: string, reorderResult?: string[], matchedPairs?: Record<string, string>, conversationAnswers?: Record<number, string>): boolean {
  const t = exercise.type;

  if (['multipleChoice', 'listenAndChoose', 'tapWhatYouHear'].includes(t)) {
    if (!selectedOption) return false;
    const correctOpt = exercise.options?.find((o) => o.isCorrect);
    return correctOpt ? normalizeText(selectedOption) === normalizeText(correctOpt.text) : false;
  }

  if (t === 'fillInBlank') {
    if (selectedOption) {
      const correctOpt = exercise.options?.find((o) => o.isCorrect);
      return correctOpt ? normalizeText(selectedOption) === normalizeText(correctOpt.text) : false;
    }
    return exercise.correctAnswer ? normalizeText(userAnswer) === normalizeText(exercise.correctAnswer) : false;
  }

  if (['listenRepeat', 'speakTheAnswer', 'pronunciation'].includes(t)) {
    const target = exercise.targetText || exercise.correctAnswer || '';
    return normalizeText(userAnswer) === normalizeText(target);
  }

  if (t === 'reorderWords' || t === 'translateSentence') {
    if (!reorderResult?.length) return false;
    const userSentence = reorderResult.join(' ');
    const correctWords = exercise.wordBankItems?.filter((w) => !w.isDistractor).sort((a, b) => a.correctPosition - b.correctPosition).map((w) => w.text) || [];
    return normalizeText(userSentence) === normalizeText(correctWords.join(' '));
  }

  if (t === 'matchPairs') {
    if (!matchedPairs || !exercise.matchPairs?.length) return false;
    return exercise.matchPairs.every((p) => normalizeText(matchedPairs[p.leftText] || '') === normalizeText(p.rightText));
  }

  if (t === 'completeConversation') {
    if (!conversationAnswers || !exercise.conversationLines?.length) return true;
    const userTurns = exercise.conversationLines.filter((l) => l.isUserTurn);
    return userTurns.every((turn, i) => {
      const ans = conversationAnswers[i] || '';
      if (turn.acceptedAnswers?.length) {
        return turn.acceptedAnswers.some((a) => normalizeText(ans) === normalizeText(a));
      }
      return ans.trim().length > 0;
    });
  }

  if (t === 'roleplay') return (userAnswer || '').trim().length > 0;

  return exercise.correctAnswer ? normalizeText(userAnswer) === normalizeText(exercise.correctAnswer) : false;
}

// ─── Component ──────────────────────────────────────────────

export default function LessonPlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  // Data
  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<ExerciseSession | null>(null);

  // Game state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hearts, setHearts] = useState(MAX_HEARTS);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [mistakes, setMistakes] = useState<number[]>([]);

  // Per-exercise answers
  const [textAnswers, setTextAnswers] = useState<Record<string, string>>({});
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [reorderWords, setReorderWords] = useState<Record<string, string[]>>({});
  const [matchedPairs, setMatchedPairs] = useState<Record<string, Record<string, string>>>({});
  const [matchSelection, setMatchSelection] = useState<{ side: 'left' | 'right'; text: string } | null>(null);
  const [conversationAnswers, setConversationAnswers] = useState<Record<string, Record<number, string>>>({});

  // UI state
  const [revealed, setRevealed] = useState(false);
  const [isCorrectResult, setIsCorrectResult] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [showHint, setShowHint] = useState(false);

  // Audio
  const correctPlayer = useAudioPlayer(correctSound);
  const wrongPlayer = useAudioPlayer(wrongSound);
  const completePlayer = useAudioPlayer(lessonCompleteSound);

  // Animations
  const comboAnim = useRef(new Animated.Value(1)).current;
  const heartShake = useRef(new Animated.Value(0)).current;
  const xpPop = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const loadLesson = useCallback(async () => {
    if (!id) return;
    try {
      const data = await apiFetchLesson(id);
      setLesson(data);
      try {
        const result = await apiStartLessonSession(id);
        setSession(result.session);
      } catch {
        // Session API optional — continue without it
      }
    } catch (e) {
      console.error('Failed to load lesson', e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadLesson(); }, [loadLesson]);

  const exercises = useMemo(() => lesson?.exercises?.sort((a, b) => a.order - b.order) || [], [lesson]);
  const currentExercise = exercises[currentIndex];

  // Shuffled word bank for reorder/translate (must be before early returns)
  const wordBank = useMemo(() => {
    const ex = currentExercise;
    if (!ex || (ex.type !== 'reorderWords' && ex.type !== 'translateSentence')) return [];
    const items = ex.wordBankItems || [];
    return [...items].sort(() => Math.random() - 0.5);
  }, [currentExercise?.id, currentExercise?.type]);
  const totalExercises = exercises.length;
  const progress = totalExercises > 0 ? ((currentIndex + (revealed ? 1 : 0)) / totalExercises) * 100 : 0;

  // ─── Animations ──────────────────────────────────────────

  const pulseCombo = () => {
    comboAnim.setValue(1.4);
    Animated.spring(comboAnim, { toValue: 1, friction: 4, useNativeDriver: true }).start();
  };

  const shakeHearts = () => {
    Animated.sequence([
      Animated.timing(heartShake, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(heartShake, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(heartShake, { toValue: 4, duration: 60, useNativeDriver: true }),
      Animated.timing(heartShake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const popXp = (amount: number) => {
    xpPop.setValue(1);
    Animated.timing(xpPop, { toValue: 0, duration: 1200, useNativeDriver: true }).start();
  };

  // Animate progress bar smoothly
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress]);



  // ─── Input handlers ──────────────────────────────────────

  const handleTextAnswer = (exId: string, text: string) => {
    setTextAnswers((p) => ({ ...p, [exId]: text }));
  };

  const handleOptionSelect = (exId: string, opt: string) => {
    setSelectedOptions((p) => ({ ...p, [exId]: opt }));
  };

  const handleReorder = (exId: string, word: string) => {
    setReorderWords((p) => {
      const current = p[exId] || [];
      if (current.includes(word)) return { ...p, [exId]: current.filter((w) => w !== word) };
      return { ...p, [exId]: [...current, word] };
    });
  };

  const handleMatchTap = (exId: string, side: 'left' | 'right', text: string) => {
    if (!matchSelection) {
      setMatchSelection({ side, text });
      return;
    }
    if (matchSelection.side === side) {
      setMatchSelection({ side, text });
      return;
    }
    const left = side === 'left' ? text : matchSelection.text;
    const right = side === 'right' ? text : matchSelection.text;
    setMatchedPairs((p) => ({ ...p, [exId]: { ...(p[exId] || {}), [left]: right } }));
    setMatchSelection(null);
  };

  const handleConvoAnswer = (exId: string, turnIndex: number, text: string) => {
    setConversationAnswers((p) => ({
      ...p,
      [exId]: { ...(p[exId] || {}), [turnIndex]: text },
    }));
  };

  // ─── Check / next ────────────────────────────────────────

  const isCurrentAnswered = (): boolean => {
    if (!currentExercise) return false;
    const { id: eid, type } = currentExercise;

    if (['multipleChoice', 'listenAndChoose', 'tapWhatYouHear'].includes(type)) return !!selectedOptions[eid];
    if (['fillInBlank', 'speakTheAnswer', 'listenRepeat', 'pronunciation', 'roleplay'].includes(type)) return !!(textAnswers[eid]?.trim());
    if (type === 'reorderWords' || type === 'translateSentence') return (reorderWords[eid]?.length || 0) >= 2;
    if (type === 'matchPairs') {
      const pairs = matchedPairs[eid] || {};
      return Object.keys(pairs).length >= (currentExercise.matchPairs?.length || 0);
    }
    if (type === 'completeConversation') {
      const userTurns = currentExercise.conversationLines?.filter((l) => l.isUserTurn) || [];
      const answers = conversationAnswers[eid] || {};
      return userTurns.every((_, i) => (answers[i] || '').trim().length > 0);
    }
    return true;
  };

  const checkAnswer = async () => {
    if (!currentExercise) return;
    const ex = currentExercise;

    const correct = validateAnswer(
      ex,
      textAnswers[ex.id] || '',
      selectedOptions[ex.id],
      reorderWords[ex.id],
      matchedPairs[ex.id],
      conversationAnswers[ex.id],
    );

    setRevealed(true);
    setIsCorrectResult(correct);

    if (correct) {
      correctPlayer.seekTo(0);
      correctPlayer.play();
      const comboBonus = combo >= 3 ? Math.floor((ex.xpReward || 10) * 0.2) : 0;
      const earned = (ex.xpReward || 10) + comboBonus;
      setXpEarned((p) => p + earned);
      setCorrectCount((p) => p + 1);
      setCombo((p) => {
        const next = p + 1;
        if (next > maxCombo) setMaxCombo(next);
        return next;
      });
      pulseCombo();
      popXp(earned);
    } else {
      wrongPlayer.seekTo(0);
      wrongPlayer.play();
      const newHearts = hearts - 1;
      setHearts(newHearts);
      setCombo(0);
      setMistakes((p) => [...p, currentIndex]);
      shakeHearts();
      if (newHearts <= 0) {
        setGameOver(true);
      }
    }

    // Submit to session API if available
    if (session?.id) {
      try {
        await apiSubmitAttempt(session.id, {
          exerciseId: ex.id,
          userAnswer: { value: textAnswers[ex.id] || selectedOptions[ex.id] || (reorderWords[ex.id] || []).join(' ') || '' },
          isCorrect: correct,
          timeTakenMs: 0,
        });
      } catch { /* ignore */ }
    }
  };

  const goNext = () => {
    if (currentIndex < totalExercises - 1) {
      setCurrentIndex((p) => p + 1);
      setRevealed(false);
      setIsCorrectResult(null);
      setMatchSelection(null);
      setShowHint(false);
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    setSubmitting(true);
    try {
      if (session?.id) {
        await apiCompleteSession(session.id);
      }
    } catch { /* ignore */ }
    completePlayer.seekTo(0);
    completePlayer.play();
    setCompleted(true);
    setSubmitting(false);
  };

  const restartLesson = () => {
    setCurrentIndex(0);
    setHearts(MAX_HEARTS);
    setCombo(0);
    setMaxCombo(0);
    setXpEarned(0);
    setCorrectCount(0);
    setMistakes([]);
    setTextAnswers({});
    setSelectedOptions({});
    setReorderWords({});
    setMatchedPairs({});
    setConversationAnswers({});
    setRevealed(false);
    setIsCorrectResult(null);
    setCompleted(false);
    setGameOver(false);
    setReviewMode(false);
  };

  // ─── LOADING ─────────────────────────────────────────────

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
          <TouchableOpacity onPress={() => router.back()}><ArrowLeft size={22} color={TG.textWhite} /></TouchableOpacity>
          <Text style={styles.headerTitle}>Lesson</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.loadingContainer}><Text style={styles.emptyText}>No exercises found</Text></View>
      </SafeAreaView>
    );
  }

  // ─── GAME OVER ───────────────────────────────────────────

  if (gameOver) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={TG.headerBg} />
        <View style={styles.completeContainer}>
          <Text style={styles.completeEmoji}>💔</Text>
          <Text style={styles.completeTitle}>Out of Hearts!</Text>
          <Text style={styles.completeSubtitle}>
            You got {correctCount} out of {currentIndex + 1} right
          </Text>
          <View style={styles.completeActions}>
            <TouchableOpacity style={[styles.completeBtn, styles.completeBtnPrimary]} onPress={restartLesson} activeOpacity={0.8}>
              <RotateCcw size={18} color="#fff" />
              <Text style={styles.completeBtnText}>TRY AGAIN</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.completeBtn, styles.completeBtnSecondary]} onPress={() => router.back()} activeOpacity={0.8}>
              <Text style={[styles.completeBtnText, styles.completeBtnSecondaryText]}>LEAVE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ─── COMPLETE SCREEN ─────────────────────────────────────

  if (completed) {
    if (reviewMode) {
      const reviewEx = exercises[mistakes[reviewIndex]];
      const userText = textAnswers[reviewEx.id] || '';
      const userOption = selectedOptions[reviewEx.id] || '';
      const userReorder = reorderWords[reviewEx.id] || [];
      const userMatches = matchedPairs[reviewEx.id] || {};
      const userConvo = conversationAnswers[reviewEx.id] || {};
      const hasOptions = ['multipleChoice', 'listenAndChoose', 'tapWhatYouHear'].includes(reviewEx.type) ||
        (reviewEx.type === 'fillInBlank' && reviewEx.options && reviewEx.options.length > 0);

      return (
        <SafeAreaView style={styles.safeArea}>
          <StatusBar barStyle="light-content" backgroundColor={TG.headerBg} />
          <View style={styles.reviewHeader}>
            <TouchableOpacity style={styles.reviewCloseBtn} onPress={() => setReviewMode(false)} activeOpacity={0.7}>
              <X size={20} color="#AFAFAF" />
            </TouchableOpacity>
            <View style={styles.reviewProgressRow}>
              <View style={styles.reviewProgressBarBg}>
                <View style={[styles.reviewProgressBarFill, { width: `${((reviewIndex + 1) / mistakes.length) * 100}%` }]} />
              </View>
              <Text style={styles.reviewProgressCount}>{reviewIndex + 1}/{mistakes.length}</Text>
            </View>
          </View>
          <ScrollView style={styles.exerciseContainer} contentContainerStyle={styles.exerciseContent}>
            <View style={styles.exerciseTypeRow}>
              <Text style={styles.exerciseTypeLabel}>{TYPE_META[reviewEx.type]?.label}</Text>
            </View>
            <Text style={styles.promptText}>{reviewEx.prompt}</Text>

            {/* Sentence template for fill-in-blank */}
            {reviewEx.type === 'fillInBlank' && reviewEx.sentenceTemplate && (
              <View style={styles.sentenceWrap}>
                {reviewEx.sentenceTemplate.split('___').map((part, i, arr) => (
                  <React.Fragment key={i}>
                    <Text style={styles.sentenceText}>{part}</Text>
                    {i < arr.length - 1 && (
                      <View style={[styles.blankSlot, styles.blankWrong]}>
                        <Text style={styles.blankText}>{userOption || userText || '___'}</Text>
                      </View>
                    )}
                  </React.Fragment>
                ))}
              </View>
            )}

            {/* Options with correct/wrong highlighting */}
            {hasOptions && reviewEx.options && (
              <View style={styles.optionsContainer}>
                {reviewEx.options.map((opt) => {
                  const wasSelected = userOption === opt.text;
                  const isCorrectOpt = opt.isCorrect;
                  return (
                    <View
                      key={opt.id || opt.text}
                      style={[
                        styles.reviewOptionCard,
                        isCorrectOpt && styles.reviewOptionCorrect,
                        wasSelected && !isCorrectOpt && styles.reviewOptionWrong,
                      ]}
                    >
                      <Text style={[
                        styles.reviewOptionText,
                        isCorrectOpt && styles.reviewOptionTextCorrect,
                        wasSelected && !isCorrectOpt && styles.reviewOptionTextWrong,
                      ]}>
                        {opt.text}
                      </Text>
                      {isCorrectOpt && <Check size={16} color="#58CC02" />}
                      {wasSelected && !isCorrectOpt && <X size={16} color="#FF4B4B" />}
                    </View>
                  );
                })}
              </View>
            )}

            {/* Text answer for speaking/typing types */}
            {!hasOptions && userText ? (
              <View style={[styles.resultBanner, styles.resultWrong]}>
                <Text style={styles.resultText}>Your Answer</Text>
                <Text style={styles.resultAnswer}>{userText}</Text>
              </View>
            ) : null}

            {/* Reorder words result */}
            {(reviewEx.type === 'reorderWords' || reviewEx.type === 'translateSentence') && userReorder.length > 0 && (
              <View style={[styles.resultBanner, styles.resultWrong]}>
                <Text style={styles.resultText}>Your Answer</Text>
                <Text style={styles.resultAnswer}>{userReorder.join(' ')}</Text>
              </View>
            )}

            {/* Match pairs result */}
            {reviewEx.type === 'matchPairs' && Object.keys(userMatches).length > 0 && (
              <View style={[styles.resultBanner, styles.resultWrong]}>
                <Text style={styles.resultText}>Your Pairs</Text>
                {Object.entries(userMatches).map(([left, right]) => (
                  <Text key={left} style={styles.resultAnswer}>{left} → {right}</Text>
                ))}
              </View>
            )}

            {/* Conversation answers */}
            {(reviewEx.type === 'completeConversation' || reviewEx.type === 'roleplay') && Object.keys(userConvo).length > 0 && (
              <View style={[styles.resultBanner, styles.resultWrong]}>
                <Text style={styles.resultText}>Your Answers</Text>
                {Object.values(userConvo).map((ans, i) => (
                  <Text key={i} style={styles.resultAnswer}>{ans}</Text>
                ))}
              </View>
            )}

            {/* Correct answer */}
            {reviewEx.correctAnswer && (
              <View style={[styles.resultBanner, styles.resultCorrect]}>
                <Text style={styles.resultText}>✅ Correct Answer</Text>
                <Text style={styles.resultAnswer}>{reviewEx.correctAnswer}</Text>
              </View>
            )}

            {/* Correct pairs */}
            {reviewEx.type === 'matchPairs' && reviewEx.matchPairs && reviewEx.matchPairs.length > 0 && (
              <View style={[styles.resultBanner, styles.resultCorrect]}>
                <Text style={styles.resultText}>✅ Correct Pairs</Text>
                {reviewEx.matchPairs.map((pair) => (
                  <Text key={pair.leftText} style={styles.resultAnswer}>{pair.leftText} → {pair.rightText}</Text>
                ))}
              </View>
            )}

            {reviewEx.explanation && (
              <View style={styles.explanationBox}>
                <Text style={styles.explanationTitle}>💡 Explanation</Text>
                <Text style={styles.explanationText}>{reviewEx.explanation}</Text>
              </View>
            )}
          </ScrollView>
          <View style={styles.bottomPanel}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnActive]}
              onPress={() => {
                if (reviewIndex < mistakes.length - 1) setReviewIndex((p) => p + 1);
                else setReviewMode(false);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.actionBtnText}>
                {reviewIndex < mistakes.length - 1 ? 'NEXT MISTAKE' : 'DONE'}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={TG.headerBg} />
        <Confetti
          count={200}
          flakeSize={{ width: 12, height: 12 }}
          fadeOutOnEnd
          cannonsPositions={[
            { x: 0, y: Dimensions.get('window').height },
            { x: SCREEN_WIDTH, y: Dimensions.get('window').height },
          ]}
          colors={['#FFB800', '#FF9600', '#58CC02', '#FF4B4B', '#1CB0F6', '#CE82FF']}
          containerStyle={StyleSheet.absoluteFill}
        />
        <View style={styles.completeContainer}>
          <Text style={styles.completeEmoji}>🎉</Text>
          <Text style={styles.completeTitle}>Lesson Complete!</Text>

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statIcon}>⚡</Text>
              <View style={styles.statInfo}>
                <Text style={[styles.statValue, { color: '#FFB800' }]}>+{xpEarned}</Text>
                <Text style={styles.statLabel}>XP</Text>
              </View>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statIcon}>🔥</Text>
              <View style={styles.statInfo}>
                <Text style={[styles.statValue, { color: '#FF9600' }]}>{maxCombo}x</Text>
                <Text style={styles.statLabel}>Combo</Text>
              </View>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statIcon}>✅</Text>
              <View style={styles.statInfo}>
                <Text style={[styles.statValue, { color: '#58CC02' }]}>{correctCount}/{totalExercises}</Text>
                <Text style={styles.statLabel}>Correct</Text>
              </View>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statIcon}>❤️</Text>
              <View style={styles.statInfo}>
                <Text style={[styles.statValue, { color: '#FF4B4B' }]}>{hearts}</Text>
                <Text style={styles.statLabel}>Hearts</Text>
              </View>
            </View>
          </View>

          <View style={styles.completeActions}>
            <TouchableOpacity style={[styles.completeBtn, styles.completeBtnPrimary]} onPress={() => router.back()} activeOpacity={0.8}>
              <Text style={styles.completeBtnText}>CONTINUE</Text>
            </TouchableOpacity>
            {mistakes.length > 0 && (
              <TouchableOpacity
                style={[styles.completeBtn, styles.completeBtnSecondary]}
                onPress={() => { setReviewMode(true); setReviewIndex(0); }}
                activeOpacity={0.8}
              >
                <Text style={[styles.completeBtnText, styles.completeBtnSecondaryText]}>REVIEW {mistakes.length} MISTAKE{mistakes.length !== 1 ? 'S' : ''}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ─── EXERCISE VIEW ───────────────────────────────────────

  const ex = currentExercise;
  const meta = TYPE_META[ex.type] || { icon: '📝', label: 'Exercise' };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={TG.headerBg} />

      {/* ── Header ─────────────────── */}
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
          <X size={22} color={TG.textSecondary} strokeWidth={2.5} />
        </TouchableOpacity>

        <View style={styles.progressBarContainer}>
          <View style={styles.progressBarBg}>
            <Animated.View
              style={[
                styles.progressBarFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%'],
                    extrapolate: 'clamp',
                  }),
                },
              ]}
            >
              {/* Center highlight line */}
              <View style={styles.progressHighlight} />
            </Animated.View>
          </View>
        </View>

        {/* Hearts */}
        <Animated.View style={[styles.heartsRow, { transform: [{ translateX: heartShake }] }]}>
          <Heart size={16} color={TG.red} fill={hearts > 0 ? TG.red : 'transparent'} />
          <Text style={styles.heartsText}>{hearts}</Text>
        </Animated.View>
      </View>

      {/* ── Combo bar ─────────────── */}
      {combo >= 2 && (
        <Animated.View style={[styles.comboBar, { transform: [{ scale: comboAnim }] }]}>
          <Text style={styles.comboText}>🔥 {combo}x Combo!</Text>
        </Animated.View>
      )}

      {/* ── XP pop ─────────────────── */}
      <Animated.View
        pointerEvents="none"
        style={[styles.xpPopup, { opacity: xpPop, transform: [{ translateY: xpPop.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] }) }] }]}
      >
        <Text style={styles.xpPopupText}>+{ex.xpReward || 10} XP</Text>
      </Animated.View>

      <ScrollView
        style={styles.exerciseContainer}
        contentContainerStyle={styles.exerciseContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Type badge */}
        <View style={styles.exerciseTypeRow}>
          <Text style={styles.exerciseTypeLabel}>{meta.label}</Text>
          {ex.hints && ex.hints.length > 0 && !revealed && (
            <TouchableOpacity style={styles.hintIconBtn} onPress={() => setShowHint(!showHint)} activeOpacity={0.7}>
              <Flag size={18} color={showHint ? "#7E22CE" : "#8B5CF6"} strokeWidth={showHint ? 3 : 2.5} />
            </TouchableOpacity>
          )}
        </View>

        {/* Prompt */}
        <Text style={styles.promptText}>{ex.prompt}</Text>

        {/* ── Audio button ───────────── */}
        {['listenRepeat', 'listenAndChoose', 'tapWhatYouHear', 'pronunciation'].includes(ex.type) && ex.audioUrl && (
          <TouchableOpacity style={styles.audioBtn} activeOpacity={0.7}>
            <Volume2 size={22} color="#fff" />
            <Text style={styles.audioBtnText}>Play Audio</Text>
          </TouchableOpacity>
        )}

        {/* ── Sentence template (fill in blank) ── */}
        {ex.type === 'fillInBlank' && ex.sentenceTemplate && (
          <View style={styles.sentenceWrap}>
            {ex.sentenceTemplate.split('___').map((part, i, arr) => (
              <React.Fragment key={i}>
                <Text style={styles.sentenceText}>{part}</Text>
                {i < arr.length - 1 && (
                  <View style={[styles.blankSlot, revealed && (isCorrectResult ? styles.blankCorrect : styles.blankWrong)]}>
                    <Text style={styles.blankText}>
                      {selectedOptions[ex.id] || textAnswers[ex.id] || '___'}
                    </Text>
                  </View>
                )}
              </React.Fragment>
            ))}
          </View>
        )}

        {/* ── Text input types ───────── */}
        {(['fillInBlank', 'speakTheAnswer', 'listenRepeat', 'pronunciation', 'roleplay'].includes(ex.type)) && (
          <View style={styles.speakSection}>
            {ex.type === 'pronunciation' && ex.targetText && (
              <Text style={styles.targetTextDisplay}>"{ex.targetText}"</Text>
            )}
            <TextInput
              style={[
                styles.textInput,
                revealed && (isCorrectResult ? styles.inputCorrect : styles.inputWrong),
              ]}
              placeholder={['listenRepeat', 'speakTheAnswer', 'pronunciation'].includes(ex.type) ? 'Type or speak your answer...' : 'Type your answer...'}
              placeholderTextColor={TG.textHint}
              value={textAnswers[ex.id] || ''}
              onChangeText={(t) => handleTextAnswer(ex.id, t)}
              editable={!revealed}
              multiline
            />
            {['listenRepeat', 'speakTheAnswer', 'pronunciation', 'roleplay'].includes(ex.type) && (
              <TouchableOpacity style={styles.micBtn} activeOpacity={0.7}>
                <Mic size={22} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Multiple choice / listenAndChoose / tapWhatYouHear ── */}
        {['multipleChoice', 'listenAndChoose', 'tapWhatYouHear'].includes(ex.type) && ex.options && (
          <View style={styles.optionsContainer}>
            {ex.options.map((opt) => {
              const isSelected = selectedOptions[ex.id] === opt.text;
              const isCorrectOpt = revealed && opt.isCorrect;
              const isWrongSelected = revealed && isSelected && !opt.isCorrect;
              return (
                <TouchableOpacity
                  key={opt.id || opt.text}
                  style={[
                    styles.optionBtn,
                    isSelected && !revealed && styles.optionSelected,
                    isCorrectOpt && styles.optionCorrect,
                    isWrongSelected && styles.optionWrong,
                  ]}
                  onPress={() => !revealed && handleOptionSelect(ex.id, opt.text)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.optionText,
                    isSelected && !revealed && styles.optionTextSelected,
                    isCorrectOpt && styles.optionTextCorrect,
                  ]}>
                    {opt.text}
                  </Text>
                  {isCorrectOpt && <Check size={16} color={TG.scoreGreen} />}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── Fill in blank options (dropdown mode) ── */}
        {ex.type === 'fillInBlank' && ex.options && ex.options.length > 0 && (
          <View style={styles.optionsContainer}>
            {ex.options.map((opt) => {
              const isSelected = selectedOptions[ex.id] === opt.text;
              const isCorrectOpt = revealed && opt.isCorrect;
              const isWrongSelected = revealed && isSelected && !opt.isCorrect;
              return (
                <TouchableOpacity
                  key={opt.id || opt.text}
                  style={[
                    styles.optionBtn,
                    isSelected && !revealed && styles.optionSelected,
                    isCorrectOpt && styles.optionCorrect,
                    isWrongSelected && styles.optionWrong,
                  ]}
                  onPress={() => !revealed && handleOptionSelect(ex.id, opt.text)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.optionText,
                    isSelected && !revealed && styles.optionTextSelected,
                    isCorrectOpt && styles.optionTextCorrect,
                  ]}>
                    {opt.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── Reorder words / Translate sentence ── */}
        {(ex.type === 'reorderWords' || ex.type === 'translateSentence') && (
          <View>
            <View style={[styles.reorderAnswer, revealed && (isCorrectResult ? styles.reorderCorrect : styles.reorderWrong)]}>
              {(reorderWords[ex.id] || []).map((word, i) => (
                <TouchableOpacity
                  key={`ans-${i}`}
                  style={styles.reorderWordActive}
                  onPress={() => !revealed && handleReorder(ex.id, word)}
                >
                  <Text style={styles.reorderWordActiveText}>{word}</Text>
                </TouchableOpacity>
              ))}
              {(reorderWords[ex.id] || []).length === 0 && (
                <Text style={styles.reorderPlaceholder}>Tap words to build sentence...</Text>
              )}
            </View>
            <View style={styles.reorderPool}>
              {wordBank.map((item, i) => {
                const used = (reorderWords[ex.id] || []).includes(item.text);
                return (
                  <TouchableOpacity
                    key={`pool-${i}`}
                    style={[styles.reorderWord, used && styles.reorderWordUsed]}
                    onPress={() => !revealed && !used && handleReorder(ex.id, item.text)}
                  >
                    <Text style={[styles.reorderWordText, used && styles.reorderWordTextUsed]}>{item.text}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Match pairs ────────────── */}
        {ex.type === 'matchPairs' && ex.matchPairs && (
          <View style={styles.matchContainer}>
            <View style={styles.matchColumn}>
              {ex.matchPairs.map((pair) => {
                const matched = matchedPairs[ex.id]?.[pair.leftText];
                const isActiveSelection = matchSelection?.side === 'left' && matchSelection.text === pair.leftText;
                return (
                  <TouchableOpacity
                    key={pair.leftText}
                    style={[
                      styles.matchCard,
                      isActiveSelection && styles.matchCardSelected,
                      matched && styles.matchCardMatched,
                    ]}
                    onPress={() => !revealed && !matched && handleMatchTap(ex.id, 'left', pair.leftText)}
                  >
                    <Text style={[styles.matchCardText, matched && styles.matchCardTextMatched]}>{pair.leftText}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.matchColumn}>
              {[...ex.matchPairs].sort(() => 0.5 - Math.random()).map((pair) => {
                const isUsed = Object.values(matchedPairs[ex.id] || {}).includes(pair.rightText);
                const isActiveSelection = matchSelection?.side === 'right' && matchSelection.text === pair.rightText;
                return (
                  <TouchableOpacity
                    key={pair.rightText}
                    style={[
                      styles.matchCard,
                      isActiveSelection && styles.matchCardSelected,
                      isUsed && styles.matchCardMatched,
                    ]}
                    onPress={() => !revealed && !isUsed && handleMatchTap(ex.id, 'right', pair.rightText)}
                  >
                    <Text style={[styles.matchCardText, isUsed && styles.matchCardTextMatched]}>{pair.rightText}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Complete conversation ──── */}
        {(ex.type === 'completeConversation' || ex.type === 'roleplay') && ex.conversationLines && (
          <View style={styles.convoContainer}>
            {ex.conversationLines.map((line, i) => {
              const userTurnIndex = ex.conversationLines!.filter((l, j) => l.isUserTurn && j <= i).length - 1;
              return (
                <View key={i} style={[styles.convoBubble, line.isUserTurn ? styles.convoBubbleUser : styles.convoBubbleBot]}>
                  <Text style={styles.convoSpeaker}>{line.speaker}</Text>
                  {line.isUserTurn ? (
                    <TextInput
                      style={[
                        styles.convoInput,
                        revealed && (isCorrectResult ? styles.inputCorrect : styles.inputWrong),
                      ]}
                      value={conversationAnswers[ex.id]?.[userTurnIndex] || ''}
                      onChangeText={(t) => handleConvoAnswer(ex.id, userTurnIndex, t)}
                      placeholder="Your response..."
                      placeholderTextColor={TG.textHint}
                      editable={!revealed}
                    />
                  ) : (
                    <Text style={styles.convoText}>{line.text}</Text>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* ── Hints ──────────────────── */}
        {ex.hints && ex.hints.length > 0 && !revealed && showHint && (
          <View style={styles.hintContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Flag size={16} color="#7E22CE" strokeWidth={2.5} />
              <Text style={styles.hintLabel}>Hint</Text>
            </View>
            {ex.hints.map((h, i) => <Text key={i} style={styles.hintText}>{h}</Text>)}
          </View>
        )}

      </ScrollView>

      {/* ── Bottom feedback bar (Duolingo style) ── */}
      <View style={[
        styles.bottomPanel,
        revealed && isCorrectResult === true && styles.bottomPanelCorrect,
        revealed && isCorrectResult === false && styles.bottomPanelWrong,
      ]}>
        {revealed && (
          <View style={styles.feedbackRow}>
            <View style={[styles.feedbackIcon, isCorrectResult ? styles.feedbackIconCorrect : styles.feedbackIconWrong]}>
              {isCorrectResult ? <Check size={22} color="#fff" strokeWidth={3.5} /> : <X size={22} color="#fff" strokeWidth={3.5} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.feedbackTitle, isCorrectResult ? styles.feedbackTitleCorrect : styles.feedbackTitleWrong]}>
                {isCorrectResult ? 'Great job!' : 'Incorrect'}
              </Text>
              {!isCorrectResult && ex.correctAnswer && (
                <Text style={styles.feedbackAnswer}>Correct answer: {ex.correctAnswer}</Text>
              )}
              {ex.explanation && (
                <Text style={styles.feedbackExplanation}>{ex.explanation}</Text>
              )}
            </View>
          </View>
        )}

        {!revealed ? (
          <TouchableOpacity
            style={[
              styles.actionBtn,
              isCurrentAnswered() ? styles.actionBtnActive : styles.actionBtnDisabled,
            ]}
            onPress={checkAnswer}
            disabled={!isCurrentAnswered()}
            activeOpacity={0.8}
          >
            <Text style={[styles.actionBtnText, !isCurrentAnswered() && styles.actionBtnTextDisabled]}>CHECK</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.actionBtn, isCorrectResult ? styles.actionBtnCorrect : styles.actionBtnWrong]}
            onPress={goNext}
            disabled={submitting}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.actionBtnText}>
                {currentIndex < totalExercises - 1 ? 'CONTINUE' : 'FINISH'}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  screenWrapper: { flex: 1, backgroundColor: TG.bg },
  safeArea: { flex: 1, backgroundColor: TG.bg },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: TG.bg },
  emptyText: { fontSize: 16, color: TG.textSecondary, fontWeight: '800' },

  // Header
  header: {
    backgroundColor: TG.bg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },

  headerTitle: { fontSize: 18, fontWeight: '800', color: TG.textPrimary, flex: 1 },
  progressBarContainer: { flex: 1, justifyContent: 'center', position: 'relative' },
  progressBarBg: {
    height: 16,
    backgroundColor: '#E5E5E5',
    borderRadius: 8,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 8,
    backgroundColor: 'dodgerblue',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  progressHighlight: {
    position: 'absolute',
    top: 3,
    left: 4,
    right: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },

  progressLabel: { fontSize: 14, fontWeight: '800', color: TG.textSecondary, minWidth: 36, textAlign: 'right' },

  // Review header
  reviewHeader: {
    backgroundColor: TG.bg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewProgressRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginLeft: 12,
  },
  reviewProgressBarBg: {
    flex: 1,
    height: 14,
    backgroundColor: '#E5E5E5',
    borderRadius: 7,
    overflow: 'hidden',
  },
  reviewProgressBarFill: {
    height: '100%',
    backgroundColor: '#FF4B4B',
    borderRadius: 7,
  },
  reviewProgressCount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#AFAFAF',
    minWidth: 30,
    textAlign: 'right',
  },

  // Review option cards
  reviewOptionCard: {
    backgroundColor: '#F7F7F7',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewOptionCorrect: { backgroundColor: '#ECFDF5', borderLeftWidth: 3, borderLeftColor: '#34D399' },
  reviewOptionWrong: { backgroundColor: '#FFF1F2', borderLeftWidth: 3, borderLeftColor: '#FB7185' },
  reviewOptionText: { fontSize: 16, fontWeight: '600', color: TG.textSecondary, flex: 1 },
  reviewOptionTextCorrect: { color: '#059669', fontWeight: '700' },
  reviewOptionTextWrong: { color: '#E11D48', fontWeight: '700' },

  heartsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heartsText: { fontSize: 16, fontWeight: '800', color: TG.red },

  // Combo
  comboBar: {
    alignSelf: 'center',
    backgroundColor: TG.streakOrange + '20',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 10,
  },
  comboText: { fontSize: 15, fontWeight: '800', color: TG.streakOrange },

  // XP popup
  xpPopup: { position: 'absolute', top: 60, right: 20, zIndex: 100 },
  xpPopupText: { fontSize: 20, fontWeight: '900', color: 'dodgerblue' },

  // Exercise content
  exerciseContainer: { flex: 1, backgroundColor: TG.bg },
  exerciseContent: { padding: 20, paddingBottom: 40 },
  exerciseTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  exerciseTypeLabel: { fontSize: 17, fontWeight: '900', color: 'dodgerblue', flex: 1 },
  promptText: { fontSize: 24, fontWeight: '800', color: TG.textPrimary, lineHeight: 34, marginBottom: 30 },

  // Audio button
  audioBtn: {
    backgroundColor: TG.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
    borderBottomWidth: 4,
    borderColor: TG.accentDark,
    marginBottom: 24,
  },
  audioBtnText: { fontSize: 17, fontWeight: '800', color: '#fff' },

  // Sentence template
  sentenceWrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 24 },
  sentenceText: { fontSize: 20, color: TG.textPrimary, lineHeight: 36, fontWeight: '600' },
  blankSlot: {
    borderBottomWidth: 3,
    borderBottomColor: TG.separator,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginHorizontal: 6,
    minWidth: 80,
  },
  blankCorrect: { borderBottomColor: '#34D399' },
  blankWrong: { borderBottomColor: '#FB7185' },
  blankText: { fontSize: 20, fontWeight: '800', color: TG.accent, textAlign: 'center' },

  // Target text (pronunciation)
  targetTextDisplay: {
    fontSize: 26,
    fontWeight: '800',
    color: TG.textPrimary,
    textAlign: 'center',
    marginBottom: 30,
  },

  // Text input
  textInput: {
    backgroundColor: TG.bgSecondary,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    fontSize: 18,
    fontWeight: '800',
    color: TG.textPrimary,
    borderWidth: 2,
    borderColor: TG.separator,
    minHeight: 64,
  },
  inputCorrect: { borderColor: '#34D399', backgroundColor: '#ECFDF5', color: '#059669' },
  inputWrong: { borderColor: '#FB7185', backgroundColor: '#FFF1F2', color: '#E11D48' },

  // Speak section
  speakSection: { gap: 16, alignItems: 'center' },
  micBtn: {
    backgroundColor: TG.accent,
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 5,
    borderColor: TG.accentDark,
  },

  // Multiple choice
  optionsContainer: { gap: 12 },
  optionBtn: {
    backgroundColor: TG.bg,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: TG.separator,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionSelected: { borderColor: '#6C63FF', backgroundColor: '#EDE9FE', borderBottomColor: '#5B52E0' },
  optionCorrect: { borderColor: '#34D399', backgroundColor: '#ECFDF5', borderBottomColor: '#10B981' },
  optionWrong: { borderColor: '#FB7185', backgroundColor: '#FFF1F2', borderBottomColor: '#E11D48' },
  optionText: { fontSize: 17, color: TG.textPrimary, flex: 1, fontWeight: '600' },
  optionTextSelected: { color: '#6C63FF', fontWeight: '800' },
  optionTextCorrect: { color: '#059669', fontWeight: '800' },

  // Reorder
  reorderAnswer: {
    backgroundColor: TG.bgSecondary,
    borderRadius: 16,
    padding: 16,
    minHeight: 70,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    marginBottom: 20,
  },
  reorderCorrect: { borderColor: '#34D399', backgroundColor: '#ECFDF5' },
  reorderWrong: { borderColor: '#FB7185', backgroundColor: '#FFF1F2' },
  reorderPlaceholder: { color: TG.textHint, fontSize: 16, fontWeight: '800' },
  reorderPool: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  reorderWord: {
    backgroundColor: TG.bg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: TG.separator,
  },
  reorderWordUsed: { backgroundColor: TG.separator, borderColor: TG.separator, opacity: 0.5 },
  reorderWordText: { fontSize: 18, color: TG.textPrimary, fontWeight: '700' },
  reorderWordTextUsed: { color: 'transparent' },
  reorderWordActive: {
    backgroundColor: TG.bg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: TG.accentLight,
  },
  reorderWordActiveText: { fontSize: 18, color: TG.accent, fontWeight: '700' },

  // Match pairs
  matchContainer: { flexDirection: 'row', gap: 16 },
  matchColumn: { flex: 1, gap: 12 },
  matchCard: {
    backgroundColor: TG.bg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: TG.separator,
    alignItems: 'center',
    minHeight: 64,
    justifyContent: 'center',
  },
  matchCardSelected: { borderColor: TG.accentLight, backgroundColor: '#E3F2FD' },
  matchCardMatched: { borderColor: TG.scoreGreen, backgroundColor: '#E8F5E9', opacity: 0.5 },
  matchCardText: { fontSize: 16, color: TG.textPrimary, fontWeight: '700', textAlign: 'center' },
  matchCardTextMatched: { color: TG.scoreGreen },

  // Conversation
  convoContainer: { gap: 16 },
  convoBubble: {
    borderRadius: 20,
    padding: 16,
    maxWidth: '85%',
  },
  convoBubbleBot: { backgroundColor: TG.bgSecondary, alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  convoBubbleUser: { backgroundColor: '#E3F2FD', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  convoSpeaker: { fontSize: 13, fontWeight: '800', color: TG.textSecondary, marginBottom: 6 },
  convoText: { fontSize: 17, color: TG.textPrimary, lineHeight: 24, fontWeight: '600' },
  convoInput: {
    backgroundColor: TG.bg,
    borderRadius: 14,
    padding: 14,
    fontSize: 17,
    fontWeight: '600',
    color: TG.textPrimary,
    borderWidth: 2,
    borderColor: TG.separator,
    minHeight: 50,
  },

  // Hints
  hintContainer: { marginTop: 24, backgroundColor: '#F3E8FF', borderRadius: 16, padding: 16 },
  hintLabel: { fontSize: 16, fontWeight: '800', color: '#7E22CE' },
  hintText: { fontSize: 15, color: TG.textPrimary, lineHeight: 22, fontWeight: '600' },
  hintIconBtn: { padding: 8, borderRadius: 20, backgroundColor: '#F3E8FF', borderWidth: 1.5, borderColor: '#D8B4FE', elevation: 1, shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },

  // Interactive Bottom Bar
  bottomPanel: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 34,
    backgroundColor: TG.bg,
  },
  bottomPanelCorrect: {
    backgroundColor: '#E8F5E9',
  },
  bottomPanelWrong: {
    backgroundColor: '#FFEBEE',
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  feedbackIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackIconCorrect: { backgroundColor: '#58CC02' },
  feedbackIconWrong: { backgroundColor: '#FF4B4B' },
  feedbackTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  feedbackTitleCorrect: { color: '#58A700' },
  feedbackTitleWrong: { color: '#EA2B2B' },
  feedbackAnswer: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EA2B2B',
    marginTop: 2,
  },
  feedbackExplanation: {
    fontSize: 13,
    fontWeight: '600',
    color: TG.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  actionBtn: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnActive: {
    backgroundColor: '#58CC02',
  },
  actionBtnCorrect: {
    backgroundColor: '#58CC02',
  },
  actionBtnWrong: {
    backgroundColor: '#FF4B4B',
  },
  actionBtnDisabled: {
    backgroundColor: '#E5E5E5',
  },
  actionBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  actionBtnTextDisabled: {
    color: '#AFAFAF',
  },

  // Explanation
  explanationBox: { marginTop: 16, backgroundColor: '#E3F2FD', borderRadius: 16, padding: 16 },
  explanationTitle: { fontSize: 15, fontWeight: '800', color: TG.accent, marginBottom: 8 },
  explanationText: { fontSize: 16, color: TG.textPrimary, lineHeight: 24, fontWeight: '600' },

  // Complete / Game Over
  completeContainer: {
    flex: 1,
    backgroundColor: TG.bg,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  completeEmoji: { fontSize: 64, marginBottom: 12 },
  completeTitle: { fontSize: 28, fontWeight: '800', color: TG.textPrimary, marginBottom: 8, textAlign: 'center' },
  completeSubtitle: { fontSize: 16, fontWeight: '700', color: TG.textSecondary, marginBottom: 24, textAlign: 'center' },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 32,
    width: '100%',
  },
  statCard: {
    flex: 1,
    minWidth: '44%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F7F7',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 10,
  },
  statIcon: { fontSize: 22 },
  statInfo: { gap: 1 },
  statValue: { fontSize: 20, fontWeight: '800', color: TG.textPrimary },
  statLabel: { fontSize: 12, color: '#AFAFAF', fontWeight: '700', textTransform: 'uppercase' },

  completeActions: { width: '100%', gap: 12 },
  completeBtn: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  completeBtnPrimary: {
    backgroundColor: '#58CC02',
  },
  completeBtnSecondary: {
    backgroundColor: '#F7F7F7',
  },
  completeBtnText: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  completeBtnSecondaryText: { color: '#AFAFAF' },
  // Result (legacy review mode)
  resultBanner: { marginTop: 20, borderRadius: 14, padding: 16 },
  resultCorrect: { backgroundColor: TG.scoreGreen + '15' },
  resultWrong: { backgroundColor: TG.scoreRed + '15' },
  resultText: { fontSize: 17, fontWeight: '700', color: TG.textPrimary },
  resultAnswer: { fontSize: 14, color: TG.textSecondary, marginTop: 4 },
  resultExplanation: { fontSize: 13, color: TG.textSecondary, marginTop: 8, lineHeight: 19, fontStyle: 'italic' },
});

