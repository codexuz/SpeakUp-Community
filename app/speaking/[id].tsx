import { TG } from '@/constants/theme';
import { apiSubmitSpeaking } from '@/lib/api';
import { fetchQuestionsByTestId, Question } from '@/lib/data';
import { useAuth } from '@/store/auth';
import { AudioModule, RecordingPresets, useAudioRecorder } from 'expo-audio';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  ImageIcon,
  Mic,
  Pause,
  Send,
  Volume2,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_W } = Dimensions.get('window');
const RING_SIZE = 140;
const RING_STROKE = 6;

function CircularProgress({
  progress,
  color,
  children,
}: {
  progress: number;
  color: string;
  children: React.ReactNode;
}) {
  const size = RING_SIZE;
  const radius = (size - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={StyleSheet.absoluteFill}>
        {/* Background ring */}
        <View style={{
          width: size, height: size, borderRadius: size / 2,
          borderWidth: RING_STROKE, borderColor: color + '15',
        }} />
      </View>
      <View style={[StyleSheet.absoluteFill, { transform: [{ rotate: '-90deg' }] }]}>
        {/* Progress ring via border trick */}
        <View style={{
          width: size, height: size, borderRadius: size / 2,
          borderWidth: RING_STROKE, borderColor: 'transparent',
          borderTopColor: color,
          borderRightColor: progress > 0.25 ? color : 'transparent',
          borderBottomColor: progress > 0.5 ? color : 'transparent',
          borderLeftColor: progress > 0.75 ? color : 'transparent',
        }} />
      </View>
      {children}
    </View>
  );
}

export default function SpeakingScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadingQ, setLoadingQ] = useState(true);
  const [phase, setPhase] = useState<'prep' | 'speak' | 'done'>('prep');
  const [timeLeft, setTimeLeft] = useState(0);
  const [uploading, setUploading] = useState(false);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const question = questions[currentIndex] ?? null;
  const isLastQuestion = currentIndex >= questions.length - 1;

  const startRecording = useCallback(async () => {
    try {
      const perms = await AudioModule.requestRecordingPermissionsAsync();
      if (perms.status === 'granted') {
        await audioRecorder.prepareToRecordAsync();
        audioRecorder.record();
      }
    } catch (err) {
      console.warn('Failed to start recording', err);
    }
  }, [audioRecorder]);

  const saveAndAdvance = useCallback(async () => {
    try {
      setPhase('done');
      setUploading(true);
      if (audioRecorder.isRecording) await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (uri && user && question) {
        await apiSubmitSpeaking(question.id, uri);
      }
    } catch (err) {
      console.error('Failed to save recording', err);
    } finally {
      setUploading(false);
    }

    if (isLastQuestion) {
      router.back();
    } else {
      setCurrentIndex(prev => prev + 1);
      setPhase('prep');
    }
  }, [audioRecorder, isLastQuestion, question, router, user]);

  useEffect(() => {
    (async () => {
      const qs = await fetchQuestionsByTestId(Number(id));
      setQuestions(qs);
      setLoadingQ(false);
    })();
  }, [id]);

  // Fade-in when question changes
  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, [currentIndex, fadeAnim]);

  useEffect(() => {
    if (!question) return;
    if (phase === 'prep') {
      setTimeLeft(question.prep_timer);
      Speech.speak(question.q_text, { language: 'en-GB', rate: 0.9 });
    } else if (phase === 'speak') {
      setTimeLeft(question.speaking_timer);
      startRecording();
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.18, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ]),
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(waveAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(waveAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
        ]),
      ).start();
    } else {
      pulseAnim.setValue(1);
      waveAnim.setValue(0);
    }
  }, [phase, currentIndex, pulseAnim, waveAnim, question, startRecording]);

  useEffect(() => {
    if (!question) return;
    if (timeLeft <= 0) {
      if (phase === 'prep') setPhase('speak');
      else if (phase === 'speak') saveAndAdvance();
      return;
    }
    const timer = setInterval(() => setTimeLeft(p => p - 1), 1000);
    return () => clearInterval(timer);
  }, [phase, question, saveAndAdvance, timeLeft]);

  const totalTime = question
    ? phase === 'prep' ? question.prep_timer : question.speaking_timer
    : 1;
  const progress = totalTime > 0 ? (totalTime - timeLeft) / totalTime : 0;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = (timeLeft % 60).toString().padStart(2, '0');
  const ringColor = phase === 'speak' ? TG.red : TG.accent;

  if (loadingQ) return (
    <SafeAreaView style={[styles.safeArea, styles.centerFull]}>
      <StatusBar barStyle="light-content" backgroundColor={TG.headerBg} />
      <View style={styles.loadingContainer}>
        <View style={styles.loadingIcon}>
          <BookOpen size={32} color={TG.accent} />
        </View>
        <ActivityIndicator size="large" color={TG.accent} style={{ marginTop: 20 }} />
        <Text style={styles.loadingText}>Loading questions...</Text>
      </View>
    </SafeAreaView>
  );

  if (questions.length === 0 || !question) return (
    <SafeAreaView style={[styles.safeArea, styles.centerFull]}>
      <StatusBar barStyle="light-content" backgroundColor={TG.headerBg} />
      <Text style={{ color: TG.textSecondary, fontSize: 16 }}>No questions found</Text>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={phase === 'speak' ? '#c62828' : TG.headerBg} />

      {/* Header */}
      <View style={[styles.header, phase === 'speak' && styles.headerRecording]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft size={22} color={TG.textWhite} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Part {question.part}</Text>
          <Text style={styles.headerSubtitle}>
            Question {currentIndex + 1} of {questions.length}
          </Text>
        </View>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>
            {phase === 'prep' ? 'PREP' : phase === 'speak' ? 'REC' : 'DONE'}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View style={[
          styles.progressFill,
          phase === 'speak' && styles.progressFillRec,
          { width: `${((currentIndex + (phase === 'speak' ? 0.5 : 0)) / questions.length) * 100}%` },
        ]} />
        {questions.map((_, i) => (
          <View
            key={i}
            style={[
              styles.progressDot,
              { left: `${((i + 0.5) / questions.length) * 100}%` },
              i < currentIndex && styles.progressDotDone,
              i === currentIndex && styles.progressDotActive,
            ]}
          />
        ))}
      </View>

      {/* Content */}
      <Animated.ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={{ opacity: fadeAnim }}
      >
        {/* Phase indicator pill */}
        <View style={styles.phaseRow}>
          <View style={[styles.phasePill, phase === 'speak' && styles.phasePillRec]}>
            {phase === 'prep' ? (
              <Clock size={14} color={TG.accent} />
            ) : (
              <Mic size={14} color={TG.red} />
            )}
            <Text style={[styles.phasePillText, phase === 'speak' && { color: TG.red }]}>
              {phase === 'prep' ? 'Read & prepare your answer' : 'Speak now — recording in progress'}
            </Text>
          </View>
        </View>

        {/* Question card */}
        <View style={[styles.questionCard, phase === 'speak' && styles.questionCardRec]}>
          <View style={styles.questionCardInner}>
            {phase === 'prep' && (
              <View style={styles.speakerRow}>
                <Volume2 size={16} color={TG.accent} />
                <Text style={styles.speakerHint}>Listening...</Text>
              </View>
            )}
            <Text style={styles.questionText}>{question.q_text}</Text>
          </View>
        </View>

        {/* Image */}
        {question.image && (
          <View style={styles.imageCard}>
            <View style={styles.imageLabel}>
              <ImageIcon size={14} color={TG.textSecondary} />
              <Text style={styles.imageLabelText}>Reference Image</Text>
            </View>
            <Image source={{ uri: question.image }} style={styles.image} resizeMode="contain" />
          </View>
        )}

        {/* Steps indicator */}
        <View style={styles.stepsRow}>
          {questions.map((_, i) => (
            <View key={i} style={styles.stepItem}>
              {i < currentIndex ? (
                <CheckCircle2 size={18} color={TG.green} />
              ) : i === currentIndex ? (
                <View style={[styles.stepDot, styles.stepDotActive]} />
              ) : (
                <View style={styles.stepDot} />
              )}
              <Text style={[
                styles.stepLabel,
                i < currentIndex && { color: TG.green },
                i === currentIndex && { color: TG.accent, fontWeight: '700' },
              ]}>
                Q{i + 1}
              </Text>
            </View>
          ))}
        </View>
      </Animated.ScrollView>

      {/* Footer panel */}
      <View style={[styles.footer, phase === 'speak' && styles.footerRec]}>
        {/* Circular timer */}
        <View style={styles.timerArea}>
          <CircularProgress progress={progress} color={ringColor}>
            <Animated.View style={[
              styles.timerInner,
              phase === 'speak' && styles.timerInnerRec,
              { transform: [{ scale: phase === 'speak' ? pulseAnim : 1 }] },
            ]}>
              {phase === 'speak' ? (
                <Mic size={28} color={TG.red} />
              ) : (
                <Clock size={28} color={TG.accent} />
              )}
            </Animated.View>
          </CircularProgress>
          <View style={styles.timerTextArea}>
            <Text style={styles.timerLabel}>
              {phase === 'prep' ? 'Preparation Time' : 'Recording Time'}
            </Text>
            <Text style={[styles.timerValue, phase === 'speak' && { color: TG.red }]}>
              {minutes}:{seconds}
            </Text>
          </View>
        </View>

        {/* Wave bars for recording */}
        {phase === 'speak' && (
          <View style={styles.waveBars}>
            {Array.from({ length: 24 }).map((_, i) => {
              const h = 4 + Math.sin((i * 0.8) + Date.now() * 0.001) * 12;
              return (
                <Animated.View
                  key={i}
                  style={[
                    styles.waveBar,
                    {
                      height: h,
                      opacity: waveAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.3, 0.8],
                      }),
                    },
                  ]}
                />
              );
            })}
          </View>
        )}

        {/* Action buttons */}
        {phase === 'prep' ? (
          <TouchableOpacity style={styles.startBtn} onPress={() => setTimeLeft(0)} activeOpacity={0.8}>
            <View style={styles.btnIconCircle}>
              <Mic size={20} color={TG.textWhite} />
            </View>
            <View style={styles.btnTextArea}>
              <Text style={styles.btnTitle}>Start Speaking</Text>
              <Text style={styles.btnHint}>Skip preparation</Text>
            </View>
            <ChevronRight size={20} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        ) : phase === 'speak' ? (
          <TouchableOpacity style={styles.stopBtn} onPress={() => setTimeLeft(0)} activeOpacity={0.8}>
            <View style={styles.btnIconCircleStop}>
              {isLastQuestion ? <Send size={20} color={TG.textWhite} /> : <Pause size={20} color={TG.textWhite} />}
            </View>
            <View style={styles.btnTextArea}>
              <Text style={styles.btnTitle}>{isLastQuestion ? 'Submit & Finish' : 'Next Question'}</Text>
              <Text style={styles.btnHint}>
                {isLastQuestion ? 'Upload your recording' : `${questions.length - currentIndex - 1} remaining`}
              </Text>
            </View>
            <ChevronRight size={20} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        ) : uploading ? (
          <View style={styles.uploadingRow}>
            <ActivityIndicator size="small" color={TG.accent} />
            <Text style={styles.uploadingText}>Uploading recording...</Text>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TG.bgSecondary },
  centerFull: { justifyContent: 'center', alignItems: 'center' },

  // Loading
  loadingContainer: { alignItems: 'center' },
  loadingIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: TG.accentLight, justifyContent: 'center', alignItems: 'center',
  },
  loadingText: { color: TG.textSecondary, fontSize: 15, marginTop: 12 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: TG.headerBg, paddingHorizontal: 16, paddingVertical: 12, gap: 12,
  },
  headerRecording: { backgroundColor: '#c62828' },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: TG.textWhite },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 1 },
  headerBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  headerBadgeText: { fontSize: 11, fontWeight: '800', color: TG.textWhite, letterSpacing: 1 },

  // Progress
  progressTrack: { height: 4, backgroundColor: TG.separator, position: 'relative' },
  progressFill: { height: 4, backgroundColor: TG.accent, position: 'absolute', left: 0, top: 0 },
  progressFillRec: { backgroundColor: TG.red },
  progressDot: {
    position: 'absolute', top: -2, width: 8, height: 8, borderRadius: 4,
    backgroundColor: TG.separator, marginLeft: -4,
  },
  progressDotDone: { backgroundColor: TG.green },
  progressDotActive: { backgroundColor: TG.accent, width: 10, height: 10, borderRadius: 5, top: -3, marginLeft: -5 },

  // Content
  content: { padding: 16, paddingBottom: 8 },

  phaseRow: { alignItems: 'center', marginBottom: 16 },
  phasePill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: TG.accentLight, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  phasePillRec: { backgroundColor: TG.redLight },
  phasePillText: { fontSize: 13, fontWeight: '600', color: TG.accent },

  questionCard: {
    backgroundColor: TG.bg, borderRadius: 16, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8,
    elevation: 3,
  },
  questionCardRec: { borderWidth: 1.5, borderColor: TG.red + '30' },
  questionCardInner: { padding: 20 },
  speakerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12,
  },
  speakerHint: { fontSize: 12, color: TG.accent, fontWeight: '600' },
  questionText: {
    fontSize: 18, fontWeight: '600', color: TG.textPrimary, lineHeight: 28, textAlign: 'center',
  },

  imageCard: {
    backgroundColor: TG.bg, borderRadius: 16, overflow: 'hidden', marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8,
    elevation: 3,
  },
  imageLabel: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8,
  },
  imageLabelText: { fontSize: 12, fontWeight: '600', color: TG.textSecondary },
  image: { width: '100%', height: 220, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },

  // Steps
  stepsRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 16, paddingVertical: 8,
    flexWrap: 'wrap',
  },
  stepItem: { alignItems: 'center', gap: 4 },
  stepDot: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: TG.separator, borderWidth: 2, borderColor: TG.separator,
  },
  stepDotActive: { borderColor: TG.accent, backgroundColor: TG.accentLight },
  stepLabel: { fontSize: 11, fontWeight: '600', color: TG.textHint },

  // Footer
  footer: {
    backgroundColor: TG.bg, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28,
    borderTopWidth: 0.5, borderTopColor: TG.separator,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.04, shadowRadius: 8,
    elevation: 8,
  },
  footerRec: { borderTopColor: TG.red + '30' },

  // Timer
  timerArea: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, marginBottom: 20,
  },
  timerInner: {
    width: RING_SIZE - RING_STROKE * 2 - 16,
    height: RING_SIZE - RING_STROKE * 2 - 16,
    borderRadius: (RING_SIZE - RING_STROKE * 2 - 16) / 2,
    backgroundColor: TG.accentLight,
    justifyContent: 'center', alignItems: 'center',
  },
  timerInnerRec: { backgroundColor: TG.redLight },
  timerTextArea: { alignItems: 'flex-start' },
  timerLabel: { fontSize: 13, fontWeight: '600', color: TG.textSecondary, marginBottom: 4 },
  timerValue: {
    fontSize: 44, fontWeight: '800', color: TG.textPrimary,
    fontVariant: ['tabular-nums'], letterSpacing: -1,
  },

  // Wave bars
  waveBars: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 3, height: 28, marginBottom: 16,
  },
  waveBar: {
    width: 3, borderRadius: 1.5, backgroundColor: TG.red,
  },

  // Buttons
  startBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: TG.accent, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18,
  },
  stopBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: TG.red, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18,
  },
  btnIconCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center',
  },
  btnIconCircleStop: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center',
  },
  btnTextArea: { flex: 1 },
  btnTitle: { color: TG.textWhite, fontSize: 16, fontWeight: '700' },
  btnHint: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 1 },

  // Uploading
  uploadingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 14,
  },
  uploadingText: { fontSize: 14, fontWeight: '600', color: TG.textSecondary },
});