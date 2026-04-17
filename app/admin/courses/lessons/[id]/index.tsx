import { useAlert } from '@/components/CustomAlert';
import { useToast } from '@/components/Toast';
import WaveformPlayer from '@/components/WaveformPlayer';
import { TG } from '@/constants/theme';
import { apiCreateExercise, apiDeleteExercise, apiFetchLesson, apiTextToSpeech, apiUpdateExercise, TTSVoice } from '@/lib/api';
import type { Exercise, ExerciseType, LessonDetail } from '@/lib/types';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronRight,
  Copy,
  Eye,
  Filter,
  Layers,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Volume2,
  X,
  Zap,
} from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ─── Exercise type metadata ────────────────────────────────────

const EXERCISE_TYPE_GROUPS = [
  {
    label: 'Listen',
    color: '#6C5CE7',
    types: [
      { key: 'listenRepeat' as ExerciseType, icon: '🎧', label: 'Listen & Repeat', desc: 'Student listens and repeats' },
      { key: 'listenAndChoose' as ExerciseType, icon: '👂', label: 'Listen & Choose', desc: 'Listen then pick correct answer' },
      { key: 'tapWhatYouHear' as ExerciseType, icon: '🔊', label: 'Tap What You Hear', desc: 'Tap the correct transcription' },
    ],
  },
  {
    label: 'Speak',
    color: '#E17055',
    types: [
      { key: 'speakTheAnswer' as ExerciseType, icon: '🎤', label: 'Speak the Answer', desc: 'Answer by speaking aloud' },
      { key: 'pronunciation' as ExerciseType, icon: '🗣️', label: 'Pronunciation', desc: 'Practice correct pronunciation' },
      { key: 'roleplay' as ExerciseType, icon: '🎭', label: 'Roleplay', desc: 'Act out a spoken conversation' },
    ],
  },
  {
    label: 'Read / Write',
    color: '#00B894',
    types: [
      { key: 'multipleChoice' as ExerciseType, icon: '📋', label: 'Multiple Choice', desc: 'Pick one correct option' },
      { key: 'fillInBlank' as ExerciseType, icon: '✏️', label: 'Fill in the Blank', desc: 'Complete the sentence' },
      { key: 'reorderWords' as ExerciseType, icon: '🔀', label: 'Reorder Words', desc: 'Arrange words in order' },
      { key: 'translateSentence' as ExerciseType, icon: '🌐', label: 'Translate Sentence', desc: 'Translate using word bank' },
    ],
  },
  {
    label: 'Interactive',
    color: '#FDCB6E',
    types: [
      { key: 'matchPairs' as ExerciseType, icon: '🔗', label: 'Match Pairs', desc: 'Match items together' },
      { key: 'completeConversation' as ExerciseType, icon: '💬', label: 'Complete Conversation', desc: 'Fill dialogue gaps' },
    ],
  },
];

const ALL_TYPES = EXERCISE_TYPE_GROUPS.flatMap((g) => g.types);

function getTypeLabel(type: ExerciseType) {
  return ALL_TYPES.find((t) => t.key === type)?.label || type;
}
function getTypeIcon(type: ExerciseType) {
  return ALL_TYPES.find((t) => t.key === type)?.icon || '📝';
}
function getTypeGroupColor(type: ExerciseType) {
  for (const g of EXERCISE_TYPE_GROUPS) {
    if (g.types.some((t) => t.key === type)) return g.color;
  }
  return TG.accent;
}

const DIFFICULTY_OPTIONS = [
  { value: 1, label: 'Easy', color: TG.scoreGreen, emoji: '🟢' },
  { value: 2, label: 'Medium', color: TG.scoreOrange, emoji: '🟠' },
  { value: 3, label: 'Hard', color: TG.scoreRed, emoji: '🔴' },
];

const VOICES: TTSVoice[] = ['erin', 'george', 'lisa', 'emily', 'nick'];

// Exercise types that require audio
const AUDIO_TYPES: ExerciseType[] = ['listenRepeat', 'listenAndChoose', 'tapWhatYouHear', 'pronunciation', 'speakTheAnswer'];

// ─── Quick Templates ───────────────────────────────────────────

interface QuickTemplate {
  label: string;
  icon: string;
  desc: string;
  form: Partial<FormState>;
}

const QUICK_TEMPLATES: QuickTemplate[] = [
  {
    label: 'Vocabulary MCQ',
    icon: '📖',
    desc: '4-option vocabulary question',
    form: {
      type: 'multipleChoice' as ExerciseType,
      prompt: 'What does "___" mean?',
      options: [
        { text: '', isCorrect: true, imageUrl: '' },
        { text: '', isCorrect: false, imageUrl: '' },
        { text: '', isCorrect: false, imageUrl: '' },
        { text: '', isCorrect: false, imageUrl: '' },
      ],
      difficulty: 1,
      xpReward: 10,
    },
  },
  {
    label: 'Grammar Fill-in',
    icon: '✏️',
    desc: 'Complete the sentence',
    form: {
      type: 'fillInBlank' as ExerciseType,
      prompt: 'Complete the sentence:',
      sentenceTemplate: 'I ___ to the store yesterday.',
      correctAnswer: 'went',
      difficulty: 2,
      xpReward: 15,
    },
  },
  {
    label: 'Word Order',
    icon: '🔀',
    desc: 'Arrange scrambled words',
    form: {
      type: 'reorderWords' as ExerciseType,
      prompt: 'Put the words in the correct order:',
      wordBankSentence: '',
      distractors: [],
      difficulty: 2,
      xpReward: 15,
    },
  },
  {
    label: 'Listening Quiz',
    icon: '🎧',
    desc: 'Listen and pick answer',
    form: {
      type: 'listenAndChoose' as ExerciseType,
      prompt: 'Listen and choose the correct answer:',
      options: [
        { text: '', isCorrect: true, imageUrl: '' },
        { text: '', isCorrect: false, imageUrl: '' },
        { text: '', isCorrect: false, imageUrl: '' },
      ],
      difficulty: 1,
      xpReward: 10,
    },
  },
  {
    label: 'Translation',
    icon: '🌐',
    desc: 'Translate with word bank',
    form: {
      type: 'translateSentence' as ExerciseType,
      prompt: 'Translate this sentence:',
      wordBankSentence: '',
      distractors: [],
      difficulty: 2,
      xpReward: 20,
    },
  },
  {
    label: 'Dialogue',
    icon: '💬',
    desc: 'Complete a conversation',
    form: {
      type: 'completeConversation' as ExerciseType,
      prompt: 'Complete the conversation:',
      conversationLines: [
        { speaker: 'Bot', text: '', isUserTurn: false, acceptedAnswers: '' },
        { speaker: 'You', text: '', isUserTurn: true, acceptedAnswers: '' },
        { speaker: 'Bot', text: '', isUserTurn: false, acceptedAnswers: '' },
      ],
      difficulty: 2,
      xpReward: 20,
    },
  },
];

// ─── Form types ────────────────────────────────────────────────

interface OptionForm { text: string; isCorrect: boolean; imageUrl: string; }
interface PairForm { leftText: string; rightText: string; }
interface ConvoLineForm { speaker: string; text: string; isUserTurn: boolean; acceptedAnswers: string; }

function getDefaultFormState() {
  return {
    type: 'multipleChoice' as ExerciseType,
    prompt: '',
    correctAnswer: '',
    sentenceTemplate: '',
    targetText: '',
    audioUrl: '',
    imageUrl: '',
    explanation: '',
    difficulty: 1,
    xpReward: 10,
    hints: [] as string[],
    options: [{ text: '', isCorrect: true, imageUrl: '' }, { text: '', isCorrect: false, imageUrl: '' }] as OptionForm[],
    matchPairs: [{ leftText: '', rightText: '' }, { leftText: '', rightText: '' }] as PairForm[],
    wordBankSentence: '',
    distractors: [] as string[],
    conversationLines: [{ speaker: 'Bot', text: '', isUserTurn: false, acceptedAnswers: '' }] as ConvoLineForm[],
  };
}

type FormState = ReturnType<typeof getDefaultFormState>;

// ─── Wizard Steps ──────────────────────────────────────────────

type WizardStep = 'type' | 'content' | 'settings';
const WIZARD_STEPS: { key: WizardStep; label: string; icon: string }[] = [
  { key: 'type', label: 'Type', icon: '1' },
  { key: 'content', label: 'Content', icon: '2' },
  { key: 'settings', label: 'Settings', icon: '3' },
];

// ─── Component ─────────────────────────────────────────────────

export default function LessonBuilderScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const toast = useToast();
  const { alert } = useAlert();

  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [editExerciseId, setEditExerciseId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(getDefaultFormState());
  const [wizardStep, setWizardStep] = useState<WizardStep>('type');

  // Preview modal
  const [previewExercise, setPreviewExercise] = useState<Exercise | null>(null);

  // Audio generation
  const [voice, setVoice] = useState<TTSVoice>('erin');
  const [generating, setGenerating] = useState(false);

  // Filter / Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<ExerciseType | null>(null);
  const [filterDifficulty, setFilterDifficulty] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Bulk selection
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Templates
  const [showTemplates, setShowTemplates] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetchLesson(String(id));
      setLesson(data);
    } catch (e: any) {
      toast.error('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ─── Derived data ──────────────────────────────────────────

  const exercises = useMemo(() => {
    if (!lesson?.exercises) return [];
    let list = [...lesson.exercises].sort((a, b) => a.order - b.order);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((e) =>
        e.prompt.toLowerCase().includes(q) ||
        (e.correctAnswer && e.correctAnswer.toLowerCase().includes(q)) ||
        getTypeLabel(e.type).toLowerCase().includes(q)
      );
    }
    if (filterType) list = list.filter((e) => e.type === filterType);
    if (filterDifficulty) list = list.filter((e) => (e.difficulty || 1) === filterDifficulty);

    return list;
  }, [lesson, searchQuery, filterType, filterDifficulty]);

  const stats = useMemo(() => {
    if (!lesson?.exercises?.length) return null;
    const all = lesson.exercises;
    const typeCount: Record<string, number> = {};
    const diffCount = [0, 0, 0];
    let totalXp = 0;
    for (const e of all) {
      typeCount[e.type] = (typeCount[e.type] || 0) + 1;
      diffCount[(e.difficulty || 1) - 1]++;
      totalXp += e.xpReward || 10;
    }
    return { total: all.length, typeCount, diffCount, totalXp };
  }, [lesson]);

  const activeFilterCount = [filterType, filterDifficulty, searchQuery.trim()].filter(Boolean).length;

  // ─── Form helpers ──────────────────────────────────────────

  const updateForm = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }));

  const openAddExercise = () => {
    setEditExerciseId(null);
    setForm(getDefaultFormState());
    setWizardStep('type');
    setModalVisible(true);
  };

  const openFromTemplate = (tpl: QuickTemplate) => {
    setEditExerciseId(null);
    const f = { ...getDefaultFormState(), ...tpl.form };
    setForm(f as FormState);
    setWizardStep('content');
    setShowTemplates(false);
    setModalVisible(true);
  };

  const openEditExercise = (ex: Exercise) => {
    setEditExerciseId(ex.id);
    const f = getDefaultFormState();
    f.type = ex.type;
    f.prompt = ex.prompt;
    f.correctAnswer = ex.correctAnswer || '';
    f.sentenceTemplate = ex.sentenceTemplate || '';
    f.targetText = ex.targetText || '';
    f.audioUrl = ex.audioUrl || '';
    f.imageUrl = ex.imageUrl || '';
    f.explanation = ex.explanation || '';
    f.difficulty = ex.difficulty || 1;
    f.xpReward = ex.xpReward || 10;
    f.hints = ex.hints || [];

    if (ex.options?.length) {
      f.options = ex.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect, imageUrl: o.imageUrl || '' }));
    }
    if (ex.matchPairs?.length) {
      f.matchPairs = ex.matchPairs.map((p) => ({ leftText: p.leftText, rightText: p.rightText }));
    }
    if (ex.wordBankItems?.length) {
      const words = ex.wordBankItems.filter((w) => !w.isDistractor).sort((a, b) => a.correctPosition - b.correctPosition);
      f.wordBankSentence = words.map((w) => w.text).join(' ');
      f.distractors = ex.wordBankItems.filter((w) => w.isDistractor).map((w) => w.text);
    }
    if (ex.conversationLines?.length) {
      f.conversationLines = ex.conversationLines.map((l) => ({
        speaker: l.speaker,
        text: l.text,
        isUserTurn: l.isUserTurn,
        acceptedAnswers: l.acceptedAnswers?.join(', ') || '',
      }));
    }
    setForm(f);
    setWizardStep('content');
    setModalVisible(true);
  };

  const duplicateExercise = (ex: Exercise) => {
    openEditExercise(ex);
    setEditExerciseId(null);
  };

  const handleDelete = (exercise: Exercise) => {
    alert('Delete Exercise', `Delete "${exercise.prompt.slice(0, 50)}..."?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { await apiDeleteExercise(exercise.id); load(); toast.success('Deleted', 'Exercise removed'); }
          catch (e: any) { toast.error('Error', e.message); }
        },
      },
    ], 'destructive');
  };

  // ─── Reorder ──────────────────────────────────────────────

  const handleReorder = async (exercise: Exercise, direction: 'up' | 'down') => {
    if (!lesson?.exercises) return;
    const sorted = [...lesson.exercises].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((e) => e.id === exercise.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    try {
      await Promise.all([
        apiUpdateExercise(sorted[idx].id, { order: sorted[swapIdx].order }),
        apiUpdateExercise(sorted[swapIdx].id, { order: sorted[idx].order }),
      ]);
      load();
    } catch (e: any) {
      toast.error('Error', e.message);
    }
  };

  // ─── Bulk operations ─────────────────────────────────────

  const toggleSelection = (exerciseId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(exerciseId)) next.delete(exerciseId);
      else next.add(exerciseId);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === exercises.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(exercises.map((e) => e.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    alert('Delete Selected', `Delete ${selectedIds.size} exercise${selectedIds.size > 1 ? 's' : ''}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete All', style: 'destructive',
        onPress: async () => {
          try {
            await Promise.all([...selectedIds].map((eid) => apiDeleteExercise(eid)));
            setSelectedIds(new Set());
            setSelectionMode(false);
            load();
            toast.success('Done', `${selectedIds.size} exercises deleted`);
          } catch (e: any) { toast.error('Error', e.message); }
        },
      },
    ], 'destructive');
  };

  // ─── Build payload ────────────────────────────────────────

  const buildPayload = () => {
    const base: Record<string, any> = {
      type: form.type,
      prompt: form.prompt.trim(),
      difficulty: form.difficulty,
      xpReward: form.xpReward,
      explanation: form.explanation.trim() || null,
      hints: form.hints.filter(Boolean).length ? form.hints.filter(Boolean) : null,
      audioUrl: form.audioUrl.trim() || null,
      imageUrl: form.imageUrl.trim() || null,
      correctAnswer: form.correctAnswer.trim() || null,
      sentenceTemplate: form.sentenceTemplate.trim() || null,
      targetText: form.targetText.trim() || null,
    };

    const t = form.type;

    if (['multipleChoice', 'listenAndChoose', 'tapWhatYouHear'].includes(t) ||
        (t === 'fillInBlank' && form.options.some((o) => o.text.trim()))) {
      base.options = form.options.filter((o) => o.text.trim()).map((o, i) => ({
        text: o.text.trim(),
        isCorrect: o.isCorrect,
        imageUrl: o.imageUrl.trim() || null,
        order: i,
      }));
    }

    if (t === 'matchPairs') {
      base.matchPairs = form.matchPairs.filter((p) => p.leftText.trim() && p.rightText.trim()).map((p, i) => ({
        leftText: p.leftText.trim(),
        rightText: p.rightText.trim(),
        order: i,
      }));
    }

    if (t === 'reorderWords' || t === 'translateSentence') {
      const words = form.wordBankSentence.trim().split(/\s+/).filter(Boolean);
      const items = words.map((w, i) => ({ text: w, correctPosition: i, isDistractor: false }));
      const dists = form.distractors.filter(Boolean).map((w) => ({ text: w.trim(), correctPosition: -1, isDistractor: true }));
      base.wordBankItems = [...items, ...dists];
      base.correctAnswer = words.join(' ');
    }

    if (t === 'completeConversation' || t === 'roleplay') {
      base.conversationLines = form.conversationLines.filter((l) => l.text.trim() || l.isUserTurn).map((l, i) => ({
        speaker: l.speaker.trim() || (l.isUserTurn ? 'You' : 'Bot'),
        text: l.text.trim(),
        isUserTurn: l.isUserTurn,
        acceptedAnswers: l.isUserTurn && l.acceptedAnswers.trim()
          ? l.acceptedAnswers.split(',').map((a) => a.trim()).filter(Boolean)
          : null,
        order: i,
      }));
    }

    return base;
  };

  const handleSave = async () => {
    if (!form.prompt.trim() || !lesson) return;
    setSubmitting(true);
    try {
      const payload = buildPayload();
      if (editExerciseId) {
        await apiUpdateExercise(editExerciseId, payload);
        toast.success('Done', 'Exercise updated');
      } else {
        await apiCreateExercise({ lessonId: lesson.id, ...payload } as any);
        toast.success('Done', 'Exercise added');
      }
      setModalVisible(false);
      load();
    } catch (e: any) {
      toast.error('Error', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Validation ──────────────────────────────────────────

  const getValidationErrors = (): string[] => {
    const errors: string[] = [];
    if (!form.prompt.trim()) errors.push('Prompt is required');
    const t = form.type;

    if (['multipleChoice', 'listenAndChoose', 'tapWhatYouHear'].includes(t)) {
      const opts = form.options.filter((o) => o.text.trim());
      if (opts.length < 2) errors.push('At least 2 options required');
      if (opts.filter((o) => o.isCorrect).length !== 1) errors.push('Exactly 1 correct option needed');
    }
    if (t === 'fillInBlank' && form.sentenceTemplate && !form.sentenceTemplate.includes('___'))
      errors.push('Template must contain ___');
    if (t === 'matchPairs') {
      if (form.matchPairs.filter((p) => p.leftText.trim() && p.rightText.trim()).length < 2)
        errors.push('At least 2 complete pairs required');
    }
    if ((t === 'reorderWords' || t === 'translateSentence') && form.wordBankSentence.trim().split(/\s+/).length < 3)
      errors.push('Sentence needs at least 3 words');
    if (t === 'completeConversation' && !form.conversationLines.some((l) => l.isUserTurn))
      errors.push('At least 1 user turn required');

    return errors;
  };

  const isFormValid = () => getValidationErrors().length === 0;

  // ─── Option helpers ──────────────────────────────────────

  const addOption = () => updateForm({ options: [...form.options, { text: '', isCorrect: false, imageUrl: '' }] });
  const removeOption = (i: number) => updateForm({ options: form.options.filter((_, idx) => idx !== i) });
  const updateOption = (i: number, patch: Partial<OptionForm>) => {
    const next = [...form.options];
    next[i] = { ...next[i], ...patch };
    if (patch.isCorrect) {
      next.forEach((o, idx) => { if (idx !== i) o.isCorrect = false; });
    }
    updateForm({ options: next });
  };

  const addPair = () => updateForm({ matchPairs: [...form.matchPairs, { leftText: '', rightText: '' }] });
  const removePair = (i: number) => updateForm({ matchPairs: form.matchPairs.filter((_, idx) => idx !== i) });
  const updatePair = (i: number, patch: Partial<PairForm>) => {
    const next = [...form.matchPairs]; next[i] = { ...next[i], ...patch }; updateForm({ matchPairs: next });
  };

  const addDistractor = () => updateForm({ distractors: [...form.distractors, ''] });
  const updateDistractor = (i: number, val: string) => {
    const next = [...form.distractors]; next[i] = val; updateForm({ distractors: next });
  };
  const removeDistractor = (i: number) => updateForm({ distractors: form.distractors.filter((_, idx) => idx !== i) });

  const addConvoLine = () => updateForm({
    conversationLines: [...form.conversationLines, { speaker: 'Bot', text: '', isUserTurn: false, acceptedAnswers: '' }],
  });
  const removeConvoLine = (i: number) => updateForm({ conversationLines: form.conversationLines.filter((_, idx) => idx !== i) });
  const updateConvoLine = (i: number, patch: Partial<ConvoLineForm>) => {
    const next = [...form.conversationLines]; next[i] = { ...next[i], ...patch }; updateForm({ conversationLines: next });
  };

  const addHint = () => updateForm({ hints: [...form.hints, ''] });
  const updateHint = (i: number, val: string) => { const next = [...form.hints]; next[i] = val; updateForm({ hints: next }); };
  const removeHint = (i: number) => updateForm({ hints: form.hints.filter((_, idx) => idx !== i) });

  // ─── Render: Loading / Error ─────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={[s.safeArea, s.centered]}>
        <ActivityIndicator size="large" color={TG.accent} />
        <Text style={s.loadingText}>Loading lesson...</Text>
      </SafeAreaView>
    );
  }

  if (!lesson) {
    return (
      <SafeAreaView style={[s.safeArea, s.centered]}>
        <Text style={{ fontSize: 48, marginBottom: 12 }}>📭</Text>
        <Text style={s.errorText}>Lesson not found</Text>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const allExercises = [...(lesson.exercises || [])].sort((a, b) => a.order - b.order);

  // ─── Render: Stats Dashboard ─────────────────────────────

  const renderStatsDashboard = () => {
    if (!stats || stats.total === 0) return null;

    const topTypes = Object.entries(stats.typeCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 4);

    return (
      <View style={s.statsCard}>
        <View style={s.statsRow}>
          <View style={s.statItem}>
            <Text style={s.statNumber}>{stats.total}</Text>
            <Text style={s.statLabel}>Exercises</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={[s.statNumber, { color: TG.gold }]}>{stats.totalXp}</Text>
            <Text style={s.statLabel}>Total XP</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={s.statNumber}>{Object.keys(stats.typeCount).length}</Text>
            <Text style={s.statLabel}>Types</Text>
          </View>
        </View>

        {/* Difficulty bar */}
        <View style={s.diffBar}>
          {stats.diffCount.map((count, i) => {
            if (count === 0) return null;
            const pct = (count / stats.total) * 100;
            return (
              <View
                key={i}
                style={[s.diffBarSegment, {
                  width: `${pct}%` as any,
                  backgroundColor: DIFFICULTY_OPTIONS[i].color,
                  borderTopLeftRadius: i === 0 || stats.diffCount.slice(0, i).every((c) => c === 0) ? 6 : 0,
                  borderBottomLeftRadius: i === 0 || stats.diffCount.slice(0, i).every((c) => c === 0) ? 6 : 0,
                  borderTopRightRadius: i === 2 || stats.diffCount.slice(i + 1).every((c) => c === 0) ? 6 : 0,
                  borderBottomRightRadius: i === 2 || stats.diffCount.slice(i + 1).every((c) => c === 0) ? 6 : 0,
                }]}
              />
            );
          })}
        </View>
        <View style={s.diffLegend}>
          {DIFFICULTY_OPTIONS.map((d, i) => (
            stats.diffCount[i] > 0 ? (
              <View key={d.value} style={s.diffLegendItem}>
                <View style={[s.diffLegendDot, { backgroundColor: d.color }]} />
                <Text style={s.diffLegendText}>{d.label} ({stats.diffCount[i]})</Text>
              </View>
            ) : null
          ))}
        </View>

        {/* Type chips */}
        <View style={s.typeChipsRow}>
          {topTypes.map(([type, count]) => (
            <View key={type} style={[s.typeChip, { borderColor: getTypeGroupColor(type as ExerciseType) + '40' }]}>
              <Text style={s.typeChipIcon}>{getTypeIcon(type as ExerciseType)}</Text>
              <Text style={s.typeChipText}>{count}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // ─── Render: Filter Bar ──────────────────────────────────

  const renderFilterBar = () => (
    <View style={s.filterContainer}>
      <View style={s.searchRow}>
        <View style={s.searchBox}>
          <Search size={16} color={TG.textHint} />
          <TextInput
            style={s.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search exercises..."
            placeholderTextColor={TG.textHint}
          />
          {searchQuery.trim() !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={16} color={TG.textHint} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[s.filterBtn, activeFilterCount > 0 && s.filterBtnActive]}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Filter size={16} color={activeFilterCount > 0 ? TG.accent : TG.textSecondary} />
          {activeFilterCount > 0 && (
            <View style={s.filterBadge}>
              <Text style={s.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.filterBtn, selectionMode && s.filterBtnActive]}
          onPress={() => { setSelectionMode(!selectionMode); setSelectedIds(new Set()); }}
        >
          <Layers size={16} color={selectionMode ? TG.accent : TG.textSecondary} />
        </TouchableOpacity>
      </View>

      {showFilters && (
        <View style={s.filterChipsContainer}>
          <Text style={s.filterSectionLabel}>Type</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterChipsScroll}>
            <TouchableOpacity
              style={[s.filterChip, !filterType && s.filterChipActive]}
              onPress={() => setFilterType(null)}
            >
              <Text style={[s.filterChipText, !filterType && s.filterChipTextActive]}>All</Text>
            </TouchableOpacity>
            {ALL_TYPES.map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[s.filterChip, filterType === t.key && s.filterChipActive]}
                onPress={() => setFilterType(filterType === t.key ? null : t.key)}
              >
                <Text style={s.filterChipEmoji}>{t.icon}</Text>
                <Text style={[s.filterChipText, filterType === t.key && s.filterChipTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[s.filterSectionLabel, { marginTop: 10 }]}>Difficulty</Text>
          <View style={s.filterChipsRow}>
            <TouchableOpacity
              style={[s.filterChip, !filterDifficulty && s.filterChipActive]}
              onPress={() => setFilterDifficulty(null)}
            >
              <Text style={[s.filterChipText, !filterDifficulty && s.filterChipTextActive]}>All</Text>
            </TouchableOpacity>
            {DIFFICULTY_OPTIONS.map((d) => (
              <TouchableOpacity
                key={d.value}
                style={[s.filterChip, filterDifficulty === d.value && { backgroundColor: d.color + '18', borderColor: d.color }]}
                onPress={() => setFilterDifficulty(filterDifficulty === d.value ? null : d.value)}
              >
                <Text style={s.filterChipEmoji}>{d.emoji}</Text>
                <Text style={[s.filterChipText, filterDifficulty === d.value && { color: d.color, fontWeight: '700' }]}>{d.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {(filterType || filterDifficulty) && (
            <TouchableOpacity
              style={s.clearFiltersBtn}
              onPress={() => { setFilterType(null); setFilterDifficulty(null); setSearchQuery(''); }}
            >
              <X size={14} color={TG.red} />
              <Text style={s.clearFiltersText}>Clear Filters</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {selectionMode && (
        <View style={s.bulkBar}>
          <TouchableOpacity style={s.bulkSelectAll} onPress={selectAll}>
            <View style={[s.checkbox, selectedIds.size === exercises.length && exercises.length > 0 && s.checkboxActive]}>
              {selectedIds.size === exercises.length && exercises.length > 0 && <Check size={12} color="#fff" />}
            </View>
            <Text style={s.bulkText}>
              {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}
            </Text>
          </TouchableOpacity>
          {selectedIds.size > 0 && (
            <TouchableOpacity style={s.bulkDeleteBtn} onPress={handleBulkDelete}>
              <Trash2 size={16} color="#fff" />
              <Text style={s.bulkDeleteText}>Delete</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );

  // ─── Render: Exercise Card ───────────────────────────────

  const renderExerciseCard = ({ item }: { item: Exercise; index: number }) => {
    const groupColor = getTypeGroupColor(item.type);
    const diffOpt = DIFFICULTY_OPTIONS[(item.difficulty || 1) - 1];
    const isSelected = selectedIds.has(item.id);
    const globalIndex = allExercises.findIndex((e) => e.id === item.id);
    const isFirst = globalIndex === 0;
    const isLast = globalIndex === allExercises.length - 1;

    return (
      <Pressable
        style={[s.exCard, isSelected && s.exCardSelected, { borderLeftColor: groupColor }]}
        onPress={() => selectionMode ? toggleSelection(item.id) : openEditExercise(item)}
        onLongPress={() => {
          if (!selectionMode) {
            setSelectionMode(true);
            setSelectedIds(new Set([item.id]));
          }
        }}
      >
        {selectionMode && (
          <View style={s.exCheckboxCol}>
            <View style={[s.checkbox, isSelected && s.checkboxActive]}>
              {isSelected && <Check size={12} color="#fff" />}
            </View>
          </View>
        )}

        <View style={s.exCardBody}>
          <View style={s.exHeader}>
            <View style={s.exHeaderLeft}>
              <View style={[s.exOrderBadge, { backgroundColor: groupColor + '15' }]}>
                <Text style={[s.exOrderText, { color: groupColor }]}>#{globalIndex + 1}</Text>
              </View>
              <View style={[s.exTypeBadge, { backgroundColor: groupColor + '12' }]}>
                <Text style={s.exTypeIcon}>{getTypeIcon(item.type)}</Text>
                <Text style={[s.exTypeText, { color: groupColor }]}>{getTypeLabel(item.type)}</Text>
              </View>
            </View>
            {!selectionMode && (
              <View style={s.exActions}>
                <TouchableOpacity
                  onPress={() => handleReorder(item, 'up')}
                  disabled={isFirst}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={[s.reorderBtn, isFirst && s.reorderBtnDisabled]}
                >
                  <ArrowUp size={14} color={isFirst ? TG.separator : TG.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleReorder(item, 'down')}
                  disabled={isLast}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={[s.reorderBtn, isLast && s.reorderBtnDisabled]}
                >
                  <ArrowDown size={14} color={isLast ? TG.separator : TG.textSecondary} />
                </TouchableOpacity>
                <View style={s.exActionDivider} />
                <TouchableOpacity onPress={() => duplicateExercise(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Copy size={15} color={TG.textHint} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setPreviewExercise(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Eye size={15} color={TG.textHint} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Trash2 size={15} color={TG.red} />
                </TouchableOpacity>
              </View>
            )}
          </View>

          <Text style={s.exPrompt} numberOfLines={2}>{item.prompt}</Text>

          {renderExercisePreview(item)}

          <View style={s.exFooter}>
            <View style={[s.diffBadge, { backgroundColor: diffOpt.color + '15' }]}>
              <Text style={[s.diffText, { color: diffOpt.color }]}>{diffOpt.emoji} {diffOpt.label}</Text>
            </View>
            <View style={s.xpBadge}>
              <Zap size={12} color={TG.gold} />
              <Text style={s.xpLabel}>{item.xpReward || 10} XP</Text>
            </View>
            {item.hints && item.hints.length > 0 && (
              <View style={s.hintBadge}>
                <Text style={s.hintBadgeText}>💡 {item.hints.length}</Text>
              </View>
            )}
            {item.explanation && (
              <View style={s.hintBadge}>
                <Text style={s.hintBadgeText}>📝</Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  // ─── Render: Exercise Preview Content ────────────────────

  const renderExercisePreview = (item: Exercise) => {
    if (item.options && item.options.length > 0) {
      return (
        <View style={s.previewContainer}>
          {item.options.slice(0, 4).map((opt, i) => (
            <View key={opt.id || i} style={[s.previewOption, opt.isCorrect && s.previewOptionCorrect]}>
              {opt.isCorrect && <Check size={12} color={TG.green} style={{ marginRight: 4 }} />}
              <Text style={[s.previewOptionText, opt.isCorrect && s.previewOptionTextCorrect]} numberOfLines={1}>
                {opt.text}
              </Text>
            </View>
          ))}
          {item.options.length > 4 && (
            <Text style={s.previewMore}>+{item.options.length - 4} more</Text>
          )}
        </View>
      );
    }

    if (item.matchPairs && item.matchPairs.length > 0) {
      return (
        <View style={s.previewContainer}>
          {item.matchPairs.slice(0, 3).map((pair, i) => (
            <View key={pair.id || i} style={s.previewPairRow}>
              <View style={s.previewPairItem}><Text style={s.previewPairText} numberOfLines={1}>{pair.leftText}</Text></View>
              <Text style={s.previewPairArrow}>→</Text>
              <View style={s.previewPairItem}><Text style={s.previewPairText} numberOfLines={1}>{pair.rightText}</Text></View>
            </View>
          ))}
        </View>
      );
    }

    if (item.wordBankItems && item.wordBankItems.length > 0) {
      const words = [...item.wordBankItems].sort((a, b) => {
        if (a.isDistractor && !b.isDistractor) return 1;
        if (!a.isDistractor && b.isDistractor) return -1;
        return a.correctPosition - b.correctPosition;
      });
      return (
        <View style={s.previewWordBank}>
          {words.slice(0, 6).map((w, i) => (
            <View key={w.id || i} style={[s.previewWordChip, w.isDistractor && s.previewWordChipDistractor]}>
              <Text style={[s.previewWordText, w.isDistractor && s.previewWordTextDistractor]}>{w.text}</Text>
            </View>
          ))}
          {words.length > 6 && <Text style={s.previewMore}>+{words.length - 6}</Text>}
        </View>
      );
    }

    if (item.conversationLines && item.conversationLines.length > 0) {
      return (
        <View style={s.previewContainer}>
          {item.conversationLines.slice(0, 3).map((line, i) => (
            <View key={line.id || i} style={[s.previewConvoLine, line.isUserTurn && s.previewConvoLineUser]}>
              <Text style={s.previewConvoSpeaker}>{line.speaker}:</Text>
              <Text style={s.previewConvoText} numberOfLines={1}>
                {line.isUserTurn && !line.text ? '[ student responds ]' : line.text}
              </Text>
            </View>
          ))}
          {item.conversationLines.length > 3 && <Text style={s.previewMore}>+{item.conversationLines.length - 3} more lines</Text>}
        </View>
      );
    }

    if (item.correctAnswer) {
      return (
        <View style={s.previewAnswerRow}>
          <Check size={14} color={TG.green} />
          <Text style={s.previewAnswerText}>{item.correctAnswer}</Text>
        </View>
      );
    }

    if (item.targetText) {
      return (
        <View style={s.previewAnswerRow}>
          <Text style={s.previewAnswerText}>🎯 {item.targetText}</Text>
        </View>
      );
    }

    return null;
  };

  // ─── Render: Wizard Step Content ─────────────────────────

  const renderWizardStepContent = () => {
    switch (wizardStep) {
      case 'type':
        return renderStepType();
      case 'content':
        return renderStepContent();
      case 'settings':
        return renderStepSettings();
    }
  };

  const renderStepType = () => (
    <>
      <Text style={s.stepTitle}>Choose Exercise Type</Text>
      <Text style={s.stepDesc}>Select what kind of exercise you want to create</Text>

      {EXERCISE_TYPE_GROUPS.map((group) => (
        <View key={group.label} style={s.typeGroupSection}>
          <View style={[s.typeGroupHeader, { borderLeftColor: group.color }]}>
            <Text style={[s.typeGroupLabel, { color: group.color }]}>{group.label}</Text>
          </View>
          {group.types.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[s.typeSelectCard, form.type === t.key && { backgroundColor: group.color + '10', borderColor: group.color }]}
              onPress={() => updateForm({ type: t.key })}
            >
              <Text style={s.typeSelectIcon}>{t.icon}</Text>
              <View style={s.typeSelectInfo}>
                <Text style={[s.typeSelectLabel, form.type === t.key && { color: group.color, fontWeight: '800' }]}>
                  {t.label}
                </Text>
                <Text style={s.typeSelectDesc}>{t.desc}</Text>
              </View>
              {form.type === t.key && (
                <View style={[s.typeSelectCheck, { backgroundColor: group.color }]}>
                  <Check size={14} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </>
  );

  const renderStepContent = () => {
    const t = form.type;
    const groupColor = getTypeGroupColor(t);

    return (
      <>
        <View style={s.stepTypeIndicator}>
          <Text style={s.stepTypeIcon}>{getTypeIcon(t)}</Text>
          <Text style={[s.stepTypeLabel, { color: groupColor }]}>{getTypeLabel(t)}</Text>
          <TouchableOpacity onPress={() => setWizardStep('type')} style={s.changeTypeBtn}>
            <Text style={s.changeTypeText}>Change</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.label}>Prompt <Text style={s.required}>*</Text></Text>
        <TextInput
          style={[s.input, s.inputMulti]}
          value={form.prompt}
          onChangeText={(v) => updateForm({ prompt: v })}
          placeholder="e.g. What does 'ubiquitous' mean?"
          placeholderTextColor={TG.textHint}
          multiline
          textAlignVertical="top"
        />

        {renderTypeSpecificFields()}
      </>
    );
  };

  const renderStepSettings = () => (
    <>
      <Text style={s.stepTitle}>Exercise Settings</Text>
      <Text style={s.stepDesc}>Fine-tune difficulty, rewards, and help options</Text>

      <Text style={s.label}>Difficulty Level</Text>
      <View style={s.diffRow}>
        {DIFFICULTY_OPTIONS.map((d) => (
          <TouchableOpacity
            key={d.value}
            style={[s.diffCard, form.difficulty === d.value && { backgroundColor: d.color + '15', borderColor: d.color }]}
            onPress={() => updateForm({ difficulty: d.value })}
          >
            <Text style={s.diffCardEmoji}>{d.emoji}</Text>
            <Text style={[s.diffCardText, form.difficulty === d.value && { color: d.color, fontWeight: '800' }]}>{d.label}</Text>
            {form.difficulty === d.value && (
              <View style={[s.diffCardCheck, { backgroundColor: d.color }]}>
                <Check size={10} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.label}>XP Reward</Text>
      <View style={s.xpRow}>
        {[5, 10, 15, 20, 25, 30].map((xp) => (
          <TouchableOpacity
            key={xp}
            style={[s.xpChip, form.xpReward === xp && s.xpChipActive]}
            onPress={() => updateForm({ xpReward: xp })}
          >
            <Text style={[s.xpChipText, form.xpReward === xp && s.xpChipTextActive]}>
              {xp} XP
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <TextInput
        style={[s.input, { marginTop: 8 }]}
        value={String(form.xpReward)}
        onChangeText={(v) => updateForm({ xpReward: parseInt(v) || 10 })}
        keyboardType="numeric"
        placeholder="Custom XP value"
        placeholderTextColor={TG.textHint}
      />

      <Text style={s.label}>Explanation</Text>
      <Text style={s.fieldDesc}>Shown after the student answers to help them learn</Text>
      <TextInput
        style={[s.input, s.inputMulti]}
        value={form.explanation}
        onChangeText={(v) => updateForm({ explanation: v })}
        placeholder="e.g. 'Went' is the past tense of 'go'..."
        placeholderTextColor={TG.textHint}
        multiline
        textAlignVertical="top"
      />

      <Text style={s.label}>Hints</Text>
      <Text style={s.fieldDesc}>Progressive hints revealed when student is stuck</Text>
      {form.hints.map((h, i) => (
        <View key={i} style={s.hintRow}>
          <View style={s.hintNumberBadge}>
            <Text style={s.hintNumberText}>{i + 1}</Text>
          </View>
          <TextInput
            style={[s.input, { flex: 1 }]}
            value={h}
            onChangeText={(v) => updateHint(i, v)}
            placeholder={`Hint ${i + 1}`}
            placeholderTextColor={TG.textHint}
          />
          <TouchableOpacity onPress={() => removeHint(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={16} color={TG.textHint} />
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity style={s.addRowBtn} onPress={addHint}>
        <Plus size={14} color={TG.accent} /><Text style={s.addRowText}>Add Hint</Text>
      </TouchableOpacity>
    </>
  );

  // ─── Type-specific fields ────────────────────────────────

  const renderTypeSpecificFields = () => {
    const t = form.type;

    return (
      <>
        {AUDIO_TYPES.includes(t) && (
          <>
            <Text style={s.label}>Audio</Text>
            {form.audioUrl.trim() ? (
              <View style={s.audioSection}>
                <View style={s.playerWrapper}>
                  <WaveformPlayer uri={form.audioUrl.trim()} />
                </View>
                <TouchableOpacity style={s.audioRemoveBtn} onPress={() => updateForm({ audioUrl: '' })} activeOpacity={0.7}>
                  <Trash2 size={15} color={TG.red} />
                  <Text style={s.audioRemoveText}>Remove audio</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={s.audioPlaceholder}>
                <Volume2 size={20} color={TG.textHint} />
                <Text style={s.audioPlaceholderText}>No audio — generate below</Text>
              </View>
            )}

            <Text style={[s.label, { marginTop: 10 }]}>Generate Audio from Text</Text>
            <Text style={s.fieldDesc}>Uses the prompt text to generate audio</Text>
            <View style={s.voiceRow}>
              {VOICES.map((v) => (
                <TouchableOpacity
                  key={v}
                  style={[s.voiceChip, voice === v && s.voiceChipActive]}
                  onPress={() => setVoice(v)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.voiceChipText, voice === v && s.voiceChipTextActive]}>
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[s.generateBtn, (generating || !form.prompt.trim()) && { opacity: 0.5 }]}
              onPress={async () => {
                const text = form.targetText?.trim() || form.prompt.trim();
                if (!text) {
                  toast.warning('Validation', 'Enter prompt or target text first');
                  return;
                }
                setGenerating(true);
                try {
                  const result = await apiTextToSpeech(text, voice);
                  updateForm({ audioUrl: result.url ?? '' });
                  toast.success('Done', 'Audio generated');
                } catch (e: any) {
                  toast.error('Error', e.message);
                } finally {
                  setGenerating(false);
                }
              }}
              activeOpacity={0.7}
              disabled={generating || !form.prompt.trim()}
            >
              {generating ? (
                <ActivityIndicator size="small" color={TG.accent} />
              ) : (
                <>
                  <Volume2 size={18} color={TG.accent} />
                  <Text style={s.generateBtnText}>Generate Audio</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={[s.label, { marginTop: 10 }]}>Audio URL</Text>
            <TextInput style={s.input} value={form.audioUrl} onChangeText={(v) => updateForm({ audioUrl: v })} placeholder="https://... or generate above" placeholderTextColor={TG.textHint} autoCapitalize="none" />
          </>
        )}

        {['listenRepeat', 'pronunciation'].includes(t) && (
          <>
            <Text style={s.label}>Target Text <Text style={s.required}>*</Text></Text>
            <Text style={s.fieldDesc}>The text the student should say</Text>
            <TextInput style={s.input} value={form.targetText} onChangeText={(v) => updateForm({ targetText: v })} placeholder="Hello, how are you?" placeholderTextColor={TG.textHint} />
          </>
        )}

        {t === 'fillInBlank' && (
          <>
            <Text style={s.label}>Sentence Template <Text style={s.required}>*</Text></Text>
            <Text style={s.fieldDesc}>Use ___ (three underscores) for the blank</Text>
            <TextInput style={s.input} value={form.sentenceTemplate} onChangeText={(v) => updateForm({ sentenceTemplate: v })} placeholder='I ___ to school yesterday' placeholderTextColor={TG.textHint} />
            {form.sentenceTemplate && !form.sentenceTemplate.includes('___') && (
              <Text style={s.fieldError}>Template must contain ___</Text>
            )}
            {form.sentenceTemplate.includes('___') && (
              <View style={s.templatePreview}>
                {form.sentenceTemplate.split('___').map((part, i, arr) => (
                  <Text key={i} style={s.templatePreviewText}>
                    {part}{i < arr.length - 1 && <Text style={s.templatePreviewBlank}> ______ </Text>}
                  </Text>
                ))}
              </View>
            )}
            <Text style={s.label}>Correct Answer</Text>
            <TextInput style={s.input} value={form.correctAnswer} onChangeText={(v) => updateForm({ correctAnswer: v })} placeholder="went" placeholderTextColor={TG.textHint} />
          </>
        )}

        {t === 'speakTheAnswer' && (
          <>
            <Text style={s.label}>Correct Answer</Text>
            <TextInput style={s.input} value={form.correctAnswer} onChangeText={(v) => updateForm({ correctAnswer: v })} placeholder="Expected spoken answer" placeholderTextColor={TG.textHint} />
            <Text style={s.label}>Image URL (optional)</Text>
            <TextInput style={s.input} value={form.imageUrl} onChangeText={(v) => updateForm({ imageUrl: v })} placeholder="https://..." placeholderTextColor={TG.textHint} autoCapitalize="none" />
          </>
        )}

        {(['multipleChoice', 'listenAndChoose', 'tapWhatYouHear'].includes(t) || t === 'fillInBlank') && (
          <>
            <View style={s.sectionHeader}>
              <Text style={s.label}>
                Options {t === 'fillInBlank' ? '(optional — for dropdown mode)' : ''}
                {t !== 'fillInBlank' && <Text style={s.required}> *</Text>}
              </Text>
              <Text style={s.optionHint}>Tap circle to mark correct</Text>
            </View>
            {form.options.map((opt, i) => (
              <View key={i} style={s.optionCard}>
                <TouchableOpacity
                  style={[s.correctToggle, opt.isCorrect && s.correctToggleActive]}
                  onPress={() => updateOption(i, { isCorrect: !opt.isCorrect })}
                >
                  {opt.isCorrect && <Check size={14} color="#fff" />}
                </TouchableOpacity>
                <View style={s.optionInputWrap}>
                  <TextInput
                    style={[s.input, { flex: 1, marginBottom: 0 }]}
                    value={opt.text}
                    onChangeText={(v) => updateOption(i, { text: v })}
                    placeholder={`Option ${i + 1}${opt.isCorrect ? ' (correct)' : ''}`}
                    placeholderTextColor={TG.textHint}
                  />
                </View>
                {form.options.length > 2 && (
                  <TouchableOpacity onPress={() => removeOption(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={s.removeItemBtn}>
                    <X size={16} color={TG.textHint} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            {form.options.length < 6 && (
              <TouchableOpacity style={s.addRowBtn} onPress={addOption}>
                <Plus size={14} color={TG.accent} /><Text style={s.addRowText}>Add Option</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {t === 'matchPairs' && (
          <>
            <Text style={s.label}>Match Pairs <Text style={s.required}>*</Text></Text>
            <Text style={s.fieldDesc}>At least 2 pairs required</Text>
            {form.matchPairs.map((pair, i) => (
              <View key={i} style={s.pairCard}>
                <View style={s.pairNumber}>
                  <Text style={s.pairNumberText}>{i + 1}</Text>
                </View>
                <View style={s.pairInputs}>
                  <TextInput
                    style={[s.input, s.pairInput]}
                    value={pair.leftText}
                    onChangeText={(v) => updatePair(i, { leftText: v })}
                    placeholder="Left item"
                    placeholderTextColor={TG.textHint}
                  />
                  <View style={s.pairArrowContainer}>
                    <Text style={s.pairArrow}>↔</Text>
                  </View>
                  <TextInput
                    style={[s.input, s.pairInput]}
                    value={pair.rightText}
                    onChangeText={(v) => updatePair(i, { rightText: v })}
                    placeholder="Right item"
                    placeholderTextColor={TG.textHint}
                  />
                </View>
                {form.matchPairs.length > 2 && (
                  <TouchableOpacity onPress={() => removePair(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={s.removeItemBtn}>
                    <X size={16} color={TG.textHint} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            <TouchableOpacity style={s.addRowBtn} onPress={addPair}>
              <Plus size={14} color={TG.accent} /><Text style={s.addRowText}>Add Pair</Text>
            </TouchableOpacity>
          </>
        )}

        {(t === 'reorderWords' || t === 'translateSentence') && (
          <>
            <Text style={s.label}>Correct Sentence <Text style={s.required}>*</Text></Text>
            <Text style={s.fieldDesc}>Words will be scrambled for the student</Text>
            <TextInput
              style={s.input}
              value={form.wordBankSentence}
              onChangeText={(v) => updateForm({ wordBankSentence: v })}
              placeholder="She has been studying English"
              placeholderTextColor={TG.textHint}
            />
            {form.wordBankSentence.trim() && (
              <View style={s.wordPreview}>
                <Text style={s.wordPreviewLabel}>Word bank preview:</Text>
                <View style={s.wordPreviewRow}>
                  {form.wordBankSentence.trim().split(/\s+/).map((w, i) => (
                    <View key={i} style={s.wordChip}><Text style={s.wordChipText}>{w}</Text></View>
                  ))}
                  {form.distractors.filter(Boolean).map((w, i) => (
                    <View key={`d-${i}`} style={[s.wordChip, s.wordChipDistractor]}>
                      <Text style={s.wordChipTextDistractor}>{w}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            <Text style={s.label}>Distractors</Text>
            <Text style={s.fieldDesc}>Extra wrong words to make it harder</Text>
            {form.distractors.map((d, i) => (
              <View key={i} style={s.optionCard}>
                <TextInput
                  style={[s.input, { flex: 1, marginBottom: 0 }]}
                  value={d}
                  onChangeText={(v) => updateDistractor(i, v)}
                  placeholder={`Distractor word ${i + 1}`}
                  placeholderTextColor={TG.textHint}
                />
                <TouchableOpacity onPress={() => removeDistractor(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={s.removeItemBtn}>
                  <X size={16} color={TG.textHint} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={s.addRowBtn} onPress={addDistractor}>
              <Plus size={14} color={TG.accent} /><Text style={s.addRowText}>Add Distractor</Text>
            </TouchableOpacity>
          </>
        )}

        {(t === 'completeConversation' || t === 'roleplay') && (
          <>
            <Text style={s.label}>Conversation Lines <Text style={s.required}>*</Text></Text>
            <Text style={s.fieldDesc}>Build the dialogue — mark which lines are student turns</Text>
            {form.conversationLines.map((line, i) => (
              <View key={i} style={[s.convoCard, line.isUserTurn && s.convoCardUser]}>
                <View style={s.convoLineNumber}>
                  <Text style={s.convoLineNumberText}>{i + 1}</Text>
                </View>
                <View style={s.convoContent}>
                  <View style={s.convoHeader}>
                    <TextInput
                      style={[s.input, { flex: 1, marginBottom: 0 }]}
                      value={line.speaker}
                      onChangeText={(v) => updateConvoLine(i, { speaker: v })}
                      placeholder="Speaker name"
                      placeholderTextColor={TG.textHint}
                    />
                    <TouchableOpacity
                      style={[s.userToggle, line.isUserTurn && s.userToggleActive]}
                      onPress={() => updateConvoLine(i, { isUserTurn: !line.isUserTurn, speaker: !line.isUserTurn ? 'You' : 'Bot' })}
                    >
                      <Text style={[s.userToggleText, line.isUserTurn && s.userToggleTextActive]}>
                        {line.isUserTurn ? '👤 User' : '🤖 Bot'}
                      </Text>
                    </TouchableOpacity>
                    {form.conversationLines.length > 1 && (
                      <TouchableOpacity onPress={() => removeConvoLine(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <X size={16} color={TG.textHint} />
                      </TouchableOpacity>
                    )}
                  </View>
                  <TextInput
                    style={[s.input, { marginTop: 8 }]}
                    value={line.text}
                    onChangeText={(v) => updateConvoLine(i, { text: v })}
                    placeholder={line.isUserTurn ? 'Expected response (or leave blank)' : 'Bot says...'}
                    placeholderTextColor={TG.textHint}
                    multiline
                  />
                  {line.isUserTurn && t === 'completeConversation' && (
                    <>
                      <Text style={s.fieldDescSmall}>Accepted answers (comma-separated)</Text>
                      <TextInput
                        style={[s.input, { marginTop: 4 }]}
                        value={line.acceptedAnswers}
                        onChangeText={(v) => updateConvoLine(i, { acceptedAnswers: v })}
                        placeholder="answer1, answer2, ..."
                        placeholderTextColor={TG.textHint}
                      />
                    </>
                  )}
                </View>
              </View>
            ))}
            <TouchableOpacity style={s.addRowBtn} onPress={addConvoLine}>
              <Plus size={14} color={TG.accent} /><Text style={s.addRowText}>Add Line</Text>
            </TouchableOpacity>
          </>
        )}
      </>
    );
  };

  // ─── Render: Preview Modal ───────────────────────────────

  const renderPreviewModal = () => {
    if (!previewExercise) return null;
    const ex = previewExercise;
    const groupColor = getTypeGroupColor(ex.type);
    const diffOpt = DIFFICULTY_OPTIONS[(ex.difficulty || 1) - 1];

    return (
      <Modal visible={!!previewExercise} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={s.modalSafe}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setPreviewExercise(null)}>
              <X size={22} color={TG.textPrimary} />
            </TouchableOpacity>
            <Text style={s.modalTitle}>Exercise Preview</Text>
            <TouchableOpacity onPress={() => { setPreviewExercise(null); openEditExercise(ex); }}>
              <Text style={s.saveHeaderText}>Edit</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={s.modalScroll} contentContainerStyle={s.modalContent}>
            <View style={[s.previewHeaderBar, { borderLeftColor: groupColor }]}>
              <Text style={s.previewHeaderBarIcon}>{getTypeIcon(ex.type)}</Text>
              <View>
                <Text style={[s.previewHeaderBarType, { color: groupColor }]}>{getTypeLabel(ex.type)}</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                  <Text style={[s.previewHeaderBarMeta, { color: diffOpt.color }]}>{diffOpt.emoji} {diffOpt.label}</Text>
                  <Text style={s.previewHeaderBarMeta}>⚡ {ex.xpReward || 10} XP</Text>
                </View>
              </View>
            </View>

            <View style={s.previewSection}>
              <Text style={s.previewSectionLabel}>PROMPT</Text>
              <Text style={s.previewPromptText}>{ex.prompt}</Text>
            </View>

            {ex.correctAnswer && (
              <View style={s.previewSection}>
                <Text style={s.previewSectionLabel}>CORRECT ANSWER</Text>
                <View style={s.previewAnswerBox}>
                  <Check size={16} color={TG.green} />
                  <Text style={s.previewAnswerBoxText}>{ex.correctAnswer}</Text>
                </View>
              </View>
            )}

            {ex.sentenceTemplate && (
              <View style={s.previewSection}>
                <Text style={s.previewSectionLabel}>SENTENCE TEMPLATE</Text>
                <Text style={s.previewDetailText}>{ex.sentenceTemplate}</Text>
              </View>
            )}

            {ex.targetText && (
              <View style={s.previewSection}>
                <Text style={s.previewSectionLabel}>TARGET TEXT</Text>
                <Text style={s.previewDetailText}>{ex.targetText}</Text>
              </View>
            )}

            {ex.audioUrl && (
              <View style={s.previewSection}>
                <Text style={s.previewSectionLabel}>AUDIO</Text>
                <Text style={[s.previewDetailText, { color: TG.accent }]} numberOfLines={1}>{ex.audioUrl}</Text>
              </View>
            )}

            {ex.options && ex.options.length > 0 && (
              <View style={s.previewSection}>
                <Text style={s.previewSectionLabel}>OPTIONS ({ex.options.length})</Text>
                {ex.options.map((opt) => (
                  <View key={opt.id} style={[s.previewFullOption, opt.isCorrect && s.previewFullOptionCorrect]}>
                    <View style={[s.previewFullOptionDot, opt.isCorrect && { backgroundColor: TG.green }]} />
                    <Text style={[s.previewFullOptionText, opt.isCorrect && { color: TG.green, fontWeight: '700' }]}>{opt.text}</Text>
                    {opt.isCorrect && <Text style={s.previewCorrectLabel}>Correct</Text>}
                  </View>
                ))}
              </View>
            )}

            {ex.matchPairs && ex.matchPairs.length > 0 && (
              <View style={s.previewSection}>
                <Text style={s.previewSectionLabel}>MATCH PAIRS ({ex.matchPairs.length})</Text>
                {ex.matchPairs.map((pair) => (
                  <View key={pair.id} style={s.previewFullPair}>
                    <Text style={s.previewFullPairLeft}>{pair.leftText}</Text>
                    <Text style={s.previewFullPairArrow}>→</Text>
                    <Text style={s.previewFullPairRight}>{pair.rightText}</Text>
                  </View>
                ))}
              </View>
            )}

            {ex.wordBankItems && ex.wordBankItems.length > 0 && (
              <View style={s.previewSection}>
                <Text style={s.previewSectionLabel}>WORD BANK ({ex.wordBankItems.length} words)</Text>
                <View style={s.previewWordBank}>
                  {ex.wordBankItems.map((w) => (
                    <View key={w.id} style={[s.previewWordChip, w.isDistractor && s.previewWordChipDistractor]}>
                      <Text style={[s.previewWordText, w.isDistractor && s.previewWordTextDistractor]}>{w.text}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {ex.conversationLines && ex.conversationLines.length > 0 && (
              <View style={s.previewSection}>
                <Text style={s.previewSectionLabel}>CONVERSATION ({ex.conversationLines.length} lines)</Text>
                {ex.conversationLines.map((line) => (
                  <View key={line.id} style={[s.previewFullConvoLine, line.isUserTurn && s.previewFullConvoLineUser]}>
                    <Text style={s.previewFullConvoSpeaker}>{line.speaker}</Text>
                    <Text style={s.previewFullConvoText}>
                      {line.isUserTurn && !line.text ? '[ student responds ]' : line.text}
                    </Text>
                    {line.isUserTurn && line.acceptedAnswers && line.acceptedAnswers.length > 0 && (
                      <Text style={s.previewAcceptedAnswers}>
                        Accepted: {line.acceptedAnswers.join(', ')}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            {ex.hints && ex.hints.length > 0 && (
              <View style={s.previewSection}>
                <Text style={s.previewSectionLabel}>HINTS ({ex.hints.length})</Text>
                {ex.hints.map((h, i) => (
                  <View key={i} style={s.previewHintItem}>
                    <Text style={s.previewHintNumber}>{i + 1}</Text>
                    <Text style={s.previewHintText}>{h}</Text>
                  </View>
                ))}
              </View>
            )}

            {ex.explanation && (
              <View style={s.previewSection}>
                <Text style={s.previewSectionLabel}>EXPLANATION</Text>
                <Text style={s.previewDetailText}>{ex.explanation}</Text>
              </View>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  };

  // ─── Render: Main ────────────────────────────────────────

  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ArrowLeft size={22} color={TG.textWhite} />
        </TouchableOpacity>
        <View style={s.topBarCenter}>
          <Text style={s.topTitle} numberOfLines={1}>Exercise Builder</Text>
          <Text style={s.topSubtitle} numberOfLines={1}>{lesson.unit.course.title} • {lesson.unit.title}</Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowTemplates(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={s.topBarAction}
        >
          <Sparkles size={20} color={TG.textWhite} />
        </TouchableOpacity>
      </View>

      <FlatList
        style={{ flex: 1, backgroundColor: TG.bgSecondary }}
        contentContainerStyle={s.contentWrap}
        ListHeaderComponent={
          <>
            <View style={s.lessonHeader}>
              <Text style={s.lessonTitle}>{lesson.title}</Text>
              <View style={s.lessonMeta}>
                <View style={s.badge}><Text style={s.badgeText}>{lesson.unit.title}</Text></View>
                <View style={[s.badge, { backgroundColor: TG.gold + '15' }]}>
                  <Text style={[s.badgeText, { color: TG.gold }]}>⚡ {lesson.xpReward} XP</Text>
                </View>
              </View>
            </View>

            {renderStatsDashboard()}
            {allExercises.length > 0 && renderFilterBar()}

            {(searchQuery || filterType || filterDifficulty) && (
              <Text style={s.resultsCount}>
                {exercises.length} of {allExercises.length} exercise{allExercises.length !== 1 ? 's' : ''}
              </Text>
            )}
          </>
        }
        data={exercises}
        keyExtractor={(e) => String(e.id)}
        renderItem={renderExerciseCard}
        ListEmptyComponent={
          allExercises.length === 0 ? (
            <View style={s.emptyState}>
              <Text style={s.emptyIcon}>📝</Text>
              <Text style={s.emptyTitle}>No Exercises Yet</Text>
              <Text style={s.emptyDesc}>Start building your lesson by adding exercises below</Text>
            </View>
          ) : (
            <View style={s.emptyState}>
              <Text style={s.emptyIcon}>🔍</Text>
              <Text style={s.emptyTitle}>No Matches</Text>
              <Text style={s.emptyDesc}>Try adjusting your search or filters</Text>
            </View>
          )
        }
        ListFooterComponent={
          <View style={s.footerActions}>
            <TouchableOpacity style={s.addBtn} onPress={openAddExercise} activeOpacity={0.7}>
              <Plus size={20} color={TG.textWhite} />
              <Text style={s.addBtnText}>Add Exercise</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.templateBtn} onPress={() => setShowTemplates(true)} activeOpacity={0.7}>
              <Sparkles size={18} color={TG.accent} />
              <Text style={s.templateBtnText}>Use Template</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* ─── Templates Modal ──────────────────────────── */}
      <Modal visible={showTemplates} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={s.modalSafe}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setShowTemplates(false)}>
              <X size={22} color={TG.textPrimary} />
            </TouchableOpacity>
            <Text style={s.modalTitle}>Quick Templates</Text>
            <View style={{ width: 22 }} />
          </View>
          <ScrollView style={s.modalScroll} contentContainerStyle={s.modalContent}>
            <Text style={s.stepDesc}>Start from a template to create exercises faster</Text>
            {QUICK_TEMPLATES.map((tpl, i) => (
              <TouchableOpacity key={i} style={s.templateCard} onPress={() => openFromTemplate(tpl)} activeOpacity={0.7}>
                <Text style={s.templateCardIcon}>{tpl.icon}</Text>
                <View style={s.templateCardInfo}>
                  <Text style={s.templateCardLabel}>{tpl.label}</Text>
                  <Text style={s.templateCardDesc}>{tpl.desc}</Text>
                </View>
                <ChevronRight size={18} color={TG.textHint} />
              </TouchableOpacity>
            ))}
            <View style={s.templateDivider} />
            <TouchableOpacity style={s.templateCardBlank} onPress={() => { setShowTemplates(false); openAddExercise(); }} activeOpacity={0.7}>
              <Plus size={20} color={TG.accent} />
              <Text style={s.templateCardBlankText}>Blank Exercise</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ─── Exercise Editor Modal (Wizard) ───────────── */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={s.modalSafe}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={22} color={TG.textPrimary} />
              </TouchableOpacity>
              <Text style={s.modalTitle}>{editExerciseId ? 'Edit Exercise' : 'New Exercise'}</Text>
              <TouchableOpacity
                onPress={handleSave}
                disabled={!isFormValid() || submitting}
                style={[s.saveHeaderBtn, (!isFormValid() || submitting) && { opacity: 0.4 }]}
              >
                {submitting ? <ActivityIndicator size="small" color={TG.accent} /> : <Text style={s.saveHeaderText}>Save</Text>}
              </TouchableOpacity>
            </View>

            {/* Wizard Steps */}
            <View style={s.wizardSteps}>
              {WIZARD_STEPS.map((step, i) => {
                const isActive = wizardStep === step.key;
                const isPast = WIZARD_STEPS.findIndex((ws) => ws.key === wizardStep) > i;
                return (
                  <TouchableOpacity
                    key={step.key}
                    style={[s.wizardStep, isActive && s.wizardStepActive]}
                    onPress={() => setWizardStep(step.key)}
                  >
                    <View style={[s.wizardStepDot, isActive && s.wizardStepDotActive, isPast && s.wizardStepDotPast]}>
                      {isPast ? <Check size={12} color="#fff" /> : <Text style={[s.wizardStepNumber, (isActive || isPast) && { color: '#fff' }]}>{step.icon}</Text>}
                    </View>
                    <Text style={[s.wizardStepLabel, isActive && s.wizardStepLabelActive]}>{step.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <ScrollView style={s.modalScroll} contentContainerStyle={s.modalContent} keyboardShouldPersistTaps="handled">
              {renderWizardStepContent()}

              {wizardStep === 'content' && getValidationErrors().length > 0 && form.prompt.trim() !== '' && (
                <View style={s.validationBox}>
                  {getValidationErrors().map((err, i) => (
                    <View key={i} style={s.validationItem}>
                      <Text style={s.validationDot}>•</Text>
                      <Text style={s.validationText}>{err}</Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={{ height: 80 }} />
            </ScrollView>

            {/* Bottom navigation */}
            <View style={s.wizardFooter}>
              {wizardStep !== 'type' ? (
                <TouchableOpacity
                  style={s.wizardBackBtn}
                  onPress={() => setWizardStep(wizardStep === 'settings' ? 'content' : 'type')}
                >
                  <ArrowLeft size={16} color={TG.textSecondary} />
                  <Text style={s.wizardBackText}>Back</Text>
                </TouchableOpacity>
              ) : <View />}

              {wizardStep !== 'settings' ? (
                <TouchableOpacity
                  style={s.wizardNextBtn}
                  onPress={() => setWizardStep(wizardStep === 'type' ? 'content' : 'settings')}
                >
                  <Text style={s.wizardNextText}>
                    {wizardStep === 'type' ? 'Next: Content' : 'Next: Settings'}
                  </Text>
                  <ChevronRight size={16} color="#fff" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[s.wizardSaveBtn, (!isFormValid() || submitting) && { opacity: 0.5 }]}
                  onPress={handleSave}
                  disabled={!isFormValid() || submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Check size={16} color="#fff" />
                      <Text style={s.wizardSaveText}>{editExerciseId ? 'Update' : 'Create'} Exercise</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {renderPreviewModal()}
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────

const SHADOW_SM = Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  android: { elevation: 1 },
  default: {},
});
const SHADOW_MD = Platform.select({
  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
  android: { elevation: 3 },
  default: {},
});

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TG.headerBg },
  centered: { alignItems: 'center', justifyContent: 'center', backgroundColor: TG.bgSecondary },
  loadingText: { marginTop: 12, color: TG.textSecondary, fontSize: 14 },
  errorText: { color: TG.textSecondary, fontSize: 16, marginBottom: 16 },
  backBtn: { paddingHorizontal: 20, paddingVertical: 12, backgroundColor: TG.bg, borderRadius: 10, ...SHADOW_SM as any },
  backBtnText: { color: TG.textPrimary, fontWeight: '600', fontSize: 15 },

  // Top Bar
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: TG.headerBg, gap: 12 },
  topBarCenter: { flex: 1 },
  topTitle: { fontSize: 18, fontWeight: '700', color: TG.textWhite },
  topSubtitle: { fontSize: 12, color: TG.textWhite + '90', marginTop: 2 },
  topBarAction: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },

  contentWrap: { padding: 16, paddingBottom: 40, flexGrow: 1 },

  // Lesson Header
  lessonHeader: { marginBottom: 16 },
  lessonTitle: { fontSize: 24, fontWeight: '800', color: TG.textPrimary, marginBottom: 10, letterSpacing: -0.3 },
  lessonMeta: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  badge: { alignSelf: 'flex-start', backgroundColor: TG.accentLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: '700', color: TG.accent },

  // Stats Dashboard
  statsCard: { backgroundColor: TG.bg, borderRadius: 16, padding: 16, marginBottom: 16, ...SHADOW_SM as any },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginBottom: 16 },
  statItem: { alignItems: 'center' },
  statNumber: { fontSize: 24, fontWeight: '800', color: TG.textPrimary },
  statLabel: { fontSize: 11, fontWeight: '600', color: TG.textHint, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  statDivider: { width: 1, height: 30, backgroundColor: TG.separatorLight },

  diffBar: { flexDirection: 'row', height: 6, borderRadius: 6, backgroundColor: TG.bgSecondary, overflow: 'hidden', marginBottom: 8 },
  diffBarSegment: { height: '100%' as any },
  diffLegend: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  diffLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  diffLegendDot: { width: 8, height: 8, borderRadius: 4 },
  diffLegendText: { fontSize: 11, color: TG.textSecondary },

  typeChipsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: TG.separator, backgroundColor: TG.bgSecondary },
  typeChipIcon: { fontSize: 12 },
  typeChipText: { fontSize: 12, fontWeight: '700', color: TG.textSecondary },

  // Filter Bar
  filterContainer: { marginBottom: 12 },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: TG.bg, borderRadius: 10, paddingHorizontal: 12, height: 40, gap: 8, borderWidth: 1, borderColor: TG.separator },
  searchInput: { flex: 1, fontSize: 14, color: TG.textPrimary, padding: 0 },
  filterBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: TG.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: TG.separator },
  filterBtnActive: { borderColor: TG.accent, backgroundColor: TG.accentLight },
  filterBadge: { position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: TG.accent, alignItems: 'center', justifyContent: 'center' },
  filterBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },

  filterChipsContainer: { backgroundColor: TG.bg, borderRadius: 12, padding: 12, ...SHADOW_SM as any },
  filterSectionLabel: { fontSize: 11, fontWeight: '700', color: TG.textHint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  filterChipsScroll: { marginBottom: 4 },
  filterChipsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: TG.separator, backgroundColor: TG.bgSecondary, marginRight: 6 },
  filterChipActive: { borderColor: TG.accent, backgroundColor: TG.accentLight },
  filterChipEmoji: { fontSize: 12 },
  filterChipText: { fontSize: 12, color: TG.textSecondary },
  filterChipTextActive: { color: TG.accent, fontWeight: '700' },
  clearFiltersBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10, paddingVertical: 4 },
  clearFiltersText: { fontSize: 13, color: TG.red, fontWeight: '600' },

  // Bulk
  bulkBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: TG.bg, borderRadius: 10, padding: 10, ...SHADOW_SM as any },
  bulkSelectAll: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: TG.separator, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: TG.accent, borderColor: TG.accent },
  bulkText: { fontSize: 13, fontWeight: '600', color: TG.textSecondary },
  bulkDeleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: TG.red, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  bulkDeleteText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  resultsCount: { fontSize: 12, color: TG.textHint, marginBottom: 8, fontWeight: '600' },

  // Exercise Card
  exCard: { backgroundColor: TG.bg, borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: TG.separatorLight, borderLeftWidth: 4, borderLeftColor: TG.accent, flexDirection: 'row', overflow: 'hidden', ...SHADOW_SM as any },
  exCardSelected: { borderColor: TG.accent, backgroundColor: TG.accentLight },
  exCheckboxCol: { width: 44, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: TG.separatorLight },
  exCardBody: { flex: 1, padding: 14 },
  exHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  exHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  exOrderBadge: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  exOrderText: { fontSize: 11, fontWeight: '800' },
  exTypeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  exTypeIcon: { fontSize: 12 },
  exTypeText: { fontSize: 11, fontWeight: '700' },
  exActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  reorderBtn: { width: 24, height: 24, borderRadius: 6, backgroundColor: TG.bgSecondary, alignItems: 'center', justifyContent: 'center' },
  reorderBtnDisabled: { opacity: 0.3 },
  exActionDivider: { width: 1, height: 16, backgroundColor: TG.separatorLight },
  exPrompt: { fontSize: 15, fontWeight: '600', color: TG.textPrimary, marginBottom: 8, lineHeight: 21 },

  // Exercise Card Preview
  previewContainer: { marginBottom: 8 },
  previewOption: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: TG.bgSecondary, marginBottom: 4 },
  previewOptionCorrect: { backgroundColor: TG.green + '10' },
  previewOptionText: { fontSize: 13, color: TG.textSecondary },
  previewOptionTextCorrect: { color: TG.green, fontWeight: '600' },
  previewMore: { fontSize: 11, color: TG.textHint, marginTop: 2 },
  previewPairRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  previewPairItem: { flex: 1, backgroundColor: TG.bgSecondary, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6 },
  previewPairText: { fontSize: 12, color: TG.textSecondary },
  previewPairArrow: { fontSize: 12, color: TG.textHint },
  previewWordBank: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 8 },
  previewWordChip: { backgroundColor: TG.accentLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  previewWordChipDistractor: { backgroundColor: TG.red + '10' },
  previewWordText: { fontSize: 12, color: TG.accent, fontWeight: '600' },
  previewWordTextDistractor: { color: TG.red },
  previewConvoLine: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 3 },
  previewConvoLineUser: {},
  previewConvoSpeaker: { fontSize: 11, fontWeight: '700', color: TG.textHint, width: 36 },
  previewConvoText: { fontSize: 12, color: TG.textSecondary, flex: 1 },
  previewAnswerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: TG.green + '08', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 8 },
  previewAnswerText: { fontSize: 13, color: TG.green, fontWeight: '600' },

  // Exercise Card Footer
  exFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  diffBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  diffText: { fontSize: 11, fontWeight: '700' },
  xpBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  xpLabel: { fontSize: 12, color: TG.gold, fontWeight: '700' },
  hintBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: TG.bgSecondary },
  hintBadgeText: { fontSize: 11 },

  // Empty State
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: TG.textPrimary, marginBottom: 6 },
  emptyDesc: { fontSize: 14, color: TG.textSecondary, textAlign: 'center', paddingHorizontal: 32 },

  // Footer Actions
  footerActions: { marginTop: 16, gap: 10 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: TG.accent, padding: 16, borderRadius: 14, ...SHADOW_MD as any },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  templateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: TG.bg, padding: 14, borderRadius: 14, borderWidth: 1.5, borderColor: TG.accent },
  templateBtnText: { color: TG.accent, fontSize: 15, fontWeight: '700' },

  // Modal
  modalSafe: { flex: 1, backgroundColor: TG.bg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: TG.separator },
  modalTitle: { fontSize: 17, fontWeight: '700', color: TG.textPrimary },
  saveHeaderBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  saveHeaderText: { fontSize: 16, fontWeight: '700', color: TG.accent },
  modalScroll: { flex: 1 },
  modalContent: { padding: 16, paddingBottom: 40 },

  // Wizard Steps
  wizardSteps: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: TG.bgSecondary, borderBottomWidth: 0.5, borderBottomColor: TG.separator, gap: 4 },
  wizardStep: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 10 },
  wizardStepActive: { backgroundColor: TG.bg, ...SHADOW_SM as any },
  wizardStepDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: TG.separator, alignItems: 'center', justifyContent: 'center' },
  wizardStepDotActive: { backgroundColor: TG.accent },
  wizardStepDotPast: { backgroundColor: TG.green },
  wizardStepNumber: { fontSize: 11, fontWeight: '800', color: TG.textHint },
  wizardStepLabel: { fontSize: 13, fontWeight: '600', color: TG.textHint },
  wizardStepLabelActive: { color: TG.textPrimary, fontWeight: '700' },

  // Wizard Footer
  wizardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 0.5, borderTopColor: TG.separator, backgroundColor: TG.bg },
  wizardBackBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 10, paddingHorizontal: 16 },
  wizardBackText: { fontSize: 15, color: TG.textSecondary, fontWeight: '600' },
  wizardNextBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: TG.accent, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12 },
  wizardNextText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  wizardSaveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: TG.green, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12 },
  wizardSaveText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Step content
  stepTitle: { fontSize: 20, fontWeight: '800', color: TG.textPrimary, marginBottom: 4 },
  stepDesc: { fontSize: 14, color: TG.textSecondary, marginBottom: 16, lineHeight: 20 },
  stepTypeIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: TG.bgSecondary, padding: 12, borderRadius: 12, marginBottom: 16 },
  stepTypeIcon: { fontSize: 24 },
  stepTypeLabel: { fontSize: 16, fontWeight: '700', flex: 1 },
  changeTypeBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: TG.bg, borderRadius: 8, borderWidth: 1, borderColor: TG.separator },
  changeTypeText: { fontSize: 13, color: TG.accent, fontWeight: '600' },

  // Type selector (step 1)
  typeGroupSection: { marginBottom: 16 },
  typeGroupHeader: { borderLeftWidth: 3, paddingLeft: 10, marginBottom: 8 },
  typeGroupLabel: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  typeSelectCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: TG.bgSecondary, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: TG.separator, marginBottom: 6 },
  typeSelectIcon: { fontSize: 24 },
  typeSelectInfo: { flex: 1 },
  typeSelectLabel: { fontSize: 15, fontWeight: '600', color: TG.textPrimary },
  typeSelectDesc: { fontSize: 12, color: TG.textHint, marginTop: 2 },
  typeSelectCheck: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  // Form fields
  label: { fontSize: 13, fontWeight: '700', color: TG.textSecondary, marginBottom: 6, marginTop: 16 },
  required: { color: TG.red },
  fieldDesc: { fontSize: 12, color: TG.textHint, marginBottom: 8, marginTop: -4, lineHeight: 16 },
  fieldDescSmall: { fontSize: 11, color: TG.textHint, marginTop: 6 },
  fieldError: { fontSize: 12, color: TG.red, marginTop: 4, fontWeight: '600' },
  input: { backgroundColor: TG.bgSecondary, borderWidth: 1, borderColor: TG.separator, borderRadius: 10, padding: 12, fontSize: 15, color: TG.textPrimary },
  inputMulti: { minHeight: 72, textAlignVertical: 'top' },

  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  optionHint: { fontSize: 11, color: TG.textHint, marginBottom: 6 },

  // Options
  optionCard: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, backgroundColor: TG.bgSecondary, padding: 8, borderRadius: 10, borderWidth: 1, borderColor: TG.separatorLight },
  optionInputWrap: { flex: 1 },
  correctToggle: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: TG.separator, justifyContent: 'center', alignItems: 'center' },
  correctToggleActive: { backgroundColor: TG.scoreGreen, borderColor: TG.scoreGreen },
  removeItemBtn: { padding: 4 },
  addRowBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, paddingVertical: 8, paddingHorizontal: 4 },
  addRowText: { fontSize: 14, color: TG.accent, fontWeight: '600' },

  // Match Pairs
  pairCard: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, backgroundColor: TG.bgSecondary, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: TG.separatorLight },
  pairNumber: { width: 24, height: 24, borderRadius: 12, backgroundColor: TG.accent + '15', alignItems: 'center', justifyContent: 'center' },
  pairNumberText: { fontSize: 11, fontWeight: '800', color: TG.accent },
  pairInputs: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  pairInput: { flex: 1 },
  pairArrowContainer: { paddingHorizontal: 2 },
  pairArrow: { fontSize: 16, color: TG.textHint },

  // Word Bank
  wordPreview: { backgroundColor: TG.bgSecondary, borderRadius: 10, padding: 12, marginTop: 8, marginBottom: 4 },
  wordPreviewLabel: { fontSize: 11, fontWeight: '700', color: TG.textHint, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  wordPreviewRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  wordChip: { backgroundColor: TG.accentLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  wordChipText: { fontSize: 14, color: TG.accent, fontWeight: '600' },
  wordChipDistractor: { backgroundColor: TG.red + '12' },
  wordChipTextDistractor: { fontSize: 14, color: TG.red, fontWeight: '600' },

  // Template preview
  templatePreview: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', backgroundColor: TG.bgSecondary, padding: 12, borderRadius: 10, marginTop: 8 },
  templatePreviewText: { fontSize: 15, color: TG.textPrimary, lineHeight: 24 },
  templatePreviewBlank: { color: TG.accent, fontWeight: '700', textDecorationLine: 'underline' },

  // Conversation
  convoCard: { flexDirection: 'row', gap: 10, backgroundColor: TG.bgSecondary, borderRadius: 12, padding: 12, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: TG.separator },
  convoCardUser: { borderLeftColor: TG.accent },
  convoLineNumber: { width: 24, height: 24, borderRadius: 12, backgroundColor: TG.bg, alignItems: 'center', justifyContent: 'center' },
  convoLineNumberText: { fontSize: 11, fontWeight: '800', color: TG.textHint },
  convoContent: { flex: 1 },
  convoHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  userToggle: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: TG.bg, borderWidth: 1, borderColor: TG.separator },
  userToggleActive: { backgroundColor: TG.accent, borderColor: TG.accent },
  userToggleText: { fontSize: 12, fontWeight: '600', color: TG.textSecondary },
  userToggleTextActive: { color: '#fff' },

  // Difficulty (settings step)
  diffRow: { flexDirection: 'row', gap: 10 },
  diffCard: { flex: 1, paddingVertical: 14, paddingHorizontal: 8, borderRadius: 12, alignItems: 'center', borderWidth: 1.5, borderColor: TG.separator, gap: 4 },
  diffCardEmoji: { fontSize: 20 },
  diffCardText: { fontSize: 14, color: TG.textSecondary, fontWeight: '600' },
  diffCardCheck: { position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },

  // XP chips
  xpRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  xpChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: TG.separator, backgroundColor: TG.bgSecondary },
  xpChipActive: { borderColor: TG.gold, backgroundColor: TG.gold + '15' },
  xpChipText: { fontSize: 13, fontWeight: '600', color: TG.textSecondary },
  xpChipTextActive: { color: TG.gold, fontWeight: '800' },

  // Hints (settings step)
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  hintNumberBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: TG.gold + '15', alignItems: 'center', justifyContent: 'center' },
  hintNumberText: { fontSize: 11, fontWeight: '800', color: TG.gold },

  // Validation
  validationBox: { backgroundColor: TG.red + '08', borderRadius: 10, padding: 12, marginTop: 16, borderWidth: 1, borderColor: TG.red + '20' },
  validationItem: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  validationDot: { fontSize: 14, color: TG.red, fontWeight: '700' },
  validationText: { fontSize: 13, color: TG.red, fontWeight: '500' },

  // Templates modal
  templateCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: TG.bgSecondary, padding: 16, borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: TG.separatorLight },
  templateCardIcon: { fontSize: 28 },
  templateCardInfo: { flex: 1 },
  templateCardLabel: { fontSize: 16, fontWeight: '700', color: TG.textPrimary },
  templateCardDesc: { fontSize: 13, color: TG.textSecondary, marginTop: 2 },
  templateDivider: { height: 1, backgroundColor: TG.separator, marginVertical: 16 },
  templateCardBlank: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 14, borderWidth: 1.5, borderColor: TG.accent, borderStyle: 'dashed' },
  templateCardBlankText: { fontSize: 15, fontWeight: '700', color: TG.accent },

  // Preview modal
  previewHeaderBar: { flexDirection: 'row', alignItems: 'center', gap: 12, borderLeftWidth: 4, paddingLeft: 12, marginBottom: 20 },
  previewHeaderBarIcon: { fontSize: 32 },
  previewHeaderBarType: { fontSize: 18, fontWeight: '800' },
  previewHeaderBarMeta: { fontSize: 13, fontWeight: '600', color: TG.textSecondary },
  previewSection: { marginBottom: 20 },
  previewSectionLabel: { fontSize: 11, fontWeight: '800', color: TG.textHint, letterSpacing: 1, marginBottom: 8 },
  previewPromptText: { fontSize: 18, fontWeight: '600', color: TG.textPrimary, lineHeight: 26 },
  previewDetailText: { fontSize: 15, color: TG.textPrimary, lineHeight: 22 },
  previewAnswerBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: TG.green + '10', padding: 12, borderRadius: 10 },
  previewAnswerBoxText: { fontSize: 16, fontWeight: '700', color: TG.green },
  previewFullOption: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, backgroundColor: TG.bgSecondary, marginBottom: 6 },
  previewFullOptionCorrect: { backgroundColor: TG.green + '10' },
  previewFullOptionDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: TG.separator },
  previewFullOptionText: { fontSize: 15, color: TG.textPrimary, flex: 1 },
  previewCorrectLabel: { fontSize: 11, fontWeight: '700', color: TG.green, backgroundColor: TG.green + '15', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  previewFullPair: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  previewFullPairLeft: { flex: 1, fontSize: 14, fontWeight: '600', color: TG.textPrimary, backgroundColor: TG.bgSecondary, padding: 10, borderRadius: 8, textAlign: 'center', overflow: 'hidden' },
  previewFullPairArrow: { fontSize: 16, color: TG.textHint },
  previewFullPairRight: { flex: 1, fontSize: 14, fontWeight: '600', color: TG.textPrimary, backgroundColor: TG.bgSecondary, padding: 10, borderRadius: 8, textAlign: 'center', overflow: 'hidden' },
  previewFullConvoLine: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: TG.bgSecondary, marginBottom: 6 },
  previewFullConvoLineUser: { backgroundColor: TG.accentLight },
  previewFullConvoSpeaker: { fontSize: 12, fontWeight: '800', color: TG.textHint, marginBottom: 4 },
  previewFullConvoText: { fontSize: 15, color: TG.textPrimary, lineHeight: 22 },
  previewAcceptedAnswers: { fontSize: 12, color: TG.green, fontWeight: '600', marginTop: 4 },
  previewHintItem: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  previewHintNumber: { width: 22, height: 22, borderRadius: 11, backgroundColor: TG.gold + '15', textAlign: 'center', lineHeight: 22, fontSize: 12, fontWeight: '700', color: TG.gold, overflow: 'hidden' },
  previewHintText: { flex: 1, fontSize: 14, color: TG.textPrimary, lineHeight: 20 },

  // Audio generation
  audioSection: { gap: 8 },
  playerWrapper: { backgroundColor: TG.bg, borderRadius: 12, padding: 10, borderWidth: 0.5, borderColor: TG.separator },
  audioRemoveBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, paddingVertical: 4 },
  audioRemoveText: { fontSize: 13, color: TG.red, fontWeight: '500' },
  audioPlaceholder: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: TG.bg, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14, borderWidth: 0.5, borderColor: TG.separator },
  audioPlaceholderText: { fontSize: 14, color: TG.textHint },
  voiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  voiceChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: TG.bg, borderWidth: 0.5, borderColor: TG.separator },
  voiceChipActive: { backgroundColor: TG.accent, borderColor: TG.accent },
  voiceChipText: { fontSize: 13, fontWeight: '600', color: TG.textSecondary },
  voiceChipTextActive: { color: '#fff' },
  generateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 10, backgroundColor: TG.bg, borderWidth: 0.5, borderColor: TG.accent },
  generateBtnText: { fontSize: 14, fontWeight: '600', color: TG.accent },
});
