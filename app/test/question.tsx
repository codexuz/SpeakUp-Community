import { useToast } from '@/components/Toast';
import WaveformPlayer from '@/components/WaveformPlayer';
import { TG } from '@/constants/theme';
import { apiCreateQuestion, apiFetchQuestion, apiTextToSpeech, apiUpdateQuestion, TTSVoice } from '@/lib/api';
import { useAuth } from '@/store/auth';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ImagePlus, Trash2, Volume2, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
const VOICES: TTSVoice[] = ['erin', 'george', 'lisa', 'emily', 'nick'];

export default function QuestionFormScreen() {
  const { testId, questionId } = useLocalSearchParams<{ testId: string; questionId?: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const isEdit = !!questionId;
  const isAllowed = user?.role === 'admin' || (user?.role === 'teacher' && user?.verifiedTeacher);

  const [qText, setQText] = useState('');
  const [part, setPart] = useState('Part 1');
  const [imageUri, setImageUri] = useState<string | null>(null);   // local file URI (new pick)
  const [imageUrl, setImageUrl] = useState<string | null>(null);   // remote URL (existing)
  const [speakingTimer, setSpeakingTimer] = useState('30');
  const [prepTimer, setPrepTimer] = useState('5');
  const [audioUrl, setAudioUrl] = useState('');
  const [voice, setVoice] = useState<TTSVoice>('erin');
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const displayImage = imageUri || imageUrl;

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setImageUri(result.assets[0].uri);
  };

  const handleRemoveImage = () => {
    setImageUri(null);
    setImageUrl(null);
  };

  useEffect(() => {
    if (isEdit && questionId) {
      setLoading(true);
      apiFetchQuestion(Number(questionId))
        .then((q: any) => {
          setQText(q.qText ?? q.q_text ?? '');
          setPart(q.part ?? 'Part 1');
          const img = q.image ?? q.imageUrl ?? q.image_url ?? '';
          if (img) setImageUrl(img);
          setSpeakingTimer(String(q.speakingTimer ?? q.speaking_timer ?? 30));
          setPrepTimer(String(q.prepTimer ?? q.prep_timer ?? 5));
          setAudioUrl(q.audioUrl ?? q.audio_url ?? '');
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
        imageUri: imageUri || undefined,
        audioUrl: (audioUrl || '').trim() || undefined,
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

            <Text style={styles.label}>Image</Text>
            {displayImage ? (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: displayImage }} style={styles.imagePreview} />
                <TouchableOpacity style={styles.imageRemoveBtn} onPress={handleRemoveImage} activeOpacity={0.7}>
                  <X size={16} color={TG.textWhite} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.imageChangeBtn} onPress={handlePickImage} activeOpacity={0.7}>
                  <Text style={styles.imageChangeBtnText}>Change</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.imagePickerBtn} onPress={handlePickImage} activeOpacity={0.7}>
                <ImagePlus size={24} color={TG.textHint} />
                <Text style={styles.imagePickerText}>Tap to add image</Text>
              </TouchableOpacity>
            )}

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

            <Text style={styles.label}>Audio</Text>
            {!!(audioUrl || '').trim() ? (
              <View style={styles.audioSection}>
                <View style={styles.playerWrapper}>
                  <WaveformPlayer uri={(audioUrl || '').trim()} />
                </View>
                <TouchableOpacity
                  style={styles.audioRemoveBtn}
                  onPress={() => setAudioUrl('')}
                  activeOpacity={0.7}
                >
                  <Trash2 size={15} color={TG.red} />
                  <Text style={styles.audioRemoveText}>Remove audio</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.audioPlaceholder}>
                <Volume2 size={20} color={TG.textHint} />
                <Text style={styles.audioPlaceholderText}>No audio — generate below</Text>
              </View>
            )}

            <Text style={[styles.label, { marginTop: 10 }]}>Generate Audio from Text</Text>
            <View style={styles.voiceRow}>
              {VOICES.map((v) => (
                <TouchableOpacity
                  key={v}
                  style={[styles.voiceChip, voice === v && styles.voiceChipActive]}
                  onPress={() => setVoice(v)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.voiceChipText, voice === v && styles.voiceChipTextActive]}>
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.generateBtn, (generating || !qText.trim()) && { opacity: 0.5 }]}
              onPress={async () => {
                if (!qText.trim()) {
                  toast.warning('Validation', 'Enter question text first');
                  return;
                }
                setGenerating(true);
                try {
                  const result = await apiTextToSpeech(qText.trim(), voice);
                  setAudioUrl(result.url ?? '');
                  toast.success('Done', 'Audio generated');
                } catch (e: any) {
                  toast.error('Error', e.message);
                } finally {
                  setGenerating(false);
                }
              }}
              activeOpacity={0.7}
              disabled={generating || !qText.trim()}
            >
              {generating ? (
                <ActivityIndicator size="small" color={TG.accent} />
              ) : (
                <>
                  <Volume2 size={18} color={TG.accent} />
                  <Text style={styles.generateBtnText}>Generate Audio</Text>
                </>
              )}
            </TouchableOpacity>

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

  imagePickerBtn: {
    backgroundColor: TG.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TG.separator,
    borderStyle: 'dashed',
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  imagePickerText: {
    fontSize: 14,
    color: TG.textHint,
  },
  imagePreviewContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: TG.bg,
  },
  imagePreview: {
    width: '100%',
    height: 180,
    borderRadius: 12,
  },
  imageRemoveBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderRadius: 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageChangeBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  imageChangeBtnText: {
    color: TG.textWhite,
    fontSize: 12,
    fontWeight: '600',
  },

  audioSection: {
    gap: 8,
  },
  audioRemoveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingVertical: 4,
  },
  audioRemoveText: {
    fontSize: 13,
    color: TG.red,
    fontWeight: '500',
  },
  audioPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: TG.bg,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 0.5,
    borderColor: TG.separator,
  },
  audioPlaceholderText: {
    fontSize: 14,
    color: TG.textHint,
  },

  timerRow: {
    flexDirection: 'row',
    gap: 12,
  },

  voiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  voiceChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: TG.bg,
    borderWidth: 0.5,
    borderColor: TG.separator,
  },
  voiceChipActive: {
    backgroundColor: TG.accent,
    borderColor: TG.accent,
  },
  voiceChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: TG.textSecondary,
  },
  voiceChipTextActive: {
    color: TG.textWhite,
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: TG.bg,
    borderWidth: 0.5,
    borderColor: TG.accent,
  },
  generateBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: TG.accent,
  },
  playerWrapper: {
    marginTop: 14,
    backgroundColor: TG.bg,
    borderRadius: 12,
    padding: 10,
    borderWidth: 0.5,
    borderColor: TG.separator,
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
