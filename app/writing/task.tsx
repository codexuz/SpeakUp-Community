import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import { apiCreateWritingTask, apiFetchWritingTasks, apiUpdateWritingTask } from '@/lib/api';
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

const PARTS = ['Task 1', 'Task 2'];

export default function WritingTaskFormScreen() {
  const { testId, taskId } = useLocalSearchParams<{ testId: string; taskId?: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const isEdit = !!taskId;
  const isAllowed = user?.role === 'admin' || (user?.role === 'teacher' && user?.verifiedTeacher);

  const [taskText, setTaskText] = useState('');
  const [part, setPart] = useState('Task 1');
  const [minWords, setMinWords] = useState('150');
  const [maxWords, setMaxWords] = useState('250');
  const [timeLimit, setTimeLimit] = useState('1200');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit && taskId && testId) {
      setLoading(true);
      apiFetchWritingTasks(Number(testId))
        .then((tasks) => {
          const task = tasks.find((t) => String(t.id) === taskId);
          if (task) {
            setTaskText(task.taskText);
            setPart(task.part);
            setMinWords(String(task.minWords));
            setMaxWords(String(task.maxWords));
            setTimeLimit(String(task.timeLimit));
          }
        })
        .catch((e: any) => toast.error('Error', e.message))
        .finally(() => setLoading(false));
    }
  }, [isEdit, taskId, testId]);

  const handleSave = async () => {
    if (!taskText.trim()) {
      toast.warning('Validation', 'Task text is required');
      return;
    }

    const min = parseInt(minWords, 10);
    const max = parseInt(maxWords, 10);
    const time = parseInt(timeLimit, 10);

    if (isNaN(min) || min < 1) {
      toast.warning('Validation', 'Min words must be at least 1');
      return;
    }
    if (isNaN(max) || max < min) {
      toast.warning('Validation', 'Max words must be greater than min words');
      return;
    }
    if (isNaN(time) || time < 60) {
      toast.warning('Validation', 'Time limit must be at least 60 seconds');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        taskText: taskText.trim(),
        part,
        minWords: min,
        maxWords: max,
        timeLimit: time,
      };

      if (isEdit) {
        await apiUpdateWritingTask(Number(taskId), payload);
      } else {
        await apiCreateWritingTask(Number(testId), payload);
      }
      toast.success(isEdit ? 'Updated' : 'Created', `Task ${isEdit ? 'updated' : 'created'} successfully`);
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
        <Text style={styles.headerTitle}>{isEdit ? 'Edit Task' : 'New Task'}</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={TG.accent} />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            style={{ flex: 1, backgroundColor: TG.bgSecondary }}
            contentContainerStyle={styles.form}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.label}>Task Text <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={[styles.input, { minHeight: 120, textAlignVertical: 'top' }]}
              value={taskText}
              onChangeText={setTaskText}
              placeholder="Describe the writing task prompt..."
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

            <View style={styles.timerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Min Words</Text>
                <TextInput
                  style={styles.input}
                  value={minWords}
                  onChangeText={setMinWords}
                  keyboardType="number-pad"
                  placeholder="150"
                  placeholderTextColor={TG.textHint}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Max Words</Text>
                <TextInput
                  style={styles.input}
                  value={maxWords}
                  onChangeText={setMaxWords}
                  keyboardType="number-pad"
                  placeholder="250"
                  placeholderTextColor={TG.textHint}
                />
              </View>
            </View>

            <Text style={styles.label}>Time Limit (seconds)</Text>
            <TextInput
              style={styles.input}
              value={timeLimit}
              onChangeText={setTimeLimit}
              keyboardType="number-pad"
              placeholder="1200 (20 min)"
              placeholderTextColor={TG.textHint}
            />
            <Text style={styles.hint}>{Math.floor(parseInt(timeLimit, 10) / 60) || 0} minutes</Text>
          </ScrollView>

          <View style={styles.bottomBar}>
            <TouchableOpacity style={styles.cancelBtn} activeOpacity={0.7} onPress={() => router.back()}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, (saving || !taskText.trim()) && { opacity: 0.5 }]}
              activeOpacity={0.7}
              onPress={handleSave}
              disabled={saving || !taskText.trim()}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>{isEdit ? 'Save Changes' : 'Create Task'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
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
  form: { padding: 20, paddingBottom: 40 },
  label: { fontSize: 14, fontWeight: '700', color: TG.textPrimary, marginBottom: 8, marginTop: 16 },
  required: { color: TG.red },
  hint: { fontSize: 12, color: TG.textHint, marginTop: 4 },
  input: {
    backgroundColor: TG.bg, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: TG.textPrimary,
    borderWidth: 1, borderColor: TG.separator,
  },
  partRow: { flexDirection: 'row', gap: 10 },
  partChip: {
    paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 14, backgroundColor: TG.bg,
    borderWidth: 1, borderColor: TG.separator,
  },
  partChipActive: { backgroundColor: TG.accent, borderColor: TG.accent },
  partChipText: { fontSize: 14, fontWeight: '600', color: TG.textSecondary },
  partChipTextActive: { color: '#fff' },
  timerRow: { flexDirection: 'row', gap: 12 },
  bottomBar: {
    flexDirection: 'row', gap: 12,
    paddingHorizontal: 20, paddingVertical: 16,
    backgroundColor: TG.bg,
    borderTopWidth: 1, borderTopColor: TG.separator,
  },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    backgroundColor: TG.bgSecondary, alignItems: 'center',
  },
  cancelBtnText: { fontSize: 16, fontWeight: '600', color: TG.textSecondary },
  saveBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    backgroundColor: TG.accent, alignItems: 'center',
  },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
