import { useAlert } from '@/components/CustomAlert';
import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import { apiCreateExercise, apiDeleteExercise, apiFetchLesson, apiUpdateExercise } from '@/lib/api';
import type { Exercise, ExerciseType, LessonDetail } from '@/lib/types';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Check, ChevronDown, ChevronUp, Copy, Plus, Trash2, X } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
    types: [
      { key: 'listenRepeat' as ExerciseType, icon: '🎧', label: 'Listen & Repeat' },
      { key: 'listenAndChoose' as ExerciseType, icon: '👂', label: 'Listen & Choose' },
      { key: 'tapWhatYouHear' as ExerciseType, icon: '🔊', label: 'Tap What You Hear' },
    ],
  },
  {
    label: 'Speak',
    types: [
      { key: 'speakTheAnswer' as ExerciseType, icon: '🎤', label: 'Speak the Answer' },
      { key: 'pronunciation' as ExerciseType, icon: '🗣️', label: 'Pronunciation' },
      { key: 'roleplay' as ExerciseType, icon: '🎭', label: 'Roleplay' },
    ],
  },
  {
    label: 'Read / Write',
    types: [
      { key: 'multipleChoice' as ExerciseType, icon: '📋', label: 'Multiple Choice' },
      { key: 'fillInBlank' as ExerciseType, icon: '✏️', label: 'Fill in the Blank' },
      { key: 'reorderWords' as ExerciseType, icon: '🔀', label: 'Reorder Words' },
      { key: 'translateSentence' as ExerciseType, icon: '🌐', label: 'Translate Sentence' },
    ],
  },
  {
    label: 'Interactive',
    types: [
      { key: 'matchPairs' as ExerciseType, icon: '🔗', label: 'Match Pairs' },
      { key: 'completeConversation' as ExerciseType, icon: '💬', label: 'Complete Conversation' },
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

const DIFFICULTY_OPTIONS = [
  { value: 1, label: 'Easy', color: TG.scoreGreen },
  { value: 2, label: 'Medium', color: TG.scoreOrange },
  { value: 3, label: 'Hard', color: TG.scoreRed },
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
  const [showAdvanced, setShowAdvanced] = useState(false);

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

  // ─── Form helpers ──────────────────────────────────────────

  const updateForm = (patch: Partial<FormState>) => setForm((prev) => ({ ...prev, ...patch }));

  const openAddExercise = () => {
    setEditExerciseId(null);
    setForm(getDefaultFormState());
    setShowAdvanced(false);
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
    setShowAdvanced(true);
    setForm(f);
    setModalVisible(true);
  };

  const duplicateExercise = (ex: Exercise) => {
    openEditExercise(ex);
    setEditExerciseId(null);
  };

  const handleDelete = (exercise: Exercise) => {
    alert('Delete Exercise', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { await apiDeleteExercise(exercise.id); load(); }
          catch (e: any) { toast.error('Error', e.message); }
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

  const isFormValid = (): boolean => {
    if (!form.prompt.trim()) return false;
    const t = form.type;
    if (['multipleChoice', 'listenAndChoose', 'tapWhatYouHear'].includes(t)) {
      const opts = form.options.filter((o) => o.text.trim());
      if (opts.length < 2) return false;
      if (opts.filter((o) => o.isCorrect).length !== 1) return false;
    }
    if (t === 'fillInBlank' && form.sentenceTemplate && !form.sentenceTemplate.includes('___')) return false;
    if (t === 'matchPairs') {
      if (form.matchPairs.filter((p) => p.leftText.trim() && p.rightText.trim()).length < 2) return false;
    }
    if ((t === 'reorderWords' || t === 'translateSentence') && form.wordBankSentence.trim().split(/\s+/).length < 3) return false;
    if (t === 'completeConversation' && !form.conversationLines.some((l) => l.isUserTurn)) return false;
    return true;
  };

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

  // ─── Render ──────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={[s.safeArea, s.centered]}>
        <ActivityIndicator size="large" color={TG.accent} />
      </SafeAreaView>
    );
  }
  if (!lesson) {
    return (
      <SafeAreaView style={[s.safeArea, s.centered]}>
        <Text style={s.errorText}>Lesson not found</Text>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}><Text style={s.backBtnText}>Go Back</Text></TouchableOpacity>
      </SafeAreaView>
    );
  }

  const exercises = [...(lesson.exercises || [])].sort((a, b) => a.order - b.order);

  const renderExerciseCard = ({ item, index }: { item: Exercise; index: number }) => (
    <View style={s.exCard}>
      <View style={s.exHeader}>
        <View style={[s.exTypeBadge, { backgroundColor: DIFFICULTY_OPTIONS[(item.difficulty || 1) - 1]?.color + '15' }]}>
          <Text style={s.exTypeIcon}>{getTypeIcon(item.type)}</Text>
          <Text style={s.exTypeText}>{index + 1}. {getTypeLabel(item.type)}</Text>
        </View>
        <View style={s.exActions}>
          <TouchableOpacity onPress={() => duplicateExercise(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Copy size={15} color={TG.textHint} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => openEditExercise(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={s.editLink}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Trash2 size={15} color={TG.red} />
          </TouchableOpacity>
        </View>
      </View>
      <Text style={s.exPrompt} numberOfLines={2}>{item.prompt}</Text>
      <View style={s.exMeta}>
        <View style={[s.diffBadge, { backgroundColor: DIFFICULTY_OPTIONS[(item.difficulty || 1) - 1]?.color + '20' }]}>
          <Text style={[s.diffText, { color: DIFFICULTY_OPTIONS[(item.difficulty || 1) - 1]?.color }]}>
            {DIFFICULTY_OPTIONS[(item.difficulty || 1) - 1]?.label}
          </Text>
        </View>
        <Text style={s.xpLabel}>+{item.xpReward || 10} XP</Text>
      </View>
      {item.correctAnswer && <Text style={s.exAnswer}>✓ {item.correctAnswer}</Text>}
      {item.options?.length > 0 && (
        <View style={s.exOptionsRow}>
          {item.options.map((opt) => (
            <View key={opt.id} style={[s.exOptChip, opt.isCorrect && s.exOptChipCorrect]}>
              <Text style={[s.exOptText, opt.isCorrect && s.exOptTextCorrect]}>{opt.text}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  // ─── Type-specific fields ────────────────────────────────

  const renderTypeSpecificFields = () => {
    const t = form.type;

    return (
      <>
        {['listenRepeat', 'listenAndChoose', 'tapWhatYouHear', 'pronunciation'].includes(t) && (
          <>
            <Text style={s.label}>Audio URL</Text>
            <TextInput style={s.input} value={form.audioUrl} onChangeText={(v) => updateForm({ audioUrl: v })} placeholder="https://..." placeholderTextColor={TG.textHint} />
          </>
        )}

        {['listenRepeat', 'pronunciation'].includes(t) && (
          <>
            <Text style={s.label}>Target Text</Text>
            <TextInput style={s.input} value={form.targetText} onChangeText={(v) => updateForm({ targetText: v })} placeholder="Text the student should say" placeholderTextColor={TG.textHint} />
          </>
        )}

        {t === 'fillInBlank' && (
          <>
            <Text style={s.label}>Sentence Template (use ___ for blank)</Text>
            <TextInput style={s.input} value={form.sentenceTemplate} onChangeText={(v) => updateForm({ sentenceTemplate: v })} placeholder='I ___ to school yesterday' placeholderTextColor={TG.textHint} />
            <Text style={s.label}>Correct Answer (for typing mode)</Text>
            <TextInput style={s.input} value={form.correctAnswer} onChangeText={(v) => updateForm({ correctAnswer: v })} placeholder="went" placeholderTextColor={TG.textHint} />
          </>
        )}

        {t === 'speakTheAnswer' && (
          <>
            <Text style={s.label}>Image URL (optional context)</Text>
            <TextInput style={s.input} value={form.imageUrl} onChangeText={(v) => updateForm({ imageUrl: v })} placeholder="https://..." placeholderTextColor={TG.textHint} />
          </>
        )}

        {(['multipleChoice', 'listenAndChoose', 'tapWhatYouHear'].includes(t) || t === 'fillInBlank') && (
          <>
            <Text style={s.label}>
              Options {t === 'fillInBlank' ? '(optional — for dropdown mode)' : '*'}
            </Text>
            {form.options.map((opt, i) => (
              <View key={i} style={s.optionRow}>
                <TouchableOpacity
                  style={[s.correctToggle, opt.isCorrect && s.correctToggleActive]}
                  onPress={() => updateOption(i, { isCorrect: !opt.isCorrect })}
                >
                  {opt.isCorrect && <Check size={14} color="#fff" />}
                </TouchableOpacity>
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  value={opt.text}
                  onChangeText={(v) => updateOption(i, { text: v })}
                  placeholder={`Option ${i + 1}`}
                  placeholderTextColor={TG.textHint}
                />
                {form.options.length > 2 && (
                  <TouchableOpacity onPress={() => removeOption(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <X size={16} color={TG.textHint} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            <TouchableOpacity style={s.addRowBtn} onPress={addOption}>
              <Plus size={14} color={TG.accent} /><Text style={s.addRowText}>Add Option</Text>
            </TouchableOpacity>
          </>
        )}

        {t === 'matchPairs' && (
          <>
            <Text style={s.label}>Match Pairs *</Text>
            {form.matchPairs.map((pair, i) => (
              <View key={i} style={s.pairRow}>
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  value={pair.leftText}
                  onChangeText={(v) => updatePair(i, { leftText: v })}
                  placeholder="Left"
                  placeholderTextColor={TG.textHint}
                />
                <Text style={s.pairArrow}>↔</Text>
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  value={pair.rightText}
                  onChangeText={(v) => updatePair(i, { rightText: v })}
                  placeholder="Right"
                  placeholderTextColor={TG.textHint}
                />
                {form.matchPairs.length > 2 && (
                  <TouchableOpacity onPress={() => removePair(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
            <Text style={s.label}>Correct Sentence *</Text>
            <TextInput
              style={s.input}
              value={form.wordBankSentence}
              onChangeText={(v) => updateForm({ wordBankSentence: v })}
              placeholder="She has been studying English"
              placeholderTextColor={TG.textHint}
            />
            {form.wordBankSentence.trim() && (
              <View style={s.wordPreview}>
                {form.wordBankSentence.trim().split(/\s+/).map((w, i) => (
                  <View key={i} style={s.wordChip}><Text style={s.wordChipText}>{w}</Text></View>
                ))}
              </View>
            )}
            <Text style={s.label}>Distractors (wrong words)</Text>
            {form.distractors.map((d, i) => (
              <View key={i} style={s.optionRow}>
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  value={d}
                  onChangeText={(v) => updateDistractor(i, v)}
                  placeholder="Wrong word"
                  placeholderTextColor={TG.textHint}
                />
                <TouchableOpacity onPress={() => removeDistractor(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
            <Text style={s.label}>Conversation Lines *</Text>
            {form.conversationLines.map((line, i) => (
              <View key={i} style={[s.convoCard, line.isUserTurn && s.convoCardUser]}>
                <View style={s.convoHeader}>
                  <TextInput
                    style={[s.input, { flex: 1 }]}
                    value={line.speaker}
                    onChangeText={(v) => updateConvoLine(i, { speaker: v })}
                    placeholder="Speaker"
                    placeholderTextColor={TG.textHint}
                  />
                  <TouchableOpacity
                    style={[s.userToggle, line.isUserTurn && s.userToggleActive]}
                    onPress={() => updateConvoLine(i, { isUserTurn: !line.isUserTurn, speaker: !line.isUserTurn ? 'You' : 'Bot' })}
                  >
                    <Text style={[s.userToggleText, line.isUserTurn && s.userToggleTextActive]}>
                      {line.isUserTurn ? 'User Turn' : 'Bot'}
                    </Text>
                  </TouchableOpacity>
                  {form.conversationLines.length > 1 && (
                    <TouchableOpacity onPress={() => removeConvoLine(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <X size={16} color={TG.textHint} />
                    </TouchableOpacity>
                  )}
                </View>
                <TextInput
                  style={s.input}
                  value={line.text}
                  onChangeText={(v) => updateConvoLine(i, { text: v })}
                  placeholder={line.isUserTurn ? 'Expected response (or leave blank)' : 'Bot says...'}
                  placeholderTextColor={TG.textHint}
                  multiline
                />
                {line.isUserTurn && t === 'completeConversation' && (
                  <TextInput
                    style={[s.input, { marginTop: 6 }]}
                    value={line.acceptedAnswers}
                    onChangeText={(v) => updateConvoLine(i, { acceptedAnswers: v })}
                    placeholder="Accepted answers (comma separated)"
                    placeholderTextColor={TG.textHint}
                  />
                )}
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

  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ArrowLeft size={22} color={TG.textWhite} />
        </TouchableOpacity>
        <Text style={s.topTitle} numberOfLines={1}>Lesson Builder</Text>
        <View style={{ width: 22 }} />
      </View>

      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={s.contentWrap}
        ListHeaderComponent={
          <View style={s.lessonHeader}>
            <Text style={s.lessonTitle}>{lesson.title}</Text>
            <View style={s.badge}><Text style={s.badgeText}>{lesson.unit.title}</Text></View>
            <Text style={s.exCount}>{exercises.length} exercise{exercises.length !== 1 ? 's' : ''}</Text>
          </View>
        }
        data={exercises}
        keyExtractor={(e) => String(e.id)}
        renderItem={renderExerciseCard}
        ListFooterComponent={
          <TouchableOpacity style={s.addBtn} onPress={openAddExercise} activeOpacity={0.7}>
            <Plus size={20} color={TG.textWhite} />
            <Text style={s.addBtnText}>Add Exercise</Text>
          </TouchableOpacity>
        }
      />

      {/* ─── Exercise Editor Modal ──────────────────────── */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={s.modalSafe}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={22} color={TG.textPrimary} />
              </TouchableOpacity>
              <Text style={s.modalTitle}>{editExerciseId ? 'Edit Exercise' : 'Create Exercise'}</Text>
              <TouchableOpacity
                onPress={handleSave}
                disabled={!isFormValid() || submitting}
                style={[s.saveHeaderBtn, (!isFormValid() || submitting) && { opacity: 0.4 }]}
              >
                {submitting ? <ActivityIndicator size="small" color={TG.accent} /> : <Text style={s.saveHeaderText}>Save</Text>}
              </TouchableOpacity>
            </View>

            <ScrollView style={s.modalScroll} contentContainerStyle={s.modalContent} keyboardShouldPersistTaps="handled">
              {/* Exercise Type Selector */}
              <Text style={s.label}>Exercise Type</Text>
              {EXERCISE_TYPE_GROUPS.map((group) => (
                <View key={group.label}>
                  <Text style={s.groupLabel}>{group.label}</Text>
                  <View style={s.typeGrid}>
                    {group.types.map((t) => (
                      <TouchableOpacity
                        key={t.key}
                        style={[s.typeCard, form.type === t.key && s.typeCardActive]}
                        onPress={() => updateForm({ type: t.key })}
                      >
                        <Text style={s.typeCardIcon}>{t.icon}</Text>
                        <Text style={[s.typeCardLabel, form.type === t.key && s.typeCardLabelActive]} numberOfLines={1}>
                          {t.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}

              {/* Prompt */}
              <Text style={s.label}>Prompt *</Text>
              <TextInput
                style={[s.input, { minHeight: 60 }]}
                value={form.prompt}
                onChangeText={(v) => updateForm({ prompt: v })}
                placeholder="What does 'ubiquitous' mean?"
                placeholderTextColor={TG.textHint}
                multiline
              />

              {renderTypeSpecificFields()}

              {/* Advanced section */}
              <TouchableOpacity style={s.advancedToggle} onPress={() => setShowAdvanced(!showAdvanced)}>
                <Text style={s.advancedToggleText}>Advanced Settings</Text>
                {showAdvanced ? <ChevronUp size={16} color={TG.textSecondary} /> : <ChevronDown size={16} color={TG.textSecondary} />}
              </TouchableOpacity>

              {showAdvanced && (
                <>
                  <Text style={s.label}>Difficulty</Text>
                  <View style={s.diffRow}>
                    {DIFFICULTY_OPTIONS.map((d) => (
                      <TouchableOpacity
                        key={d.value}
                        style={[s.diffOption, form.difficulty === d.value && { backgroundColor: d.color + '20', borderColor: d.color }]}
                        onPress={() => updateForm({ difficulty: d.value })}
                      >
                        <Text style={[s.diffOptionText, form.difficulty === d.value && { color: d.color, fontWeight: '700' }]}>
                          {d.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={s.label}>XP Reward</Text>
                  <TextInput
                    style={s.input}
                    value={String(form.xpReward)}
                    onChangeText={(v) => updateForm({ xpReward: parseInt(v) || 10 })}
                    keyboardType="numeric"
                    placeholderTextColor={TG.textHint}
                  />

                  <Text style={s.label}>Explanation (shown after answering)</Text>
                  <TextInput
                    style={[s.input, { minHeight: 56 }]}
                    value={form.explanation}
                    onChangeText={(v) => updateForm({ explanation: v })}
                    placeholder="Shown after the student answers..."
                    placeholderTextColor={TG.textHint}
                    multiline
                  />

                  <Text style={s.label}>Hints</Text>
                  {form.hints.map((h, i) => (
                    <View key={i} style={s.optionRow}>
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
              )}

              <View style={{ height: 60 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TG.headerBg },
  centered: { alignItems: 'center', justifyContent: 'center' },
  errorText: { color: TG.textSecondary, fontSize: 16, marginBottom: 16 },
  backBtn: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: TG.bg, borderRadius: 8 },
  backBtnText: { color: TG.textPrimary, fontWeight: '600' },

  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: TG.headerBg },
  topTitle: { fontSize: 18, fontWeight: '700', color: TG.textWhite, flex: 1, textAlign: 'center' },

  contentWrap: { padding: 16, paddingBottom: 40, backgroundColor: TG.bgSecondary, flexGrow: 1 },

  lessonHeader: { marginBottom: 20 },
  lessonTitle: { fontSize: 22, fontWeight: '800', color: TG.textPrimary, marginBottom: 8 },
  badge: { alignSelf: 'flex-start', backgroundColor: TG.accentLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: '700', color: TG.accent },
  exCount: { fontSize: 13, color: TG.textSecondary, marginTop: 8 },

  exCard: { backgroundColor: TG.bg, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: TG.separatorLight },
  exHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  exTypeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: TG.bgSecondary },
  exTypeIcon: { fontSize: 14 },
  exTypeText: { fontSize: 11, fontWeight: '700', color: TG.textSecondary },
  exActions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  editLink: { fontSize: 13, color: TG.accent, fontWeight: '600' },
  exPrompt: { fontSize: 15, fontWeight: '600', color: TG.textPrimary, marginBottom: 8, lineHeight: 21 },
  exMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  diffBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  diffText: { fontSize: 11, fontWeight: '700' },
  xpLabel: { fontSize: 12, color: TG.gold, fontWeight: '700' },
  exAnswer: { fontSize: 13, color: TG.green, fontWeight: '600', backgroundColor: TG.green + '10', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start', overflow: 'hidden', marginTop: 4 },
  exOptionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  exOptChip: { backgroundColor: TG.bgSecondary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  exOptChipCorrect: { backgroundColor: TG.green + '15' },
  exOptText: { fontSize: 12, color: TG.textSecondary },
  exOptTextCorrect: { color: TG.green, fontWeight: '600' },

  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: TG.accent, padding: 16, borderRadius: 16, marginTop: 12 },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  modalSafe: { flex: 1, backgroundColor: TG.bg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: TG.separator },
  modalTitle: { fontSize: 17, fontWeight: '700', color: TG.textPrimary },
  saveHeaderBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  saveHeaderText: { fontSize: 16, fontWeight: '700', color: TG.accent },
  modalScroll: { flex: 1 },
  modalContent: { padding: 16, paddingBottom: 40 },

  label: { fontSize: 13, fontWeight: '600', color: TG.textSecondary, marginBottom: 6, marginTop: 16 },
  groupLabel: { fontSize: 12, fontWeight: '700', color: TG.textHint, marginTop: 12, marginBottom: 6, textTransform: 'uppercase' },
  input: { backgroundColor: TG.bgSecondary, borderWidth: 1, borderColor: TG.separator, borderRadius: 10, padding: 12, fontSize: 15, color: TG.textPrimary },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeCard: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: TG.bgSecondary, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: TG.separator },
  typeCardActive: { backgroundColor: TG.accentLight, borderColor: TG.accent },
  typeCardIcon: { fontSize: 16 },
  typeCardLabel: { fontSize: 13, color: TG.textPrimary },
  typeCardLabelActive: { color: TG.accent, fontWeight: '700' },

  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  correctToggle: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: TG.separator, justifyContent: 'center', alignItems: 'center' },
  correctToggleActive: { backgroundColor: TG.scoreGreen, borderColor: TG.scoreGreen },
  addRowBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, paddingVertical: 6 },
  addRowText: { fontSize: 13, color: TG.accent, fontWeight: '600' },

  pairRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  pairArrow: { fontSize: 16, color: TG.textHint },

  wordPreview: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, marginBottom: 4 },
  wordChip: { backgroundColor: TG.accentLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  wordChipText: { fontSize: 13, color: TG.accent, fontWeight: '600' },

  convoCard: { backgroundColor: TG.bgSecondary, borderRadius: 12, padding: 12, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: TG.separator },
  convoCardUser: { borderLeftColor: TG.accent },
  convoHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  userToggle: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: TG.bg, borderWidth: 1, borderColor: TG.separator },
  userToggleActive: { backgroundColor: TG.accent, borderColor: TG.accent },
  userToggleText: { fontSize: 12, fontWeight: '600', color: TG.textSecondary },
  userToggleTextActive: { color: '#fff' },

  advancedToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, paddingVertical: 12, borderTopWidth: 0.5, borderTopColor: TG.separator },
  advancedToggleText: { fontSize: 15, fontWeight: '600', color: TG.textSecondary },
  diffRow: { flexDirection: 'row', gap: 10 },
  diffOption: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1.5, borderColor: TG.separator },
  diffOptionText: { fontSize: 14, color: TG.textSecondary },
});
