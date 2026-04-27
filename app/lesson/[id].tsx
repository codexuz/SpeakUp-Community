import { TG } from '@/constants/theme';
import { cacheAudioUri } from '@/hooks/useCachedAudioUri';
import { apiCompleteSession, apiFetchLesson, apiStartLessonSession, apiSubmitAttempt } from '@/lib/api';
import type { Exercise, ExerciseSession, ExerciseType, LessonDetail } from '@/lib/types';
import { getStoredAuthToken } from '@/store/auth';
import { AudioModule, createAudioPlayer, RecordingPresets, useAudioPlayer, useAudioRecorder } from 'expo-audio';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle,
  ChevronRight,
  FileText,
  Film,
  Flag,
  Heart,
  Keyboard,
  Lightbulb,
  Mic,
  Play,
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
  View
} from 'react-native';
import { Confetti } from 'react-native-fast-confetti';
import { SafeAreaView } from 'react-native-safe-area-context';
import DuoDragDrop, { DuoDragDropRef, Word } from '@jamsch/react-native-duo-drag-drop';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

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
  reading: { icon: '📖', label: 'Reading' },
  listening: { icon: '🎧', label: 'Listening' },
};

// ─── Answer validation ──────────────────────────────────────

function normalizeText(s: string) {
  return s.toLowerCase().trim().replace(/[.,!?;:'"]/g, '').replace(/\s+/g, ' ');
}

function validateAnswer(exercise: Exercise, userAnswer: string, selectedOption?: string, reorderResult?: string[], matchedPairs?: Record<string, string>, conversationAnswers?: Record<number, string>, questionAnswers?: Record<string, string>): boolean {
  const t = exercise.type;

  if (t === 'reading' || t === 'listening') {
    if (!exercise.questions || !questionAnswers) return false;
    return exercise.questions.every((q) => {
      const ans = questionAnswers[q.id] || '';
      if (q.type === 'multipleChoice') {
        const correctOpt = q.options?.find((o) => o.isCorrect);
        return correctOpt ? normalizeText(ans) === normalizeText(correctOpt.text) : false;
      }
      return q.correctAnswer ? normalizeText(ans) === normalizeText(q.correctAnswer) : false;
    });
  }

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

  if (t === 'completeConversation' || t === 'roleplay') {
    if (!conversationAnswers || !exercise.conversationLines?.length) return true;
    const userTurns = exercise.conversationLines.filter((l) => l.isUserTurn);
    if (t === 'roleplay') {
      return userTurns.every((_, i) => (conversationAnswers[i] || '').trim().length > 0);
    }
    return userTurns.every((turn, i) => {
      const ans = conversationAnswers[i] || '';
      if (turn.acceptedAnswers?.length) {
        return turn.acceptedAnswers.some((a) => normalizeText(ans) === normalizeText(a));
      }
      return ans.trim().length > 0;
    });
  }

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
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, Record<string, string>>>({});

  // UI state
  const [revealed, setRevealed] = useState(false);
  const [isCorrectResult, setIsCorrectResult] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProcessing, setRecordingProcessing] = useState(false);
  const [convoRecordingTurn, setConvoRecordingTurn] = useState<number | null>(null);
  const [convoProcessingTurn, setConvoProcessingTurn] = useState<number | null>(null);
  const [convoStep, setConvoStep] = useState(0);
  const [convoHintVisible, setConvoHintVisible] = useState(false);
  const [convoInputText, setConvoInputText] = useState('');

  // Lecture routing
  const [showExercises, setShowExercises] = useState(false);
  // Audio
  const correctPlayer = useAudioPlayer(correctSound);
  const wrongPlayer = useAudioPlayer(wrongSound);
  const completePlayer = useAudioPlayer(lessonCompleteSound);
  const exerciseAudioRef = useRef<any>(null);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const convoScrollRef = useRef<ScrollView>(null);
  const duoDragDropRef = useRef<DuoDragDropRef>(null);

  const playExerciseAudio = useCallback(async (url: string) => {
    try { exerciseAudioRef.current?.remove(); } catch {}
    const cachedUrl = await cacheAudioUri(url);
    const player = createAudioPlayer(cachedUrl);
    exerciseAudioRef.current = player;
    player.play();
  }, []);

  // Cleanup exercise audio on unmount
  useEffect(() => {
    return () => { try { exerciseAudioRef.current?.remove(); } catch {} };
  }, []);

  // ─── Recording & pronunciation check ─────────────────────

  const startRecording = useCallback(async () => {
    try {
      const perms = await AudioModule.requestRecordingPermissionsAsync();
      if (perms.status !== 'granted') {
        Alert.alert('Microphone Access', 'Please grant microphone permission to record.');
        return;
      }
      await AudioModule.setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setIsRecording(true);
    } catch (err) {
      console.warn('Failed to start recording', err);
    }
  }, [audioRecorder]);

  const stopRecordingAndCheck = useCallback(async (exercise: Exercise) => {
    try {
      if (!audioRecorder.isRecording) return;
      setIsRecording(false);
      setRecordingProcessing(true);
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (!uri) { setRecordingProcessing(false); return; }

      const token = await getStoredAuthToken();
      const form = new FormData();
      form.append('audio', { uri, name: 'recording.m4a', type: 'audio/m4a' } as any);

      const referenceText = exercise.targetText || exercise.correctAnswer || '';

      if (exercise.type === 'pronunciation' && referenceText) {
        // Pronunciation check
        form.append('referenceText', referenceText);
        const res = await fetch('https://speakup.impulselc.uz/api/speech/pronunciation-check', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
        const data = await res.json();
        if (data.transcript) {
          setTextAnswers((p) => ({ ...p, [exercise.id]: data.transcript }));
        }
      } else {
        // General transcription
        const res = await fetch('https://speakup.impulselc.uz/api/speech/transcribe', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
        const data = await res.json();
        if (data.transcript) {
          setTextAnswers((p) => ({ ...p, [exercise.id]: data.transcript }));
        }
      }
    } catch (err) {
      console.warn('Recording/transcription failed', err);
    } finally {
      setRecordingProcessing(false);
    }
  }, [audioRecorder]);

  const handleTapToSpeak = useCallback(async (exercise: Exercise) => {
    if (isRecording) {
      await stopRecordingAndCheck(exercise);
    } else {
      await startRecording();
    }
  }, [isRecording, startRecording, stopRecordingAndCheck]);

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

  const uniqueWordBankStrings = useMemo(() => {
    const counts: Record<string, number> = {};
    return wordBank.map((item) => {
      const w = item.text;
      counts[w] = (counts[w] || 0) + 1;
      return w + '\u200B'.repeat(counts[w] - 1);
    });
  }, [wordBank]);

  const totalExercises = exercises.length;
  const progress = totalExercises > 0 ? ((currentIndex + (revealed ? 1 : 0)) / totalExercises) * 100 : 0;

  // ─── Conversation step-by-step chat ──────────────────────

  const currentConvoLine = useMemo(() => {
    if (!currentExercise?.conversationLines) return null;
    const lines = currentExercise.conversationLines;
    return convoStep < lines.length ? lines[convoStep] : null;
  }, [currentExercise, convoStep]);

  const currentConvoUserTurnIndex = useMemo(() => {
    if (!currentExercise?.conversationLines) return 0;
    return currentExercise.conversationLines.slice(0, convoStep + 1).filter((l) => l.isUserTurn).length - 1;
  }, [currentExercise, convoStep]);

  // Auto-advance bot lines
  useEffect(() => {
    if (!currentExercise) return;
    if (currentExercise.type !== 'completeConversation' && currentExercise.type !== 'roleplay') return;
    const lines = currentExercise.conversationLines;
    if (!lines || convoStep >= lines.length) return;

    const line = lines[convoStep];
    if (!line.isUserTurn) {
      const delay = convoStep === 0 ? 400 : 800;
      const timer = setTimeout(async () => {
        setConvoStep((p) => p + 1);
        if (line.audioUrl) await playExerciseAudio(line.audioUrl);
        setTimeout(() => convoScrollRef.current?.scrollToEnd({ animated: true }), 100);
      }, delay);
      return () => clearTimeout(timer);
    } else {
      setConvoHintVisible(true);
      setTimeout(() => convoScrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [convoStep, currentExercise]);

  // Reset convo state when exercise changes
  useEffect(() => {
    setConvoStep(0);
    setConvoHintVisible(false);
    setConvoInputText('');
    setConvoRecordingTurn(null);
    setConvoProcessingTurn(null);
  }, [currentIndex]);

  const sendConvoMessage = useCallback(() => {
    if (!currentExercise?.conversationLines) return;
    const text = convoInputText.trim();
    if (!text) return;

    handleConvoAnswer(currentExercise.id, currentConvoUserTurnIndex, text);
    setConvoInputText('');
    setConvoHintVisible(false);
    setConvoStep((p) => p + 1);
    setTimeout(() => convoScrollRef.current?.scrollToEnd({ animated: true }), 150);
  }, [currentExercise, convoInputText, currentConvoUserTurnIndex]);

  const handleConvoTapToSpeak = useCallback(async () => {
    if (!currentExercise?.conversationLines) return;
    const exId = currentExercise.id;
    const turnIndex = currentConvoUserTurnIndex;

    if (convoRecordingTurn !== null) {
      try {
        setConvoRecordingTurn(null);
        setConvoProcessingTurn(turnIndex);
        if (!audioRecorder.isRecording) return;
        await audioRecorder.stop();
        const uri = audioRecorder.uri;
        if (!uri) { setConvoProcessingTurn(null); return; }

        const token = await getStoredAuthToken();
        const form = new FormData();
        form.append('audio', { uri, name: 'recording.m4a', type: 'audio/m4a' } as any);
        const res = await fetch('https://speakup.impulselc.uz/api/speech/transcribe', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
        const data = await res.json();
        if (data.transcript) {
          handleConvoAnswer(exId, turnIndex, data.transcript);
          setConvoHintVisible(false);
          setConvoStep((p) => p + 1);
          setTimeout(() => convoScrollRef.current?.scrollToEnd({ animated: true }), 150);
        }
      } catch (err) {
        console.warn('Convo recording failed', err);
      } finally {
        setConvoProcessingTurn(null);
      }
    } else {
      try {
        const perms = await AudioModule.requestRecordingPermissionsAsync();
        if (perms.status !== 'granted') {
          Alert.alert('Microphone Access', 'Please grant microphone permission to record.');
          return;
        }
        await AudioModule.setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await audioRecorder.prepareToRecordAsync();
        audioRecorder.record();
        setConvoRecordingTurn(turnIndex);
      } catch (err) {
        console.warn('Failed to start convo recording', err);
      }
    }
  }, [convoRecordingTurn, audioRecorder, currentExercise, currentConvoUserTurnIndex]);

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

  const handleQuestionAnswer = (exId: string, qId: string, text: string) => {
    setQuestionAnswers((p) => ({
      ...p,
      [exId]: { ...(p[exId] || {}), [qId]: text },
    }));
  };

  // ─── Check / next ────────────────────────────────────────

  const isCurrentAnswered = (): boolean => {
    if (!currentExercise) return false;
    const { id: eid, type } = currentExercise;

    if (['multipleChoice', 'listenAndChoose', 'tapWhatYouHear'].includes(type)) return !!selectedOptions[eid];
    if (type === 'fillInBlank') return !!(selectedOptions[eid] || textAnswers[eid]?.trim());
    if (['speakTheAnswer', 'listenRepeat', 'pronunciation'].includes(type)) return !!(textAnswers[eid]?.trim());
    if (type === 'reorderWords' || type === 'translateSentence') return (reorderWords[eid]?.length || 0) >= 2;
    if (type === 'matchPairs') {
      const pairs = matchedPairs[eid] || {};
      return Object.keys(pairs).length >= (currentExercise.matchPairs?.length || 0);
    }
    if (type === 'completeConversation' || type === 'roleplay') {
      const lines = currentExercise.conversationLines || [];
      return convoStep >= lines.length;
    }
    if (type === 'reading' || type === 'listening') {
      const answers = questionAnswers[eid] || {};
      return (currentExercise.questions || []).every((q) => !!answers[q.id]?.trim());
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
      questionAnswers[ex.id]
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
          userAnswer: { 
            value: textAnswers[ex.id] || selectedOptions[ex.id] || (reorderWords[ex.id] || []).join(' ') || '',
            questions: questionAnswers[ex.id],
          },
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
    setQuestionAnswers({});
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
    // For lecture-only lessons, show the lecture list instead of "no exercises"
    if (lesson && (lesson.type === 'lecture' || lesson.type === 'mixed') && lesson.lectures?.length) {
      return (
        <SafeAreaView style={styles.safeArea}>
          <StatusBar barStyle="light-content" backgroundColor={TG.headerBg} />
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}><ArrowLeft size={22} color={TG.textWhite} /></TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>{lesson.title}</Text>
            <View style={{ width: 22 }} />
          </View>
          <LectureListView lesson={lesson} router={router} onStartPractice={exercises.length > 0 ? () => setShowExercises(true) : undefined} />
        </SafeAreaView>
      );
    }
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={TG.headerBg} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}><ArrowLeft size={22} color={TG.textWhite} /></TouchableOpacity>
          <Text style={styles.headerTitle}>{lesson?.title || 'Lesson'}</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Lightbulb size={36} color={TG.accent} />
          </View>
          <Text style={styles.emptyTitle}>No exercises yet</Text>
          <Text style={styles.emptyDesc}>Exercises for this lesson are being prepared. Check back soon!</Text>
          <TouchableOpacity style={styles.emptyBackBtn} activeOpacity={0.7} onPress={() => router.back()}>
            <ArrowLeft size={16} color="#fff" />
            <Text style={styles.emptyBackBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── LECTURE LIST (for mixed/lecture lessons) ────────────

  if (lesson.lectures?.length && (lesson.type === 'lecture' || lesson.type === 'mixed') && !showExercises) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={TG.headerBg} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}><ArrowLeft size={22} color={TG.textWhite} /></TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{lesson.title}</Text>
          <View style={{ width: 22 }} />
        </View>
        <LectureListView lesson={lesson} router={router} onStartPractice={lesson.type === 'mixed' && exercises.length > 0 ? () => setShowExercises(true) : undefined} />
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

            {/* Reading / Listening answers */}
            {(reviewEx.type === 'reading' || reviewEx.type === 'listening') && reviewEx.questions && (
              <View style={[styles.resultBanner, styles.resultWrong]}>
                <Text style={styles.resultText}>Your Answers</Text>
                {reviewEx.questions.map((q, i) => {
                  const ans = questionAnswers[reviewEx.id]?.[q.id] || '(No answer)';
                  return (
                    <Text key={q.id} style={styles.resultAnswer}>Q{i + 1}: {ans}</Text>
                  );
                })}
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
          count={80}
          flakeSize={{ width: 10, height: 10 }}
          fadeOutOnEnd
          isInfinite={false}
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
    <GestureHandlerRootView style={{ flex: 1 }}>
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
          {['listenRepeat', 'speakTheAnswer', 'pronunciation'].includes(ex.type) && !revealed && !textAnswers[ex.id] && (
            <TouchableOpacity
              style={[styles.keyboardToggleBtn, showKeyboard && styles.keyboardToggleBtnActive]}
              onPress={() => setShowKeyboard(!showKeyboard)}
              activeOpacity={0.7}
            >
              <Keyboard size={18} color={showKeyboard ? '#fff' : '#8B5CF6'} strokeWidth={2.5} />
            </TouchableOpacity>
          )}
          {ex.hints && ex.hints.length > 0 && !revealed && (
            <TouchableOpacity style={styles.hintIconBtn} onPress={() => setShowHint(!showHint)} activeOpacity={0.7}>
              <Flag size={18} color={showHint ? "#7E22CE" : "#8B5CF6"} strokeWidth={showHint ? 3 : 2.5} />
            </TouchableOpacity>
          )}
        </View>

        {/* Prompt */}
        <Text style={styles.promptText}>{ex.prompt}</Text>

        {/* ── Audio button ───────────── */}
        {['listenAndChoose', 'tapWhatYouHear'].includes(ex.type) && ex.audioUrl && (
          <TouchableOpacity style={styles.audioBtn} activeOpacity={0.7} onPress={() => playExerciseAudio(ex.audioUrl!)}>
            <Volume2 size={22} color="#fff" />
            <Text style={styles.audioBtnText}>Play Audio</Text>
          </TouchableOpacity>
        )}

        {/* ── Speaking / Listen & Repeat UI (Duolingo-style) ── */}
        {['listenRepeat', 'speakTheAnswer', 'pronunciation'].includes(ex.type) && (
          <View style={styles.speakingLayout}>
            {/* Speech bubble with target text and audio */}
            <View style={styles.speechBubble}>
              {ex.audioUrl ? (
                <TouchableOpacity style={styles.speechAudioBtn} activeOpacity={0.7} onPress={() => playExerciseAudio(ex.audioUrl!)}>
                  <Volume2 size={22} color="#1CB0F6" />
                </TouchableOpacity>
              ) : null}
              <View style={styles.speechBubbleWords}>
                {(ex.targetText || ex.correctAnswer || ex.prompt || '').split(' ').map((word, wi) => (
                  <Text key={wi} style={styles.speechWord}>{word} </Text>
                ))}
              </View>
            </View>

            {/* Tap to speak button — hide after transcript received */}
            {!textAnswers[ex.id] && (
              <TouchableOpacity
                style={[
                  styles.tapToSpeakBtn,
                  isRecording && styles.tapToSpeakRecording,
                ]}
                activeOpacity={0.7}
                disabled={revealed || recordingProcessing}
                onPress={() => handleTapToSpeak(ex)}
              >
                {recordingProcessing ? (
                  <ActivityIndicator size="small" color="#1CB0F6" />
                ) : (
                  <Mic size={24} color={isRecording ? '#fff' : '#1CB0F6'} />
                )}
                <Text style={[styles.tapToSpeakText, isRecording && { color: '#fff' }]}>
                  {recordingProcessing ? 'PROCESSING...' : isRecording ? 'TAP TO STOP' : 'TAP TO SPEAK'}
                </Text>
              </TouchableOpacity>
            )}

            {/* User response bubble — shown after transcript */}
            {!!textAnswers[ex.id] && (
              <View style={[
                styles.userResponseBubble,
                revealed && (isCorrectResult ? styles.userResponseCorrect : styles.userResponseWrong),
              ]}>
                <Mic size={18} color={revealed ? (isCorrectResult ? '#059669' : '#AFAFAF') : '#AFAFAF'} />
                <Text style={[
                  styles.userResponseText,
                  revealed && (isCorrectResult ? { color: '#059669' } : { color: '#AFAFAF' }),
                ]}>
                  {textAnswers[ex.id]}
                </Text>
              </View>
            )}

            {/* Keyboard text input (toggle) */}
            {showKeyboard && (
              <TextInput
                style={[
                  styles.textInput,
                  { width: '100%' },
                  revealed && (isCorrectResult ? styles.inputCorrect : styles.inputWrong),
                ]}
                placeholder="Type your answer here..."
                placeholderTextColor={TG.textHint}
                value={textAnswers[ex.id] || ''}
                onChangeText={(t) => handleTextAnswer(ex.id, t)}
                editable={!revealed}
              />
            )}
          </View>
        )}

        {/* ── Sentence template (fill in blank) ── */}
        {ex.type === 'fillInBlank' && ex.sentenceTemplate && (
          <View style={styles.sentenceWrap}>
            {ex.sentenceTemplate.split('___').map((part, i, arr) => (
              <React.Fragment key={i}>
                <Text style={styles.sentenceText}>{part}</Text>
                {i < arr.length - 1 && (
                  <View style={[styles.blankSlot, revealed && (isCorrectResult ? styles.blankCorrect : styles.blankWrong)]}>
                    {selectedOptions[ex.id] ? (
                      <Text style={styles.blankText}>{selectedOptions[ex.id]}</Text>
                    ) : ex.options && ex.options.length > 0 ? (
                      <Text style={[styles.blankText, { color: TG.textHint }]}></Text>
                    ) : (
                      <TextInput
                        style={styles.blankInput}
                        value={textAnswers[ex.id] || ''}
                        onChangeText={(t) => handleTextAnswer(ex.id, t)}
                        editable={!revealed}
                        placeholder=""
                        placeholderTextColor={TG.textHint}
                        autoCorrect={false}
                        autoComplete="off"
                        autoCapitalize="none"
                        spellCheck={false}
                      />
                    )}
                  </View>
                )}
              </React.Fragment>
            ))}
          </View>
        )}

        {/* ── Text input types ───────── */}

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
          <View style={{ marginTop: 20, minHeight: 180 }}>
            <DuoDragDrop
              ref={duoDragDropRef}
              key={ex.id}
              words={uniqueWordBankStrings}
              gesturesDisabled={revealed}
              wordBankAlignment="center"
              onDrop={(event) => {
                const answered = duoDragDropRef.current?.getAnsweredWords() || [];
                setReorderWords((p) => ({ ...p, [ex.id]: answered.map(w => w.replace(/\u200B/g, '')) }));
              }}
              renderWord={(word, index) => {
                let bg = 'white';
                let border = '#E5E7EB';
                let color = TG.textPrimary;
                
                if (revealed) {
                  bg = isCorrectResult ? TG.scoreGreen : '#FF4B4B';
                  border = bg;
                  color = 'white';
                }

                return (
                  <Word
                    containerStyle={{
                      backgroundColor: bg,
                      borderColor: border,
                      borderWidth: 1,
                      borderRadius: 12,
                    }}
                    textStyle={{
                      color: color,
                      fontFamily: 'Nunito-Bold',
                      fontSize: 16,
                    }}
                  />
                );
              }}
            />
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

        {/* ── Reading & Listening ────────────── */}
        {(ex.type === 'reading' || ex.type === 'listening') && (
          <View style={styles.comprehensionContainer}>
            {ex.type === 'listening' && ex.audioUrl && (
              <TouchableOpacity
                style={styles.audioPlayBtnLg}
                activeOpacity={0.8}
                onPress={() => playExerciseAudio(ex.audioUrl!)}
              >
                <Volume2 size={40} color="#1CB0F6" />
              </TouchableOpacity>
            )}
            {ex.type === 'reading' && ex.passage && (
              <View style={styles.passageCard}>
                <Text style={styles.passageText}>{ex.passage}</Text>
              </View>
            )}

            <View style={styles.questionsList}>
              {ex.questions?.sort((a, b) => a.order - b.order).map((q, qi) => {
                const qAns = questionAnswers[ex.id]?.[q.id] || '';
                const isCorrect = revealed && (
                  q.type === 'multipleChoice'
                    ? normalizeText(qAns) === normalizeText(q.options?.find((o) => o.isCorrect)?.text || '')
                    : normalizeText(qAns) === normalizeText(q.correctAnswer || '')
                );
                
                return (
                  <View key={q.id} style={styles.questionBlock}>
                    <Text style={styles.questionText}>{qi + 1}. {q.questionText}</Text>
                    {q.type === 'multipleChoice' ? (
                      <View style={styles.optionsContainer}>
                        {q.options?.map((opt) => {
                          const isSelected = qAns === opt.text;
                          const correctOpt = revealed && opt.isCorrect;
                          return (
                            <TouchableOpacity
                              key={opt.text}
                              style={[
                                styles.optionBtn,
                                isSelected && !revealed && styles.optionSelected,
                                correctOpt && styles.optionCorrect,
                                revealed && isSelected && !opt.isCorrect && styles.optionWrong
                              ]}
                              activeOpacity={0.7}
                              onPress={() => !revealed && handleQuestionAnswer(ex.id, q.id, opt.text)}
                            >
                              <Text style={[
                                styles.optionText,
                                isSelected && !revealed && styles.optionTextSelected,
                                correctOpt && styles.optionTextCorrect
                              ]}>
                                {opt.text}
                              </Text>
                              {correctOpt && <Check size={16} color={TG.scoreGreen} />}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    ) : (
                      <View style={styles.fibQuestionContainer}>
                        <TextInput
                          style={[
                            styles.textInput,
                            revealed && (isCorrect ? styles.inputCorrect : styles.inputWrong)
                          ]}
                          value={qAns}
                          onChangeText={(v) => !revealed && handleQuestionAnswer(ex.id, q.id, v)}
                          placeholder="Type your answer"
                          placeholderTextColor={TG.textHint}
                          editable={!revealed}
                        />
                        {revealed && !isCorrect && q.correctAnswer && (
                          <Text style={styles.fibQuestionCorrectLabel}>Answer: {q.correctAnswer}</Text>
                        )}
                      </View>
                    )}
                    {revealed && q.explanation && (
                      <View style={styles.explanationBox}>
                        <Text style={styles.explanationText}>💡 {q.explanation}</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Complete conversation (step-by-step chat) ──── */}
        {(ex.type === 'completeConversation' || ex.type === 'roleplay') && ex.conversationLines && (
          <View style={styles.convoContainer}>
            <ScrollView
              ref={convoScrollRef}
              style={styles.convoScroll}
              contentContainerStyle={styles.convoScrollContent}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => convoScrollRef.current?.scrollToEnd({ animated: true })}
            >
              {/* Rendered messages (lines 0..convoStep-1) */}
              {ex.conversationLines.slice(0, convoStep).map((line, i) => {
                const isUser = line.isUserTurn;
                const userTurnIndex = ex.conversationLines!.slice(0, i + 1).filter((l) => l.isUserTurn).length - 1;

                return (
                  <View key={i} style={[styles.chatMsg, isUser && styles.chatMsgUser]}>
                    {!isUser && (
                      <View style={styles.chatAvatarCircle}>
                        <Text style={styles.chatAvatarLetter}>{line.speaker?.charAt(0)?.toUpperCase() || '🤖'}</Text>
                      </View>
                    )}
                    <View style={[styles.chatBubble, isUser ? styles.chatBubbleUser : styles.chatBubbleBot]}>
                      {!isUser && line.audioUrl && (
                        <TouchableOpacity style={styles.chatAudioIcon} activeOpacity={0.7} onPress={() => playExerciseAudio(line.audioUrl!)}>
                          <Volume2 size={14} color="#1CB0F6" />
                        </TouchableOpacity>
                      )}
                      <Text style={[styles.chatBubbleText, isUser && styles.chatBubbleTextUser]}>
                        {isUser ? (conversationAnswers[ex.id]?.[userTurnIndex] || '') : line.text}
                      </Text>
                    </View>
                  </View>
                );
              })}

              {/* Typing indicator while bot line is pending */}
              {currentConvoLine && !currentConvoLine.isUserTurn && (
                <View style={styles.chatMsg}>
                  <View style={styles.chatAvatarCircle}>
                    <Text style={styles.chatAvatarLetter}>{currentConvoLine.speaker?.charAt(0)?.toUpperCase() || '🤖'}</Text>
                  </View>
                  <View style={[styles.chatBubble, styles.chatBubbleBot]}>
                    <Text style={styles.chatTypingDots}>•••</Text>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Conversation complete indicator */}
            {convoStep >= (ex.conversationLines?.length || 0) && !revealed && (
              <View style={styles.convoCompleteBanner}>
                <Check size={16} color="#059669" strokeWidth={3} />
                <Text style={styles.convoCompleteText}>Conversation complete!</Text>
              </View>
            )}
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

      {/* ── Conversation voice bar (fixed above CHECK) ── */}
      {(ex.type === 'completeConversation' || ex.type === 'roleplay') && currentConvoLine?.isUserTurn && !revealed && (
        <View style={styles.convoBarCard}>
          {/* Idea hint — always visible */}
          <View style={styles.convoBarHint}>
            <Lightbulb size={16} color="#F59E0B" />
            <Text style={styles.convoBarHintText} numberOfLines={2}>
              {currentConvoLine.acceptedAnswers?.[0] || currentConvoLine.text}
            </Text>
          </View>
          {/* Mic row */}
          <View style={styles.convoBarMicRow}>
            {convoProcessingTurn !== null ? (
              <View style={styles.convoBarMicBtn}>
                <ActivityIndicator size="small" color="#1CB0F6" />
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.convoBarMicBtn, convoRecordingTurn !== null && styles.convoBarMicBtnRec]}
                activeOpacity={0.7}
                onPress={handleConvoTapToSpeak}
              >
                <Mic size={24} color={convoRecordingTurn !== null ? '#fff' : '#1CB0F6'} />
              </TouchableOpacity>
            )}
            <Text style={styles.convoBarMicLabel}>
              {convoRecordingTurn !== null ? 'Tap to stop' : convoProcessingTurn !== null ? 'Processing…' : 'Tap to speak'}
            </Text>
          </View>
        </View>
      )}

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
  </GestureHandlerRootView>
  );
}

// ─── Lecture List View ──────────────────────────────────────

function LectureListView({ lesson, router, onStartPractice }: { lesson: LessonDetail; router: any; onStartPractice?: () => void }) {
  const lectures = [...(lesson.lectures || [])].sort((a, b) => a.order - b.order);
  const completedCount = lectures.filter((l) => l.userProgress?.completed).length;
  const allDone = completedCount === lectures.length;

  const getContentIcon = (ct: string) => {
    switch (ct) {
      case 'text': return <FileText size={18} color={TG.accent} />;
      case 'audio': return <Mic size={18} color="#E17055" />;
      case 'video': return <Film size={18} color="#6C5CE7" />;
      default: return <BookOpen size={18} color={TG.accent} />;
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: TG.bgSecondary }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View style={lectStyles.headerCard}>
        <BookOpen size={24} color={TG.accent} />
        <View style={{ flex: 1 }}>
          <Text style={lectStyles.headerTitle}>
            {lesson.type === 'mixed' ? 'Lectures & Practice' : 'Lectures'}
          </Text>
          <Text style={lectStyles.headerSub}>
            {completedCount}/{lectures.length} completed
          </Text>
        </View>
        {allDone && <CheckCircle size={20} color={TG.green} />}
      </View>

      {lectures.map((lec) => {
        const done = lec.userProgress?.completed;
        return (
          <TouchableOpacity
            key={lec.id}
            style={lectStyles.lectureRow}
            activeOpacity={0.7}
            onPress={() => router.push(`/lecture/${lec.id}`)}
          >
            <View style={[lectStyles.iconBox, { backgroundColor: lec.contentType === 'text' ? TG.accent + '15' : lec.contentType === 'audio' ? '#E1705515' : '#6C5CE715' }]}>
              {getContentIcon(lec.contentType)}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={lectStyles.lecTitle} numberOfLines={1}>{lec.title}</Text>
              <Text style={lectStyles.lecMeta}>
                {lec.contentType.charAt(0).toUpperCase() + lec.contentType.slice(1)}
                {lec.durationSec ? ` • ${Math.floor(lec.durationSec / 60)}:${String(lec.durationSec % 60).padStart(2, '0')}` : ''}
              </Text>
            </View>
            {done ? (
              <CheckCircle size={18} color={TG.green} />
            ) : (
              <ChevronRight size={18} color={TG.textHint} />
            )}
          </TouchableOpacity>
        );
      })}

      {onStartPractice && (
        <TouchableOpacity style={lectStyles.practiceBtn} onPress={onStartPractice} activeOpacity={0.8}>
          <Play size={18} color="#fff" />
          <Text style={lectStyles.practiceBtnText}>Start Practice</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const lectStyles = StyleSheet.create({
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: TG.bg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: TG.textPrimary },
  headerSub: { fontSize: 13, color: TG.textSecondary, marginTop: 2 },
  lectureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: TG.bg,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  lecTitle: { fontSize: 15, fontWeight: '600', color: TG.textPrimary },
  lecMeta: { fontSize: 12, color: TG.textHint, marginTop: 2 },
  practiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: TG.accent,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 16,
  },
  practiceBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});

// ─── Styles ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  screenWrapper: { flex: 1, backgroundColor: TG.bg },
  safeArea: { flex: 1, backgroundColor: TG.bg },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: TG.bg },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: TG.bg, paddingHorizontal: 40 },
  emptyIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: TG.accentLight, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: TG.textPrimary, marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: TG.textSecondary, textAlign: 'center', lineHeight: 21, marginBottom: 28 },
  emptyBackBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: TG.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  emptyBackBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
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

  // Speaking layout (Duolingo-style)
  speakingLayout: { alignItems: 'center', marginBottom: 24, gap: 16 },
  speechBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: TG.bg,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    alignSelf: 'stretch',
  },
  speechAudioBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E5F5FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  speechBubbleText: {
    fontSize: 22,
    fontWeight: '800',
    color: TG.textPrimary,
    flexShrink: 1,
  },
  speechBubbleWords: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flex: 1,
  },
  speechWord: {
    fontSize: 21,
    fontWeight: '700',
    color: TG.textPrimary,
    lineHeight: 34,
    textDecorationLine: 'underline',
    textDecorationStyle: 'dashed',
    textDecorationColor: '#C8C8C8',
  },
  speechBubbleArrow: {
    width: 16,
    height: 16,
    backgroundColor: TG.bg,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: TG.separator,
    transform: [{ rotate: '45deg' }],
    marginTop: -12,
    alignSelf: 'center',
  },
  tapToSpeakBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    paddingVertical: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: '#E5E5E5',
    backgroundColor: TG.bg,
  },
  playAudioSpeakBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'center',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 16,
    borderBottomWidth: 4,
    borderColor: TG.accentDark,
    backgroundColor: TG.accent,
    marginTop: 16,
    marginBottom: 12,
  },
  tapToSpeakCorrect: { borderColor: '#34D399', backgroundColor: '#ECFDF5', borderStyle: 'solid' },
  tapToSpeakWrong: { borderColor: '#FB7185', backgroundColor: '#FFF1F2', borderStyle: 'solid' },
  tapToSpeakRecording: { backgroundColor: '#E11D48', borderColor: '#BE123C', borderBottomColor: '#BE123C' },
  tapToSpeakText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1CB0F6',
    letterSpacing: 1,
  },

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
  blankInput: {
    fontSize: 20,
    fontWeight: '800',
    color: TG.accent,
    textAlign: 'center',
    minWidth: 60,
    padding: 0,
    margin: 0,
    textTransform: 'lowercase',
  },

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

  // Conversation (step-by-step chat)
  convoContainer: { flex: 1, marginTop: 12, gap: 0 },
  convoScroll: { maxHeight: 380, marginBottom: 4 },
  convoScrollContent: { paddingBottom: 12, paddingTop: 4, gap: 12, paddingHorizontal: 2 },
  chatMsg: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  chatMsgUser: {
    flexDirection: 'row-reverse',
  },
  chatAvatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E8EAED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatAvatarLetter: { fontSize: 15, fontWeight: '800', color: '#5F6368' },
  chatBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chatBubbleBot: {
    backgroundColor: '#F1F3F4',
    borderRadius: 20,
    borderBottomLeftRadius: 6,
  },
  chatBubbleUser: {
    backgroundColor: '#1CB0F6',
    borderRadius: 20,
    borderBottomRightRadius: 6,
  },
  chatBubbleText: {
    fontSize: 16,
    lineHeight: 22,
    color: '#1F2937',
    fontWeight: '600',
    flexShrink: 1,
  },
  chatBubbleTextUser: { color: '#fff' },
  chatAudioIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatTypingDots: { fontSize: 22, color: '#9CA3AF', letterSpacing: 4, fontWeight: '800' },
  // Voice-only conversation bar (fixed above CHECK)
  convoBarCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    marginBottom: 8,
  },
  convoBarHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFDF5',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  convoBarHintText: {
    fontSize: 14,
    color: '#92400E',
    fontWeight: '600',
    flex: 1,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  convoBarMicRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  convoBarMicBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E8F4FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  convoBarMicBtnRec: { backgroundColor: '#EF4444' },
  convoBarMicLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    letterSpacing: 0.3,
  },
  convoCompleteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ECFDF5',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 12,
    marginHorizontal: 2,
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
  },
  convoCompleteText: { fontSize: 15, color: '#059669', fontWeight: '700' },

  // Hints
  hintContainer: { marginTop: 24, backgroundColor: '#F3E8FF', borderRadius: 16, padding: 16 },
  hintLabel: { fontSize: 16, fontWeight: '800', color: '#7E22CE' },
  hintText: { fontSize: 15, color: TG.textPrimary, lineHeight: 22, fontWeight: '600' },
  hintIconBtn: { padding: 8, borderRadius: 20, backgroundColor: '#F3E8FF', borderWidth: 1.5, borderColor: '#D8B4FE'},

  // Keyboard toggle
  keyboardToggleBtn: { padding: 8, borderRadius: 20, backgroundColor: '#F3E8FF', borderWidth: 1.5, borderColor: '#D8B4FE' },
  keyboardToggleBtnActive: { backgroundColor: '#8B5CF6', borderColor: '#7C3AED' },

  // Recording state
  // (tapToSpeakRecording moved inline above)

  // User response bubble
  userResponseBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    backgroundColor: TG.bg,
    marginTop: 8,
  },
  userResponseCorrect: { borderColor: '#34D399', backgroundColor: '#ECFDF5' },
  userResponseWrong: { borderColor: '#E5E5E5', backgroundColor: TG.bg },
  userResponseText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#AFAFAF',
    flexShrink: 1,
  },

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
    marginBottom: 12,
  },
  completeBtnSecondary: {
    backgroundColor: 'transparent',
  },
  completeBtnText: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  completeBtnSecondaryText: {
    color: '#AFB4B8',
  },

  // Reading & Listening
  comprehensionContainer: { gap: 24, paddingBottom: 24 },
  audioPlayBtnLg: { alignSelf: 'center', backgroundColor: '#E3F2FD', width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  passageCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, borderWidth: 2, borderColor: '#E5E5E5', marginBottom: 16 },
  passageText: { fontSize: 17, color: TG.textPrimary, lineHeight: 26, fontWeight: '500' },
  questionsList: { gap: 32 },
  questionBlock: { gap: 12 },
  questionText: { fontSize: 18, fontWeight: '700', color: TG.textPrimary },
  fibQuestionContainer: { gap: 8 },
  fibQuestionInput: { backgroundColor: '#fff', borderRadius: 16, padding: 16, fontSize: 18, color: TG.textPrimary, borderWidth: 2, borderColor: '#E5E5E5', fontWeight: '600' },
  fibQuestionCorrectLabel: { fontSize: 15, fontWeight: '700', color: '#58CC02', marginLeft: 8 },

  // Result (legacy review mode)
  resultBanner: { marginTop: 20, borderRadius: 14, padding: 16 },
  resultCorrect: { backgroundColor: TG.scoreGreen + '15' },
  resultWrong: { backgroundColor: TG.scoreRed + '15' },
  resultText: { fontSize: 17, fontWeight: '700', color: TG.textPrimary },
  resultAnswer: { fontSize: 14, color: TG.textSecondary, marginTop: 4 },
  resultExplanation: { fontSize: 13, color: TG.textSecondary, marginTop: 8, lineHeight: 19, fontStyle: 'italic' },
});

