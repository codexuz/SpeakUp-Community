import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import { apiCreateQuestion, apiFetchQuestion, apiUpdateQuestion } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
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

const PARTS = ['Part 1', 'Part 2', 'Part 3'];

export default function QuestionFormScreen() {
  const { testId, questionId } = useLocalSearchParams<{ testId: string; questionId?: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const isEdit = !!questionId;
  const isAllowed = user?.role === 'admin' || (user?.role === 'teacher' && user?.verifiedTeacher);

  const [qText, setQText] = useState('');
  const [part, setPart] = useState('Part 1');
  const [image, setImage] = useState('');
  const [speakingTimer, setSpeakingTimer] = useState('30');
  const [prepTimer, setPrepTimer] = useState('5');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit && questionId) {
      setLoading(true);
      apiFetchQuestion(Number(questionId))
        .then((q: any) => {
          setQText(q.qText ?? q.q_text ?? '');
          setPart(q.part ?? 'Part 1');
          setImage(q.image ?? '');
          setSpeakingTimer(String(q.speakingTimer ?? q.speaking_timer ?? 30));
          setPrepTimer(String(q.prepTimer ?? q.prep_timer ?? 5));
        })
        .catch((e: any) => toast.error('Error', e.message))
        .finally(() => setLoading(false));
    }
  }, [isEdit, questionId]);

  const handleSave = async () => {
    if (!qText.trim()) {
      toast.warning('Validation', 'Question text is required');
      return;
    }

    const speak = parseInt(speakingTimer, 10);
    const prep = parseInt(prepTimer, 10);
    if (isNaN(speak) || speak < 1) {
      toast.warning('Validation', 'Speaking timer must be at least 1 second');
      return;
    }
    if (isNaN(prep) || prep < 0) {
      toast.warning('Validation', 'Prep timer must be 0 or more seconds');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        qText: qText.trim(),
        part,
        image: image.trim() || undefined,
        speakingTimer: speak,
        prepTimer: prep,
      };

      if (isEdit) {
        await apiUpdateQuestion(Number(questionId), payload);
      } else {
        await apiCreateQuestion(Number(testId), payload);
      }
      router.back();
    } catch (e: any) {
      toast.error('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isAllowed) {
    return (
      <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: TG.textSecondary, fontSize: 16 }}>Verified teacher access required</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <ArrowLeft size={22} color={TG.textWhite} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEdit ? 'Edit Question' : 'New Question'}</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={TG.accent} />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Question Text *</Text>
            <TextInput
              style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
              value={qText}
              onChangeText={setQText}
              placeholder="Enter the speaking question..."
              placeholderTextColor={TG.textHint}
              multiline
            />

            <Text style={styles.label}>Part</Text>
            <View style={styles.partRow}>
              {PARTS.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.partChip, part === p && styles.partChipActive]}
                  onPress={() => setPart(p)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.partChipText, part === p && styles.partChipTextActive]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Image URL (optional)</Text>
            <TextInput
              style={styles.input}
              value={image}
              onChangeText={setImage}
              placeholder="https://example.com/image.jpg"
              placeholderTextColor={TG.textHint}
              autoCapitalize="none"
              keyboardType="url"
            />

            <View style={styles.timerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Speaking Timer (s)</Text>
                <TextInput
                  style={styles.input}
                  value={speakingTimer}
                  onChangeText={setSpeakingTimer}
                  placeholder="30"
                  placeholderTextColor={TG.textHint}
                  keyboardType="number-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Prep Timer (s)</Text>
                <TextInput
                  style={styles.input}
                  value={prepTimer}
                  onChangeText={setPrepTimer}
                  placeholder="5"
                  placeholderTextColor={TG.textHint}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <View style={{ height: 24 }} />

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.5 }]}
              onPress={handleSave}
              activeOpacity={0.7}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={TG.textWhite} />
              ) : (
                <Text style={styles.saveBtnText}>{isEdit ? 'Update Question' : 'Create Question'}</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TG.bgSecondary },
  header: {
    backgroundColor: TG.headerBg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: TG.textWhite, flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  form: {
    padding: 16,
    paddingBottom: 60,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: TG.textSecondary,
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    backgroundColor: TG.bg,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: TG.textPrimary,
    borderWidth: 0.5,
    borderColor: TG.separator,
  },

  partRow: {
    flexDirection: 'row',
    gap: 8,
  },
  partChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: TG.bg,
    borderWidth: 0.5,
    borderColor: TG.separator,
  },
  partChipActive: {
    backgroundColor: TG.accent,
    borderColor: TG.accent,
  },
  partChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: TG.textSecondary,
  },
  partChipTextActive: {
    color: TG.textWhite,
  },

  timerRow: {
    flexDirection: 'row',
    gap: 12,
  },

  saveBtn: {
    backgroundColor: TG.accent,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: {
    color: TG.textWhite,
    fontSize: 16,
    fontWeight: '700',
  },
});
