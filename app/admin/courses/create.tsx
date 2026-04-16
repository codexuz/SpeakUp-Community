import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import { apiCreateCourse } from '@/lib/api';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { ArrowLeft, Check, Image as ImageIcon } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const LEVELS = ['A2', 'B1', 'B2', 'C1'];

export default function CreateCourseScreen() {
  const router = useRouter();
  const toast = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState('B1');
  const [isPublished, setIsPublished] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setImageUri(result.assets[0].uri);
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.warning('Validation', 'Title is required');
      return;
    }
    if (!description.trim()) {
      toast.warning('Validation', 'Description is required');
      return;
    }
    setCreating(true);
    try {
      await apiCreateCourse({
        title: title.trim(),
        description: description.trim(),
        level,
        imageUri: imageUri || undefined,
        isPublished,
      });
      toast.success('Done', 'Course created successfully');
      router.back();
    } catch (e: any) {
      toast.error('Error', e.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <ArrowLeft size={22} color={TG.textWhite} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Course</Text>
        </View>

        <ScrollView style={{ flex: 1, backgroundColor: TG.bgSecondary }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          
          <Text style={styles.inputLabel}>Title *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Everyday Conversations"
            placeholderTextColor={TG.textHint}
          />

          <Text style={styles.inputLabel}>Description *</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
            value={description}
            onChangeText={setDescription}
            placeholder="What will users learn in this course?"
            placeholderTextColor={TG.textHint}
            multiline
          />

          <View style={styles.switchRow}>
            <View>
              <Text style={styles.inputLabel}>Publish Course?</Text>
              <Text style={styles.switchHint}>If disabled, the course will be saved as a draft.</Text>
            </View>
            <Switch
              value={isPublished}
              onValueChange={setIsPublished}
              trackColor={{ false: TG.separator, true: TG.accent }}
              thumbColor={Platform.OS === 'ios' ? '#fff' : isPublished ? TG.accentLight : '#f4f3f4'}
            />
          </View>

          <Text style={styles.inputLabel}>Level *</Text>
          <View style={styles.levelRow}>
            {LEVELS.map((lvl) => (
              <TouchableOpacity
                key={lvl}
                style={[styles.levelBtn, level === lvl && styles.levelBtnActive]}
                onPress={() => setLevel(lvl)}
                activeOpacity={0.7}
              >
                {level === lvl && <Check size={14} color="#fff" style={{ marginRight: 4 }} />}
                <Text style={[styles.levelBtnText, level === lvl && styles.levelBtnTextActive]}>{lvl}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.inputLabel}>Cover Image</Text>
          <TouchableOpacity style={styles.imagePicker} onPress={handlePickImage} activeOpacity={0.7}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.previewImage} />
            ) : (
              <View style={styles.imagePickerPlaceholder}>
                <ImageIcon size={28} color={TG.textHint} />
                <Text style={styles.imagePickerText}>Tap to select image</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.submitBtn, (creating || !title.trim() || !description.trim()) && { opacity: 0.5 }]}
            activeOpacity={0.7}
            onPress={handleCreate}
            disabled={creating || !title.trim() || !description.trim()}
          >
            {creating ? (
              <ActivityIndicator size="small" color={TG.textWhite} />
            ) : (
              <Text style={styles.submitBtnText}>Create Course</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
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
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: TG.textWhite },
  
  content: { padding: 16, paddingBottom: 40 },
  inputLabel: { fontSize: 13, color: TG.textSecondary, fontWeight: '600', marginBottom: 6 },
  input: {
    backgroundColor: TG.bg,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: TG.textPrimary,
    borderWidth: 0.5,
    borderColor: TG.separator,
    marginBottom: 16,
  },
  
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    marginBottom: 20,
    backgroundColor: TG.bgSecondary,
    padding: 12,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: TG.separator,
  },
  switchHint: { fontSize: 12, color: TG.textHint },
  
  levelRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  levelBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TG.bg,
    borderWidth: 1,
    borderColor: TG.separator,
    paddingVertical: 10,
    borderRadius: 8,
  },
  levelBtnActive: {
    backgroundColor: TG.accent,
    borderColor: TG.accent,
  },
  levelBtnText: { color: TG.textPrimary, fontWeight: '600', fontSize: 14 },
  levelBtnTextActive: { color: '#fff' },

  imagePicker: {
    backgroundColor: TG.bg,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: TG.separator,
    marginBottom: 24,
    overflow: 'hidden',
  },
  imagePickerPlaceholder: {
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  imagePickerText: { fontSize: 13, color: TG.textHint },
  previewImage: {
    width: '100%',
    height: 160,
    resizeMode: 'cover',
  },
  submitBtn: {
    backgroundColor: TG.accent,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 10,
  },
  submitBtnText: { color: TG.textWhite, fontWeight: '700', fontSize: 16 },
});
