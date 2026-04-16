import { useAlert } from '@/components/CustomAlert';
import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import { apiCreateExercise, apiDeleteExercise, apiFetchLesson } from '@/lib/api';
import { Exercise, LessonDetail } from '@/lib/types';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Check, Plus, Trash2 } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const EXERCISE_TYPES = [
  'listenRepeat',
  'speakTheAnswer',
  'fillInBlank',
  'multipleChoice',
  'reorderWords',
  'matchPairs',
  'translate',
] as const;

export default function LessonBuilderScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const toast = useToast();
  const { alert } = useAlert();

  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [type, setType] = useState<typeof EXERCISE_TYPES[number]>('listenRepeat');
  const [prompt, setPrompt] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [optionsStr, setOptionsStr] = useState('');
  const [hintsStr, setHintsStr] = useState('');

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

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleDelete = (exercise: Exercise) => {
    alert('Delete Exercise', 'Are you sure you want to delete this exercise?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiDeleteExercise(exercise.id);
            load();
          } catch (e: any) {
            toast.error('Error', e.message);
          }
        },
      },
    ], 'destructive');
  };

  const handleSave = async () => {
    if (!prompt.trim() || !lesson) return;
    setSubmitting(true);
    try {
      const options = optionsStr.trim() ? optionsStr.split(',').map((s) => s.trim()) : null;
      const hints = hintsStr.trim() ? hintsStr.split(',').map((s) => s.trim()) : null;

      await apiCreateExercise({
        lessonId: lesson.id,
        type,
        prompt: prompt.trim(),
        correctAnswer: correctAnswer.trim() || null,
        options,
        hints,
      });

      toast.success('Done', 'Exercise added');
      setShowForm(false);
      setPrompt('');
      setCorrectAnswer('');
      setOptionsStr('');
      setHintsStr('');
      load();
    } catch (e: any) {
      toast.error('Error', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.centered]}>
        <ActivityIndicator size="large" color={TG.accent} />
      </SafeAreaView>
    );
  }

  if (!lesson) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.centered]}>
        <Text style={styles.errorText}>Lesson not found</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const renderHeader = () => (
    <View style={styles.lessonHeader}>
      <Text style={styles.lessonTitle}>{lesson.title}</Text>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{lesson.unit.title}</Text>
      </View>
    </View>
  );

  const renderExercise = ({ item, index }: { item: Exercise; index: number }) => (
    <View style={styles.exCard}>
      <View style={styles.exHeader}>
        <View style={styles.exTypeBadge}>
          <Text style={styles.exTypeText}>{index + 1}. {item.type}</Text>
        </View>
        <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Trash2 size={16} color={TG.red} />
        </TouchableOpacity>
      </View>
      <Text style={styles.exPrompt}>{item.prompt}</Text>
      {item.correctAnswer && <Text style={styles.exAnswer}>Answer: {item.correctAnswer}</Text>}
      {item.options && item.options.length > 0 && (
        <View style={styles.exOptions}>
          {item.options.map((opt, i) => (
            <View key={i} style={styles.exOptBadge}><Text style={styles.exOptText}>{opt}</Text></View>
          ))}
        </View>
      )}
    </View>
  );

  const renderForm = () => {
    if (!showForm) {
      return (
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(true)} activeOpacity={0.7}>
          <Plus size={20} color={TG.textWhite} />
          <Text style={styles.addBtnText}>Add Exercise</Text>
        </TouchableOpacity>
      );
    }

    return (
      <View style={styles.formContainer}>
        <Text style={styles.formTitle}>New Exercise</Text>
        
        <Text style={styles.label}>Exercise Type</Text>
        <View style={styles.typeGrid}>
          {EXERCISE_TYPES.map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.typeBtn, type === t && styles.typeBtnActive]}
              onPress={() => setType(t)}
            >
              {type === t && <Check size={14} color="#fff" style={{ marginRight: 4 }} />}
              <Text style={[styles.typeBtnText, type === t && styles.typeBtnTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Prompt *</Text>
        <TextInput
          style={styles.input}
          value={prompt}
          onChangeText={setPrompt}
          placeholder="e.g. Listen and repeat: 'Hello!'"
          placeholderTextColor={TG.textHint}
        />

        <Text style={styles.label}>Correct Answer</Text>
        <TextInput
          style={styles.input}
          value={correctAnswer}
          onChangeText={setCorrectAnswer}
          placeholder="Required for translate, fillInBlank..."
          placeholderTextColor={TG.textHint}
        />

        {type === 'multipleChoice' && (
          <>
            <Text style={styles.label}>Options (comma separated)</Text>
            <TextInput
              style={styles.input}
              value={optionsStr}
              onChangeText={setOptionsStr}
              placeholder="Apple, Banana, Orange"
              placeholderTextColor={TG.textHint}
            />
          </>
        )}

        <Text style={styles.label}>Hints (comma separated)</Text>
        <TextInput
          style={styles.input}
          value={hintsStr}
          onChangeText={setHintsStr}
          placeholder="Hint 1, Hint 2"
          placeholderTextColor={TG.textHint}
        />

        <View style={styles.formActions}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowForm(false)}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveBtn, (!prompt.trim() || submitting) && { opacity: 0.5 }]}
            onPress={handleSave}
            disabled={!prompt.trim() || submitting}
          >
            {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>Save Exercise</Text>}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <ArrowLeft size={22} color={TG.textWhite} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Lesson Builder</Text>
          <View style={{ width: 22 }} />
        </View>

        <FlatList
          style={{ flex: 1 }}
          contentContainerStyle={styles.contentWrap}
          ListHeaderComponent={renderHeader}
          data={lesson.exercises || []}
          keyExtractor={(e) => String(e.id)}
          renderItem={renderExercise}
          ListFooterComponent={renderForm}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TG.headerBg },
  centered: { alignItems: 'center', justifyContent: 'center' },
  errorText: { color: TG.textSecondary, fontSize: 16, marginBottom: 16 },
  backBtn: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: TG.bg, borderRadius: 8 },
  backBtnText: { color: TG.textPrimary, fontWeight: '600' },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: TG.headerBg,
  },
  topTitle: { fontSize: 18, fontWeight: '700', color: TG.textWhite },

  contentWrap: { padding: 16, paddingBottom: 40, backgroundColor: TG.bgSecondary, flexGrow: 1 },

  lessonHeader: { marginBottom: 20 },
  lessonTitle: { fontSize: 22, fontWeight: '800', color: TG.textPrimary, marginBottom: 8 },
  badge: { alignSelf: 'flex-start', backgroundColor: TG.accentLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: '700', color: TG.accent },

  exCard: { backgroundColor: TG.bg, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: TG.separatorLight },
  exHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  exTypeBadge: { backgroundColor: TG.bgSecondary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  exTypeText: { fontSize: 11, fontWeight: '700', color: TG.textSecondary },
  exPrompt: { fontSize: 15, fontWeight: '600', color: TG.textPrimary, marginBottom: 8 },
  exAnswer: { fontSize: 13, color: TG.green, fontWeight: '600', backgroundColor: TG.green + '15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start', overflow: 'hidden' },
  exOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  exOptBadge: { backgroundColor: TG.bgSecondary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  exOptText: { fontSize: 12, color: TG.textSecondary },

  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: TG.accent, padding: 16, borderRadius: 16, marginTop: 12 },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  formContainer: { backgroundColor: TG.bg, borderRadius: 16, padding: 16, marginTop: 12 },
  formTitle: { fontSize: 18, fontWeight: '700', color: TG.textPrimary, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: TG.textSecondary, marginBottom: 6, marginTop: 12 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: TG.bgSecondary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: TG.separator },
  typeBtnActive: { backgroundColor: TG.accent, borderColor: TG.accent },
  typeBtnText: { fontSize: 13, color: TG.textPrimary },
  typeBtnTextActive: { color: '#fff', fontWeight: '600' },
  input: { backgroundColor: TG.bgSecondary, borderWidth: 1, borderColor: TG.separator, borderRadius: 10, padding: 12, fontSize: 15, color: TG.textPrimary },
  
  formActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: TG.separatorLight, alignItems: 'center' },
  cancelBtnText: { color: TG.textSecondary, fontWeight: '600', fontSize: 16 },
  saveBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: TG.accent, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
