import { TG } from '@/constants/theme';
import { apiSubmitSpeaking } from '@/lib/api';
import { fetchQuestionsByTestId, Question } from '@/lib/data';
import { useAuth } from '@/store/auth';
import { AudioModule, createAudioPlayer, RecordingPresets, useAudioRecorder } from 'expo-audio';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ImageIcon,
  Mic,
  MicOff,
  Pause,
  Play,
  Send,
  Shield,
  Timer,
  TimerOff,
  User as UserIcon,
  Volume2
} from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_W } = Dimensions.get('window');
const RING_SIZE = 140;
const RING_STROKE = 6;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const beepAsset = require('@/assets/audios/beep.mp3');

function playBeep() {
  try {
    const player = createAudioPlayer(beepAsset);
    player.play();
    setTimeout(() => { try { player.remove(); } catch {} }, 1000);
  } catch (e) {
    console.warn('Beep failed', e);
  }
}

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
  const [screen, setScreen] = useState<'intro' | 'test'>('intro');
  const [phase, setPhase] = useState<'audio' | 'prep' | 'beep' | 'speak' | 'done'>('audio');
  const [timeLeft, setTimeLeft] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [micGranted, setMicGranted] = useState(false);
  const [prepTimerEnabled, setPrepTimerEnabled] = useState(true);
  const [speakTimerEnabled, setSpeakTimerEnabled] = useState(true);
  const [practiceMode, setPracticeMode] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [introStep, setIntroStep] = useState(0); // 0=mic, 1=timers, 2=practice, 3=start

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const audioPlayerRef = useRef<any>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const lastTimerPhaseRef = useRef<string | null>(null);

  const question = questions[currentIndex] ?? null;
  const isLastQuestion = currentIndex >= questions.length - 1;

  const requestMic = useCallback(async () => {
    try {
      const perms = await AudioModule.requestRecordingPermissionsAsync();
      setMicGranted(perms.status === 'granted');
      return perms.status === 'granted';
    } catch {
      return false;
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const perms = await AudioModule.requestRecordingPermissionsAsync();
      if (perms.status === 'granted') {
        await AudioModule.setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await audioRecorder.prepareToRecordAsync();
        audioRecorder.record();
      }
    } catch (err) {
      console.warn('Failed to start recording', err);
    }
  }, [audioRecorder]);

  const startTest = useCallback(() => {
    setScreen('test');
    setPhase('audio');
  }, []);

  const saveAndAdvance = useCallback(async () => {
    try {
      setPhase('done');
      setUploading(true);
      if (audioRecorder.isRecording) await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (uri && user && question) {
        const result = await apiSubmitSpeaking(question.id, uri, {
          ...(sessionId
            ? { sessionId }
            : { testId: Number(id) }),
          ...(practiceMode && { visibility: 'ai_only' }),
          ...(isAnonymous && { isAnonymous: true }),
        });
        if (!sessionId && result?.sessionId) {
          setSessionId(result.sessionId);
        }
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
      setPhase('audio');
    }
  }, [audioRecorder, id, isLastQuestion, question, router, sessionId, user]);

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

  // Check mic permission on mount
  useEffect(() => {
    AudioModule.getRecordingPermissionsAsync().then((p) => setMicGranted(p.status === 'granted'));
  }, []);

  // Cleanup audio player on unmount
  useEffect(() => {
    return () => {
      try { audioPlayerRef.current?.remove(); } catch {}
    };
  }, []);

  useEffect(() => {
    if (screen !== 'test' || !question) return;
    if (phase === 'audio') {
      // Play the question audio_url, then move to prep
      try { audioPlayerRef.current?.remove(); } catch {}
      if (question.audio_url) {
        const player = createAudioPlayer(question.audio_url);
        audioPlayerRef.current = player;
        const sub = player.addListener('playbackStatusUpdate', (status: any) => {
          if (status.didJustFinish || (status.currentTime > 0 && status.playing === false && status.currentTime >= (status.duration || 0) - 0.1)) {
            sub?.remove();
            try { player.remove(); } catch {}
            audioPlayerRef.current = null;
            setPhase('prep');
          }
        });
        player.play();
        // Fallback: if audio is short or status doesn't fire, move after a max wait
        const fallback = setTimeout(() => {
          sub?.remove();
          try { player.remove(); } catch {}
          audioPlayerRef.current = null;
          setPhase(prev => prev === 'audio' ? 'prep' : prev);
        }, 30000);
        return () => {
          clearTimeout(fallback);
          sub?.remove();
        };
      } else {
        // No audio_url, skip to prep immediately
        setPhase('prep');
      }
    } else if (phase === 'prep') {
      if (prepTimerEnabled) {
        setTimeLeft(question.prep_timer);
        setTimeElapsed(0);
      } else {
        setTimeElapsed(0);
      }
    } else if (phase === 'beep') {
      playBeep();
      const t = setTimeout(() => setPhase('speak'), 500);
      return () => clearTimeout(t);
    } else if (phase === 'speak') {
      if (speakTimerEnabled) {
        setTimeLeft(question.speaking_timer);
      }
      setTimeElapsed(0);
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
  }, [screen, phase, currentIndex, pulseAnim, waveAnim, question, startRecording]);

  useEffect(() => {
    if (screen !== 'test' || !question) return;
    // Skip the first run after phase changes — timeLeft hasn't been updated yet
    if (lastTimerPhaseRef.current !== `${phase}-${currentIndex}`) {
      lastTimerPhaseRef.current = `${phase}-${currentIndex}`;
      return;
    }
    if (phase === 'audio') return; // no timer during audio playback

    const isCountdown = phase === 'prep' ? prepTimerEnabled : phase === 'speak' ? speakTimerEnabled : true;

    if (isCountdown) {
      if (timeLeft <= 0) {
        if (phase === 'prep') setPhase('beep');
        else if (phase === 'speak') saveAndAdvance();
        return;
      }
      const timer = setInterval(() => setTimeLeft(p => p - 1), 1000);
      return () => clearInterval(timer);
    } else {
      // Count-up mode: no auto-advance, just count up
      const timer = setInterval(() => setTimeElapsed(p => p + 1), 1000);
      return () => clearInterval(timer);
    }
  }, [screen, phase, currentIndex, question, saveAndAdvance, timeLeft, prepTimerEnabled, speakTimerEnabled]);

  const isCurrentCountdown = phase === 'prep' || phase === 'beep'
    ? prepTimerEnabled
    : phase === 'speak'
    ? speakTimerEnabled
    : true;
  const displayTime = isCurrentCountdown ? timeLeft : timeElapsed;
  const totalTime = question
    ? (phase === 'prep' || phase === 'beep') ? question.prep_timer : question.speaking_timer
    : 1;
  const progress = isCurrentCountdown
    ? (totalTime > 0 ? (totalTime - timeLeft) / totalTime : 0)
    : 0; // No progress ring for count-up
  const minutes = Math.floor(displayTime / 60);
  const seconds = (displayTime % 60).toString().padStart(2, '0');
  const ringColor = phase === 'speak' ? TG.red : TG.accent;
  const statusBg = screen === 'test' && phase === 'speak' ? '#c62828' : TG.headerBg;

  // ─── Intro Screen ─────────────────────────────────
  const STEP_LABELS = ['Microphone', 'Timers', 'Practice', 'Start'];
  const canAdvance = introStep === 0 ? micGranted : true;
  const canStart = micGranted && !loadingQ;

  if (screen === 'intro') return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: statusBg }]}>
      <StatusBar barStyle="light-content" backgroundColor={statusBg} />
      <View style={[styles.header]}>
        <TouchableOpacity
          onPress={() => (introStep > 0 ? setIntroStep(introStep - 1) : router.back())}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <ArrowLeft size={22} color={TG.textWhite} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Speaking Test</Text>
          <Text style={styles.headerSubtitle}>
            Step {introStep + 1} of {STEP_LABELS.length} — {STEP_LABELS[introStep]}
          </Text>
        </View>
      </View>

      {/* Step indicator bars */}
      <View style={styles.introDotsRow}>
        {STEP_LABELS.map((_, i) => (
          <View key={i} style={[styles.introDot, i <= introStep && styles.introDotActive]} />
        ))}
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: TG.bgSecondary }}
        contentContainerStyle={styles.introContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Step 0: Microphone ────── */}
        {introStep === 0 && (
          <>
            <View style={[styles.introIconWrap, { backgroundColor: micGranted ? TG.green + '15' : TG.accentLight }]}>
              {micGranted ? <CheckCircle2 size={40} color={TG.green} /> : <Mic size={40} color={TG.accent} />}
            </View>
            <Text style={styles.introTitle}>Microphone Access</Text>
            <Text style={styles.introDesc}>
              We need microphone permission to record your speaking responses.
            </Text>
            <TouchableOpacity
              style={[styles.introStep, micGranted && styles.introStepDone]}
              onPress={requestMic}
              activeOpacity={0.7}
            >
              <View style={[styles.introStepNum, micGranted && styles.introStepNumDone]}>
                {micGranted ? (
                  <CheckCircle2 size={20} color={TG.textWhite} />
                ) : (
                  <Mic size={16} color={TG.textWhite} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.introStepTitle, micGranted && { color: TG.green }]}>
                  {micGranted ? 'Permission Granted' : 'Allow Microphone'}
                </Text>
                <Text style={styles.introStepHint}>
                  {micGranted ? 'You\'re all set to record' : 'Tap to grant microphone access'}
                </Text>
              </View>
              {micGranted ? <Mic size={20} color={TG.green} /> : <MicOff size={20} color={TG.textHint} />}
            </TouchableOpacity>
          </>
        )}

        {/* ── Step 1: Timer Settings ── */}
        {introStep === 1 && (
          <>
            <View style={[styles.introIconWrap, { backgroundColor: TG.accentLight }]}>
              <Timer size={40} color={TG.accent} />
            </View>
            <Text style={styles.introTitle}>Timer Settings</Text>
            <Text style={styles.introDesc}>
              Choose whether timers count down automatically or let you control the pace.
            </Text>
            <View style={styles.introSettingsCard}>
              <View style={styles.introSettingRow}>
                <View style={styles.introSettingInfo}>
                  {prepTimerEnabled ? <Timer size={18} color={TG.accent} /> : <TimerOff size={18} color={TG.textHint} />}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.introSettingLabel}>Prep Timer</Text>
                    <Text style={styles.introSettingHint}>
                      {prepTimerEnabled ? 'Countdown — auto-starts recording' : 'Count up — you decide when to speak'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={prepTimerEnabled}
                  onValueChange={setPrepTimerEnabled}
                  trackColor={{ false: TG.separator, true: TG.accent + '60' }}
                  thumbColor={prepTimerEnabled ? TG.accent : TG.textHint}
                />
              </View>
              <View style={[styles.introSettingRow, { borderBottomWidth: 0 }]}>
                <View style={styles.introSettingInfo}>
                  {speakTimerEnabled ? <Timer size={18} color={TG.red} /> : <TimerOff size={18} color={TG.textHint} />}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.introSettingLabel}>Speaking Timer</Text>
                    <Text style={styles.introSettingHint}>
                      {speakTimerEnabled ? 'Countdown — auto-submits when done' : 'Count up — you decide when to stop'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={speakTimerEnabled}
                  onValueChange={setSpeakTimerEnabled}
                  trackColor={{ false: TG.separator, true: TG.red + '60' }}
                  thumbColor={speakTimerEnabled ? TG.red : TG.textHint}
                />
              </View>
            </View>
          </>
        )}

        {/* ── Step 2: Practice Mode ─── */}
        {introStep === 2 && (
          <>
            <View style={[styles.introIconWrap, { backgroundColor: TG.achievePurple + '15' }]}>
              <Shield size={40} color={TG.achievePurple} />
            </View>
            <Text style={styles.introTitle}>Practice Mode</Text>
            <Text style={styles.introDesc}>
              Enable AI-only review for private practice, or keep it off for full teacher feedback.
            </Text>
            <View style={styles.introSettingsCard}>
              <View style={styles.introSettingRow}>
                <View style={styles.introSettingInfo}>
                  <BookOpen size={18} color={practiceMode ? TG.achievePurple : TG.textHint} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.introSettingLabel}>AI-Only Review</Text>
                    <Text style={styles.introSettingHint}>
                      {practiceMode ? 'Only AI will review — not visible to teachers' : 'Teachers & AI can review your recording'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={practiceMode}
                  onValueChange={(val) => {
                    setPracticeMode(val);
                    if (!val) setIsAnonymous(false);
                  }}
                  trackColor={{ false: TG.separator, true: TG.achievePurple + '60' }}
                  thumbColor={practiceMode ? TG.achievePurple : TG.textHint}
                />
              </View>
              {practiceMode && (
                <View style={[styles.introSettingRow, { borderBottomWidth: 0 }]}>
                  <View style={styles.introSettingInfo}>
                    <UserIcon size={18} color={isAnonymous ? TG.orange : TG.textHint} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.introSettingLabel}>Stay Anonymous</Text>
                      <Text style={styles.introSettingHint}>
                        {isAnonymous ? 'Your name is hidden from others' : 'Your name is visible'}
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={isAnonymous}
                    onValueChange={setIsAnonymous}
                    trackColor={{ false: TG.separator, true: TG.orange + '60' }}
                    thumbColor={isAnonymous ? TG.orange : TG.textHint}
                  />
                </View>
              )}
            </View>
          </>
        )}

        {/* ── Step 3: Start ───────── */}
        {introStep === 3 && (
          <>
            <View style={[styles.introIconWrap, { backgroundColor: TG.scoreGreen + '15' }]}>
              <Play size={40} color={TG.scoreGreen} />
            </View>
            <Text style={styles.introTitle}>Ready to Go!</Text>
            <Text style={styles.introDesc}>
              {questions.length} question{questions.length !== 1 ? 's' : ''} loaded. Review your settings below, then start the test.
            </Text>

            {/* Summary pills */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Mic size={16} color={TG.green} />
                <Text style={styles.summaryLabel}>Microphone</Text>
                <Text style={[styles.summaryValue, { color: TG.green }]}>Granted</Text>
              </View>
              <View style={styles.summaryRow}>
                <Timer size={16} color={TG.accent} />
                <Text style={styles.summaryLabel}>Prep Timer</Text>
                <Text style={styles.summaryValue}>{prepTimerEnabled ? 'Countdown' : 'Free'}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Timer size={16} color={TG.red} />
                <Text style={styles.summaryLabel}>Speak Timer</Text>
                <Text style={styles.summaryValue}>{speakTimerEnabled ? 'Countdown' : 'Free'}</Text>
              </View>
              <View style={[styles.summaryRow, { borderBottomWidth: 0 }]}>
                <Shield size={16} color={TG.achievePurple} />
                <Text style={styles.summaryLabel}>Practice Mode</Text>
                <Text style={styles.summaryValue}>{practiceMode ? (isAnonymous ? 'AI-Only + Anon' : 'AI-Only') : 'Off'}</Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* Bottom nav bar */}
      <View style={styles.introBottomBar}>
        {introStep > 0 && (
          <TouchableOpacity
            style={styles.introBackBtn}
            onPress={() => setIntroStep(introStep - 1)}
            activeOpacity={0.7}
          >
            <ChevronLeft size={20} color={TG.accent} />
            <Text style={styles.introBackBtnText}>Back</Text>
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }} />
        {introStep < 3 ? (
          <TouchableOpacity
            style={[styles.introNextBtn, !canAdvance && { opacity: 0.4 }]}
            onPress={() => canAdvance && setIntroStep(introStep + 1)}
            disabled={!canAdvance}
            activeOpacity={0.7}
          >
            <Text style={styles.introNextBtnText}>Next</Text>
            <ChevronRight size={20} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.introStartBtn, !canStart && { opacity: 0.4 }]}
            onPress={startTest}
            disabled={!canStart}
            activeOpacity={0.8}
          >
            <Play size={20} color="#fff" />
            <Text style={styles.introStartText}>Start Test</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );

  if (loadingQ) return (
    <SafeAreaView style={[styles.safeArea, styles.centerFull, { backgroundColor: statusBg }]}>
      <StatusBar barStyle="light-content" backgroundColor={statusBg} />
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
    <SafeAreaView style={[styles.safeArea, styles.centerFull, { backgroundColor: statusBg }]}>
      <StatusBar barStyle="light-content" backgroundColor={statusBg} />
      <Text style={{ color: TG.textSecondary, fontSize: 16 }}>No questions found</Text>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: statusBg }]}>
      <StatusBar barStyle="light-content" backgroundColor={statusBg} />

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
            {phase === 'audio' ? 'LISTEN' : phase === 'prep' || phase === 'beep' ? 'PREP' : phase === 'speak' ? 'REC' : 'DONE'}
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
        style={{ opacity: fadeAnim, flex: 1, backgroundColor: TG.bgSecondary }}
      >
        {/* Phase indicator pill */}
        <View style={styles.phaseRow}>
          <View style={[styles.phasePill, phase === 'speak' && styles.phasePillRec, phase === 'audio' && styles.phasePillAudio]}>
            {phase === 'audio' ? (
              <Volume2 size={14} color={TG.orange} />
            ) : phase === 'prep' ? (
              <Clock size={14} color={TG.accent} />
            ) : (
              <Mic size={14} color={TG.red} />
            )}
            <Text style={[styles.phasePillText, phase === 'speak' && { color: TG.red }, phase === 'audio' && { color: TG.orange }]}>
              {phase === 'audio' ? 'Listen to the question' : phase === 'prep' ? 'Read & prepare your answer' : 'Speak now — recording in progress'}
            </Text>
          </View>
        </View>

        {/* Question card */}
        <View style={[styles.questionCard, phase === 'speak' && styles.questionCardRec, phase === 'audio' && styles.questionCardAudio]}>
          <View style={styles.questionCardInner}>
            {(phase === 'audio' || phase === 'prep') && (
              <View style={styles.speakerRow}>
                <Volume2 size={16} color={phase === 'audio' ? TG.orange : TG.accent} />
                <Text style={[styles.speakerHint, phase === 'audio' && { color: TG.orange }]}>
                  {phase === 'audio' ? 'Playing audio...' : 'Prepare your answer'}
                </Text>
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
        {phase === 'audio' ? (
          /* Audio playing indicator */
          <View style={styles.audioPlayingArea}>
            <View style={styles.audioPlayingIcon}>
              <Volume2 size={28} color={TG.orange} />
            </View>
            <Text style={styles.audioPlayingText}>Playing question audio...</Text>
            <ActivityIndicator size="small" color={TG.orange} style={{ marginTop: 8 }} />
          </View>
        ) : (
        <>
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
              {phase === 'prep' || phase === 'beep'
                ? (prepTimerEnabled ? 'Preparation Time' : 'Prep Time (no limit)')
                : (speakTimerEnabled ? 'Recording Time' : 'Recording (no limit)')}
            </Text>
            <Text style={[styles.timerValue, phase === 'speak' && { color: TG.red }, !isCurrentCountdown && { color: TG.textSecondary }]}>
              {minutes}:{seconds}
            </Text>
            {!isCurrentCountdown && (
              <Text style={styles.timerCountUpHint}>▲ counting up</Text>
            )}
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
        {phase === 'prep' || phase === 'beep' ? (
          <TouchableOpacity style={styles.startBtn} onPress={() => { setPhase('beep'); }} activeOpacity={0.8} disabled={phase === 'beep'}>
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
          <TouchableOpacity style={styles.stopBtn} onPress={() => speakTimerEnabled ? setTimeLeft(0) : saveAndAdvance()} activeOpacity={0.8}>
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
        </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TG.headerBg },
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
  phasePillAudio: { backgroundColor: TG.orangeLight },
  phasePillText: { fontSize: 13, fontWeight: '600', color: TG.accent },

  questionCard: {
    backgroundColor: TG.bg, borderRadius: 16, marginBottom: 16,
  },
  questionCardRec: { borderWidth: 1.5, borderColor: TG.red + '30' },
  questionCardAudio: { borderWidth: 1.5, borderColor: TG.orange + '30' },
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
  timerCountUpHint: { fontSize: 11, color: TG.textHint, fontWeight: '600', marginTop: 2 },

  // Audio playing
  audioPlayingArea: {
    alignItems: 'center', justifyContent: 'center', paddingVertical: 20, gap: 8,
  },
  audioPlayingIcon: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: TG.orangeLight, justifyContent: 'center', alignItems: 'center',
    marginBottom: 4,
  },
  audioPlayingText: { fontSize: 15, fontWeight: '600', color: TG.orange },

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

  // Intro screen
  introContent: {
    paddingHorizontal: 24, paddingTop: 32, paddingBottom: 28,
    alignItems: 'center',
  },
  introDotsRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 8, paddingVertical: 14, backgroundColor: TG.bgSecondary,
    paddingHorizontal: 24,
  },
  introDot: {
    flex: 1, height: 4, borderRadius: 2,
    backgroundColor: TG.separator, maxWidth: 72,
  },
  introDotActive: { backgroundColor: TG.accent },
  introIconWrap: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: TG.accentLight, justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
  },
  introTitle: { fontSize: 24, fontWeight: '800', color: TG.textPrimary, marginBottom: 8 },
  introDesc: {
    fontSize: 14, color: TG.textSecondary, textAlign: 'center',
    lineHeight: 20, marginBottom: 32, paddingHorizontal: 12,
  },
  introStep: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: TG.bgSecondary, borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 16,
    width: '100%', marginBottom: 12,
    borderWidth: 1, borderColor: TG.separator,
  },
  introStepDone: { borderColor: TG.green + '40', backgroundColor: TG.green + '08' },
  introStepNum: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: TG.accent, justifyContent: 'center', alignItems: 'center',
  },
  introStepNumDone: { backgroundColor: TG.green },
  introStepNumText: { fontSize: 14, fontWeight: '800', color: TG.textWhite },
  introStepTitle: { fontSize: 16, fontWeight: '700', color: TG.textPrimary },
  introStepHint: { fontSize: 12, color: TG.textSecondary, marginTop: 2 },
  introSettingsCard: {
    width: '100%', backgroundColor: TG.bgSecondary, borderRadius: 14,
    borderWidth: 1, borderColor: TG.separator, marginBottom: 12,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4,
  },
  introSettingsHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12,
  },
  introSettingsTitle: { fontSize: 14, fontWeight: '700', color: TG.textPrimary },
  introSettingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: TG.separator,
  },
  introSettingInfo: {
    flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 12,
  },
  introSettingLabel: { fontSize: 14, fontWeight: '600', color: TG.textPrimary },
  introSettingHint: { fontSize: 11, color: TG.textHint, marginTop: 2 },
  summaryCard: {
    width: '100%', backgroundColor: TG.bgSecondary, borderRadius: 14,
    borderWidth: 1, borderColor: TG.separator, paddingHorizontal: 16,
    paddingVertical: 6,
  },
  summaryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: TG.separator,
  },
  summaryLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: TG.textPrimary },
  summaryValue: { fontSize: 13, fontWeight: '600', color: TG.textSecondary },
  introBottomBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: TG.bgSecondary, borderTopWidth: 1, borderTopColor: TG.separator,
  },
  introBackBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 12, paddingHorizontal: 16,
  },
  introBackBtnText: { fontSize: 15, fontWeight: '600', color: TG.accent },
  introNextBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: TG.accent, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 28,
  },
  introNextBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  introStartBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: TG.accent, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 28,
  },
  introStartText: { fontSize: 17, fontWeight: '700', color: TG.textWhite },
});