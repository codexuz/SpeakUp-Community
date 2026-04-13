import { TG } from '@/constants/theme';
import { apiSubmitSpeaking } from '@/lib/api';
import { fetchQuestionsByTestId, Question } from '@/lib/data';
import { useAuth } from '@/store/auth';
import { AudioModule, RecordingPresets, useAudioRecorder } from 'expo-audio';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { ArrowLeft, ChevronRight, Clock, Mic, StopCircle } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SpeakingScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadingQ, setLoadingQ] = useState(true);
  const [phase, setPhase] = useState<'prep' | 'speak' | 'done'>('prep');
  const [timeLeft, setTimeLeft] = useState(0);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const question = questions[currentIndex] ?? null;
  const isLastQuestion = currentIndex >= questions.length - 1;

  const startRecording = useCallback(async () => {
    try {
      const perms = await AudioModule.requestRecordingPermissionsAsync();
      if (perms.status === 'granted') await audioRecorder.record();
    } catch (err) {
      console.warn('Failed to start recording', err);
    }
  }, [audioRecorder]);

  const saveAndAdvance = useCallback(async () => {
    try {
      setPhase('done');
      if (audioRecorder.isRecording) await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (uri && user && question) {
        await apiSubmitSpeaking(question.id, uri);
      }
    } catch (err) {
      console.error('Failed to save recording', err);
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
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [phase, currentIndex, pulseAnim, question, startRecording]);

  useEffect(() => {
    if (timeLeft <= 0) {
      if (phase === 'prep') setPhase('speak');
      else if (phase === 'speak') saveAndAdvance();
      return;
    }
    const timer = setInterval(() => setTimeLeft(p => p - 1), 1000);
    return () => clearInterval(timer);
  }, [phase, saveAndAdvance, timeLeft]);

  if (loadingQ) return (
    <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
      <ActivityIndicator size="large" color={TG.accent} />
    </SafeAreaView>
  );

  if (questions.length === 0 || !question) return (
    <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
      <Text style={{ color: TG.textSecondary, fontSize: 16 }}>No questions found</Text>
    </SafeAreaView>
  );

  const minutes = Math.floor(timeLeft / 60);
  const seconds = (timeLeft % 60).toString().padStart(2, '0');

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.header, phase === 'speak' && { backgroundColor: TG.red }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft size={22} color={TG.textWhite} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Part {question.part}</Text>
        <Text style={styles.headerCounter}>{currentIndex + 1}/{questions.length}</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${((currentIndex + 1) / questions.length) * 100}%` }]} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {question.image && (
          <View style={styles.imageCard}>
            <Image source={{ uri: question.image }} style={styles.image} resizeMode="contain" />
          </View>
        )}
        <View style={styles.questionCard}>
          <Text style={styles.questionText}>{question.q_text}</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.timerSection}>
          <Animated.View style={[
            styles.micCircle,
            phase === 'speak' && styles.micCircleActive,
            { transform: [{ scale: phase === 'speak' ? pulseAnim : 1 }] },
          ]}>
            {phase === 'speak' ? <Mic size={32} color={TG.red} /> : <Clock size={32} color={TG.accent} />}
          </Animated.View>
          <Text style={styles.timerLabel}>{phase === 'prep' ? 'Preparation' : 'Recording'}</Text>
          <Text style={[styles.timerValue, phase === 'speak' && { color: TG.red }]}>{minutes}:{seconds}</Text>
        </View>

        {phase === 'prep' ? (
          <TouchableOpacity style={styles.startBtn} onPress={() => setTimeLeft(0)} activeOpacity={0.7}>
            <Mic size={20} color={TG.textWhite} />
            <Text style={styles.btnText}>Start Speaking</Text>
          </TouchableOpacity>
        ) : phase === 'speak' ? (
          <TouchableOpacity style={styles.stopBtn} onPress={() => setTimeLeft(0)} activeOpacity={0.7}>
            <StopCircle size={20} color={TG.textWhite} />
            <Text style={styles.btnText}>{isLastQuestion ? 'Finish' : 'Next'}</Text>
            {!isLastQuestion && <ChevronRight size={18} color={TG.textWhite} />}
          </TouchableOpacity>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TG.bg },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: TG.headerBg, paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: TG.textWhite },
  headerCounter: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.7)', minWidth: 36, textAlign: 'right' },

  progressTrack: { height: 3, backgroundColor: TG.separator },
  progressFill: { height: 3, backgroundColor: TG.accent },

  content: { padding: 20, paddingBottom: 8 },
  imageCard: {
    backgroundColor: TG.bgSecondary, borderRadius: 12, padding: 8, marginBottom: 16,
    borderWidth: 0.5, borderColor: TG.separator,
  },
  image: { width: '100%', height: 200, borderRadius: 8 },
  questionCard: {
    backgroundColor: TG.bgSecondary, borderRadius: 14, padding: 20,
  },
  questionText: { fontSize: 20, fontWeight: '600', color: TG.textPrimary, lineHeight: 30, textAlign: 'center' },

  footer: { padding: 24, paddingBottom: 32, alignItems: 'center' },
  timerSection: { alignItems: 'center', marginBottom: 24 },
  micCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: TG.accentLight, justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  micCircleActive: { backgroundColor: TG.redLight },
  timerLabel: { fontSize: 14, fontWeight: '600', color: TG.textSecondary, marginBottom: 4 },
  timerValue: { fontSize: 48, fontWeight: '700', color: TG.textPrimary, fontVariant: ['tabular-nums'] },

  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: TG.accent, borderRadius: 12, paddingVertical: 16, width: '100%',
  },
  stopBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: TG.red, borderRadius: 12, paddingVertical: 16, width: '100%',
  },
  btnText: { color: TG.textWhite, fontSize: 16, fontWeight: '700' },
});