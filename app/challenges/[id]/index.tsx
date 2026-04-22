import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import { apiFetchChallenge, apiSubmitChallenge } from '@/lib/api';
import type { Challenge } from '@/lib/types';
import { AudioModule, RecordingPresets, useAudioRecorder } from 'expo-audio';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Flame,
  Mic,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  Users,
  Zap
} from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const DIFF: Record<string, { bg: string; text: string }> = {
  beginner: { bg: '#ECFDF5', text: '#059669' },
  intermediate: { bg: '#FFFBEB', text: '#D97706' },
  advanced: { bg: '#FEF2F2', text: '#DC2626' },
};

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// Fake waveform bars for visual feedback
function WaveformBars({ active, barCount = 28 }: { active: boolean; barCount?: number }) {
  const anims = useRef(Array.from({ length: barCount }, () => new Animated.Value(0.15))).current;

  useEffect(() => {
    if (!active) {
      anims.forEach(a => a.setValue(0.15));
      return;
    }
    const loops = anims.map((a, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(a, { toValue: Math.random() * 0.7 + 0.3, duration: 200 + Math.random() * 300, useNativeDriver: true, delay: i * 15 }),
          Animated.timing(a, { toValue: 0.1 + Math.random() * 0.15, duration: 200 + Math.random() * 300, useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, [active]);

  return (
    <View style={ws.row}>
      {anims.map((a, i) => (
        <Animated.View
          key={i}
          style={[ws.bar, active && ws.barActive, { transform: [{ scaleY: a }] }]}
        />
      ))}
    </View>
  );
}

const ws = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2.5, height: 40 },
  bar: { width: 3, height: 40, borderRadius: 1.5, backgroundColor: '#CBD5E1' },
  barActive: { backgroundColor: TG.accent },
});

export default function ChallengeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(false);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;
  const ringPulse = useRef(new Animated.Value(1)).current;

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadChallenge = useCallback(async () => {
    if (!id) return;
    try {
      const data = await apiFetchChallenge(id);
      setChallenge(data);
      if (data.submitted) setSubmitted(true);
    } catch (e) {
      console.error('Failed to load challenge', e);
      toast.error('Failed to load challenge');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadChallenge(); }, [loadChallenge]);

  // Entrance
  useEffect(() => {
    if (!loading) {
      Animated.parallel([
        Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(slideUp, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();
    }
  }, [loading]);

  // Ring pulse while recording
  useEffect(() => {
    if (recording) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(ringPulse, { toValue: 1.18, duration: 800, useNativeDriver: true }),
          Animated.timing(ringPulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    } else {
      ringPulse.setValue(1);
    }
  }, [recording]);

  // Duration timer
  useEffect(() => {
    if (recording) {
      setDuration(0);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [recording]);

  const handleRecord = async () => {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (perm.status !== 'granted') {
        toast.error('Microphone permission denied');
        return;
      }
      await AudioModule.setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
      setRecordedUri(null);
    } catch (e) {
      console.error('Recording error', e);
      toast.error('Failed to start recording');
    }
  };

  const handleStop = async () => {
    try {
      await recorder.stop();
      setRecording(false);
      setRecordedUri(recorder.uri || null);
    } catch (e) {
      console.error('Stop error', e);
      setRecording(false);
      toast.error('Failed to stop recording');
    }
  };

  const handleSubmit = async () => {
    if (!challenge || !recordedUri) return;
    setSubmitting(true);
    try {
      await apiSubmitChallenge(challenge.id, recordedUri);
      setSubmitted(true);
      toast.success('Challenge submitted!', 'Your response has been sent for review.');
    } catch (e) {
      console.error('Submit error', e);
      toast.error('Submission failed', 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── LOADING ──
  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
        <View style={s.center}><ActivityIndicator size="large" color={TG.accent} /></View>
      </SafeAreaView>
    );
  }

  // ── NOT FOUND ──
  if (!challenge) {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
        <LinearGradient colors={['#0F172A', '#1E293B']} style={s.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft size={22} color="#fff" />
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Flame size={18} color="#FF6B35" />
            <Text style={s.headerTitle}>Challenge</Text>
          </View>
          <View style={{ width: 22 }} />
        </LinearGradient>
        <View style={s.center}>
          <Text style={{ color: TG.textSecondary, fontSize: 15, fontWeight: '600' }}>Challenge not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const diff = DIFF[challenge.difficulty.toLowerCase()] || DIFF.beginner;

  // ── SUCCESS ──
  if (submitted) {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
        <LinearGradient colors={['#0F172A', '#1E293B']} style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Animated.View style={[s.successWrap, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
            <View style={s.successIcon}>
              <CheckCircle2 size={44} color="#10B981" strokeWidth={2.5} />
            </View>
            <Text style={s.successTitle}>Submitted</Text>
            <Text style={s.successSub}>Your response is being reviewed by AI</Text>

            <View style={s.successMeta}>
              <View style={s.successChip}>
                <Zap size={16} color="#FBBF24" />
                <Text style={s.successChipText}>+{challenge.xpReward} XP</Text>
              </View>
              {challenge.coinReward > 0 && (
                <View style={s.successChip}>
                  <Text style={{ fontSize: 14 }}>🪙</Text>
                  <Text style={s.successChipText}>+{challenge.coinReward}</Text>
                </View>
              )}
            </View>

            {challenge.userSubmission?.responseId && (
              <TouchableOpacity
                style={s.feedbackRow}
                onPress={() => router.push(`/ai-feedback/${challenge.userSubmission!.responseId}` as any)}
                activeOpacity={0.7}
              >
                <Sparkles size={16} color={TG.accent} />
                <Text style={s.feedbackText}>View AI Feedback</Text>
                <ChevronRight size={16} color={TG.accent} />
              </TouchableOpacity>
            )}

            <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
              <Text style={s.backBtnText}>Done</Text>
            </TouchableOpacity>
          </Animated.View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  // ── MAIN ──
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      <LinearGradient colors={['#0F172A', '#1E293B']} style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={22} color="#fff" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Flame size={18} color="#FF6B35" />
          <Text style={s.headerTitle}>Challenge</Text>
        </View>
        <View style={{ width: 22 }} />
      </LinearGradient>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollInner} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeIn, transform: [{ translateY: slideUp }] }}>

          {/* ── Info Section ── */}
          <View style={s.infoCard}>
            <View style={s.infoTop}>
              <View style={[s.diffPill, { backgroundColor: diff.bg }]}>
                <Text style={[s.diffText, { color: diff.text }]}>{challenge.difficulty}</Text>
              </View>
              <View style={s.metaRow}>
                <Users size={13} color={TG.textHint} />
                <Text style={s.metaText}>{challenge.participantCount}</Text>
              </View>
            </View>
            <Text style={s.infoTitle}>{challenge.title}</Text>
            {challenge.description && (
              <Text style={s.infoDesc}>{challenge.description}</Text>
            )}
          </View>

          {/* ── Prompt ── */}
          <View style={s.promptCard}>
            <Text style={s.promptLabel}>Speak about this:</Text>
            <Text style={s.promptText}>{challenge.promptText}</Text>
            {challenge.promptImage && (
              <Image source={{ uri: challenge.promptImage }} style={s.promptImg} resizeMode="cover" />
            )}
          </View>

          {/* ── Reward strip ── */}
          <View style={s.rewardRow}>
            <Zap size={14} color="#FBBF24" />
            <Text style={s.rewardText}>+{challenge.xpReward} XP</Text>
            {challenge.coinReward > 0 && (
              <>
                <View style={s.rewardDot} />
                <Text style={s.rewardText}>+{challenge.coinReward} coins</Text>
              </>
            )}
          </View>

          {/* ── Recorder ── */}
          <View style={s.recorderCard}>
            {/* Waveform */}
            <WaveformBars active={recording} />

            {/* Timer */}
            <Text style={[s.timer, recording && s.timerActive]}>
              {formatDuration(duration)}
            </Text>

            {/* Controls */}
            <View style={s.controls}>
              {recordedUri && !recording && (
                <TouchableOpacity style={s.ctrlSecondary} onPress={handleRecord} activeOpacity={0.7}>
                  <RotateCcw size={20} color={TG.textSecondary} />
                </TouchableOpacity>
              )}

              <Animated.View style={recording ? { transform: [{ scale: ringPulse }] } : undefined}>
                <TouchableOpacity
                  style={[s.micBtn, recording && s.micBtnRec]}
                  onPress={recording ? handleStop : handleRecord}
                  activeOpacity={0.8}
                >
                  {recording ? (
                    <Square size={24} color="#fff" fill="#fff" />
                  ) : (
                    <Mic size={28} color="#fff" />
                  )}
                </TouchableOpacity>
              </Animated.View>

              {recordedUri && !recording && (
                <TouchableOpacity
                  style={[s.ctrlSubmit, submitting && { opacity: 0.5 }]}
                  onPress={handleSubmit}
                  disabled={submitting}
                  activeOpacity={0.8}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" size={20} />
                  ) : (
                    <Send size={20} color="#fff" />
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Status label */}
            <Text style={s.statusLabel}>
              {recording ? 'Listening...' : recordedUri ? 'Tap send to submit' : 'Tap to start recording'}
            </Text>
          </View>

        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F172A' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },

  scroll: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollInner: { paddingBottom: 40 },

  // Info
  infoCard: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
  },
  infoTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  diffPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  diffText: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, fontWeight: '600', color: TG.textHint },
  infoTitle: { fontSize: 18, fontWeight: '800', color: TG.textPrimary, letterSpacing: -0.3, marginBottom: 4 },
  infoDesc: { fontSize: 14, color: TG.textSecondary, lineHeight: 20 },

  // Prompt
  promptCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
  },
  promptLabel: { fontSize: 12, fontWeight: '700', color: TG.textHint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  promptText: { fontSize: 16, color: TG.textPrimary, lineHeight: 24, fontWeight: '500' },
  promptImg: { width: '100%', height: 160, borderRadius: 12, marginTop: 12 },

  // Rewards
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 4,
  },
  rewardText: { fontSize: 13, fontWeight: '700', color: TG.textSecondary },
  rewardDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: TG.textHint },

  // Recorder
  recorderCard: {
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  timer: {
    fontSize: 32,
    fontWeight: '300',
    color: TG.textHint,
    fontVariant: ['tabular-nums'],
    marginTop: 14,
    marginBottom: 20,
    letterSpacing: 1,
  },
  timerActive: { color: TG.textPrimary, fontWeight: '400' },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 16,
  },
  micBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: TG.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micBtnRec: { backgroundColor: '#EF4444' },
  ctrlSecondary: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctrlSubmit: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusLabel: { fontSize: 13, fontWeight: '600', color: TG.textHint },

  // Success
  successWrap: { alignItems: 'center', paddingHorizontal: 32 },
  successIcon: { marginBottom: 20 },
  successTitle: { fontSize: 24, fontWeight: '900', color: '#fff', marginBottom: 6, letterSpacing: -0.3 },
  successSub: { fontSize: 14, color: 'rgba(255,255,255,0.5)', fontWeight: '500', textAlign: 'center', marginBottom: 28 },
  successMeta: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  successChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  successChipText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 24,
    width: '100%',
  },
  feedbackText: { flex: 1, fontSize: 14, fontWeight: '700', color: TG.accent },
  backBtn: {
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  backBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
