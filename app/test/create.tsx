import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import { apiCreateTest } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { useRouter } from 'expo-router';
import { ArrowLeft, BookOpen, FileText } from 'lucide-react-native';
import React, { useState } from 'react';
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

type TestType = 'cefr' | 'ielts';

export default function CreateTestScreen() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [testType, setTestType] = useState<TestType>('cefr');
  const [creating, setCreating] = useState(false);

  const isAllowed = user?.role === 'admin' || (user?.role === 'teacher' && user?.verifiedTeacher);

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.warning('Validation', 'Title is required');
      return;
    }
    setCreating(true);
    try {
      await apiCreateTest({
        title: title.trim(),
        description: description.trim() || undefined,
        testType,
      });
      toast.success('Created', 'Test created successfully');
      router.back();
    } catch (e: any) {
      toast.error('Error', e.message);
    } finally {
      setCreating(false);
    }
  };

  if (!isAllowed) {
    return (
      <SafeAreaView edges={['top']} style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: TG.textSecondary, fontSize: 16 }}>Verified teacher access required</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ArrowLeft size={22} color={TG.textWhite} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Test</Text>
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero Icon */}
          <View style={styles.heroIcon}>
            <BookOpen size={32} color={TG.accent} />
          </View>

          {/* Title */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Title <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. IELTS Speaking Part 1"
              placeholderTextColor={TG.textHint}
              autoFocus
            />
          </View>

          {/* Description */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Optional description of this test..."
              placeholderTextColor={TG.textHint}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Test Type */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Exam Type</Text>
            <View style={styles.typeRow}>
              <TouchableOpacity
                style={[styles.typeBtn, testType === 'cefr' && styles.typeBtnActive]}
                activeOpacity={0.7}
                onPress={() => setTestType('cefr')}
              >
                <FileText size={18} color={testType === 'cefr' ? '#fff' : TG.textSecondary} />
                <View>
                  <Text style={[styles.typeBtnTitle, testType === 'cefr' && styles.typeBtnTitleActive]}>CEFR</Text>
                  <Text style={[styles.typeBtnSub, testType === 'cefr' && styles.typeBtnSubActive]}>Score 0-75</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeBtn, testType === 'ielts' && styles.typeBtnActive]}
                activeOpacity={0.7}
                onPress={() => setTestType('ielts')}
              >
                <FileText size={18} color={testType === 'ielts' ? '#fff' : TG.textSecondary} />
                <View>
                  <Text style={[styles.typeBtnTitle, testType === 'ielts' && styles.typeBtnTitleActive]}>IELTS</Text>
                  <Text style={[styles.typeBtnSub, testType === 'ielts' && styles.typeBtnSubActive]}>Band 0-9.0</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        {/* Bottom Action */}
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.cancelBtn} activeOpacity={0.7} onPress={() => router.back()}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.createBtn, (creating || !title.trim()) && { opacity: 0.5 }]}
            activeOpacity={0.7}
            onPress={handleCreate}
            disabled={creating || !title.trim()}
          >
            {creating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.createBtnText}>Create Test</Text>
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: TG.textWhite, flex: 1 },

  scrollView: { flex: 1, backgroundColor: TG.bgSecondary },
  scrollContent: { padding: 20, paddingBottom: 40 },

  heroIcon: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: TG.accentLight,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: 28,
  },

  fieldGroup: { marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '700', color: TG.textPrimary, marginBottom: 8 },
  required: { color: TG.red },
  input: {
    backgroundColor: TG.bg,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: TG.textPrimary,
    borderWidth: 1,
    borderColor: TG.separator,
  },
  textArea: { minHeight: 100 },

  typeRow: { flexDirection: 'row', gap: 12 },
  typeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: TG.bg, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    borderWidth: 1, borderColor: TG.separator,
  },
  typeBtnActive: { backgroundColor: TG.accent, borderColor: TG.accent },
  typeBtnTitle: { fontSize: 15, fontWeight: '700', color: TG.textPrimary },
  typeBtnTitleActive: { color: '#fff' },
  typeBtnSub: { fontSize: 12, color: TG.textSecondary, marginTop: 2 },
  typeBtnSubActive: { color: 'rgba(255,255,255,0.8)' },

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
  createBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    backgroundColor: TG.accent, alignItems: 'center',
  },
  createBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
