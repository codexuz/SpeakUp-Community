import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import { apiFetchWritingTest, apiSubmitEssay } from '@/lib/api';
import type { WritingTask, WritingTest } from '@/lib/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Check, Clock, FileText, Send } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function WritingSubmitScreen() {
  const { testId } = useLocalSearchParams<{ testId: string }>();
  const router = useRouter();
  const toast = useToast();

  const [test, setTest] = useState<WritingTest | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [essayText, setEssayText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [completedTasks, setCompletedTasks] = useState<Set<number>>(new Set());

  // Timer
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!testId) return;
    setLoading(true);
    apiFetchWritingTest(Number(testId))
      .then((data) => {
        setTest(data);
        if (data.tasks?.length) {
          setTimeLeft(data.tasks[0].timeLimit);
        }
      })
      .catch((e: any) => toast.error('Error', e.message))
      .finally(() => setLoading(false));
  }, [testId]);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    if (test?.tasks?.length && !loading) {
      startTimer();
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [test, loading, startTimer]);

  const tasks = test?.tasks || [];
  const currentTask = tasks[currentTaskIndex] as WritingTask | undefined;

  const wordCount = essayText.trim().split(/\s+/).filter(Boolean).length;

  const handleSubmit = async () => {
    if (!currentTask || !essayText.trim()) {
      toast.warning('Validation', 'Please write your essay first');
      return;
    }

    if (currentTask.minWords && wordCount < currentTask.minWords) {
      toast.warning('Too short', `Minimum ${currentTask.minWords} words required (current: ${wordCount})`);
      return;
    }

    if (timerRef.current) clearInterval(timerRef.current);
    const timeTaken = Math.floor((Date.now() - startTimeRef.current) / 1000);

    setSubmitting(true);
    try {
      const payload: any = {
        taskId: currentTask.id,
        essayText: essayText.trim(),
        timeTakenSec: timeTaken,
        visibility: 'community',
      };

      if (sessionId) {
        payload.sessionId = sessionId;
      } else {
        payload.testId = Number(testId);
      }

      const res = await apiSubmitEssay(payload);

      if (res.sessionId && !sessionId) {
        setSessionId(res.sessionId);
      }

      setCompletedTasks((prev) => new Set(prev).add(currentTask.id));
      toast.success('Submitted', 'Essay submitted! AI is analyzing it...');

      // Move to next task or finish
      if (currentTaskIndex < tasks.length - 1) {
        const nextIndex = currentTaskIndex + 1;
        setCurrentTaskIndex(nextIndex);
        setEssayText('');
        setTimeLeft(tasks[nextIndex].timeLimit);
        startTimeRef.current = Date.now();
        startTimer();
      } else {
        // All tasks done
        if (res.sessionId || sessionId) {
          router.replace({ pathname: '/writing/session/[id]', params: { id: res.sessionId || sessionId! } } as any);
        } else {
          router.back();
        }
      }
    } catch (e: any) {
      toast.error('Error', e.message);
      startTimer(); // Resume timer on error
    } finally {
      setSubmitting(false);
    }
  };

  const timerColor = timeLeft <= 60 ? TG.red : timeLeft <= 300 ? TG.orange : TG.textWhite;

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <ArrowLeft size={22} color={TG.textWhite} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Writing Test</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={TG.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!test || !currentTask) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <ArrowLeft size={22} color={TG.textWhite} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Writing Test</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.centered}>
          <Text style={{ color: TG.textSecondary }}>No tasks available</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <ArrowLeft size={22} color={TG.textWhite} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{test.title}</Text>
        <View style={[styles.timerBadge, { borderColor: timerColor }]}>
          <Clock size={12} color={timerColor} />
          <Text style={[styles.timerText, { color: timerColor }]}>{formatTime(timeLeft)}</Text>
        </View>
      </View>

      {/* Task navigation pills */}
      {tasks.length > 1 && (
        <View style={styles.taskNav}>
          {tasks.map((t, i) => {
            const done = completedTasks.has(t.id);
            const active = i === currentTaskIndex;
            return (
              <View
                key={t.id}
                style={[
                  styles.taskPill,
                  active && styles.taskPillActive,
                  done && styles.taskPillDone,
                ]}
              >
                {done ? (
                  <Check size={12} color={TG.green} />
                ) : (
                  <Text style={[styles.taskPillText, active && styles.taskPillTextActive]}>
                    {t.part}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={{ flex: 1, backgroundColor: TG.bgSecondary }}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Task prompt */}
          <View style={styles.promptCard}>
            <View style={styles.promptHeader}>
              <View style={styles.partBadge}>
                <Text style={styles.partBadgeText}>{currentTask.part}</Text>
              </View>
              <Text style={styles.wordRange}>{currentTask.minWords}–{currentTask.maxWords} words</Text>
            </View>
            <Text style={styles.promptText}>{currentTask.taskText}</Text>
          </View>

          {/* Essay input */}
          <View style={styles.essayContainer}>
            <TextInput
              style={styles.essayInput}
              value={essayText}
              onChangeText={setEssayText}
              placeholder="Start writing your essay here..."
              placeholderTextColor={TG.textHint}
              multiline
              textAlignVertical="top"
              autoFocus
            />
          </View>
        </ScrollView>

        {/* Bottom bar */}
        <View style={styles.bottomBar}>
          <View style={styles.wordCountRow}>
            <FileText size={14} color={wordCount >= (currentTask.minWords || 0) ? TG.green : TG.textHint} />
            <Text style={[
              styles.wordCountText,
              wordCount >= (currentTask.minWords || 0) ? { color: TG.green } : {},
            ]}>
              {wordCount} words
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.submitBtn, (submitting || !essayText.trim()) && { opacity: 0.5 }]}
            activeOpacity={0.7}
            onPress={handleSubmit}
            disabled={submitting || !essayText.trim()}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Send size={16} color="#fff" />
                <Text style={styles.submitBtnText}>
                  {currentTaskIndex < tasks.length - 1 ? 'Submit & Next' : 'Submit'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: TG.bgSecondary },
  timerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  timerText: { fontSize: 14, fontWeight: '700' },
  taskNav: {
    flexDirection: 'row', backgroundColor: TG.bg, gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 0.5, borderBottomColor: TG.separator,
  },
  taskPill: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 12, backgroundColor: TG.bgSecondary,
    borderWidth: 1, borderColor: TG.separator,
  },
  taskPillActive: { backgroundColor: TG.accentLight, borderColor: TG.accent },
  taskPillDone: { backgroundColor: TG.greenLight, borderColor: TG.green },
  taskPillText: { fontSize: 12, fontWeight: '600', color: TG.textSecondary },
  taskPillTextActive: { color: TG.accent },
  content: { padding: 16, paddingBottom: 20 },
  promptCard: {
    backgroundColor: TG.bg, borderRadius: 14, padding: 16,
    marginBottom: 16,
    borderWidth: 1, borderColor: TG.separator,
  },
  promptHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10,
  },
  partBadge: {
    backgroundColor: TG.accentLight, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8,
  },
  partBadgeText: { fontSize: 12, fontWeight: '700', color: TG.accent },
  wordRange: { fontSize: 12, color: TG.textHint },
  promptText: { fontSize: 15, color: TG.textPrimary, lineHeight: 22 },
  essayContainer: {
    backgroundColor: TG.bg, borderRadius: 14,
    borderWidth: 1, borderColor: TG.separator,
    minHeight: 300,
  },
  essayInput: {
    padding: 16, fontSize: 16, color: TG.textPrimary,
    lineHeight: 24, minHeight: 300,
  },
  bottomBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: TG.bg,
    borderTopWidth: 1, borderTopColor: TG.separator,
  },
  wordCountRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  wordCountText: { fontSize: 14, fontWeight: '600', color: TG.textHint },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: TG.accent, paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 14,
  },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
