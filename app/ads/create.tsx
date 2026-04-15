import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import { apiCreateAd } from '@/lib/api';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { ArrowLeft, Image as ImageIcon } from 'lucide-react-native';
import React, { useState } from 'react';
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

export default function CreateAdScreen() {
  const router = useRouter();
  const toast = useToast();

  const [title, setTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [adText, setAdText] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const handlePickImage = async () => {
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
    if (!imageUri) {
      toast.warning('Validation', 'Image is required');
      return;
    }
    setCreating(true);
    try {
      await apiCreateAd(title.trim(), imageUri, linkUrl.trim() || undefined, adText.trim() || undefined);
      toast.success('Done', 'Ad created');
      router.back();
    } catch (e: any) {
      toast.error('Error', e.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={22} color={TG.textWhite} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Ad</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.inputLabel}>Title *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Ad title"
            placeholderTextColor={TG.textHint}
            autoFocus
          />

          <Text style={styles.inputLabel}>Link URL</Text>
          <TextInput
            style={styles.input}
            value={linkUrl}
            onChangeText={setLinkUrl}
            placeholder="https://example.com"
            placeholderTextColor={TG.textHint}
            autoCapitalize="none"
            keyboardType="url"
          />

          <Text style={styles.inputLabel}>Ad Text</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
            value={adText}
            onChangeText={setAdText}
            placeholder="Optional description shown on the banner"
            placeholderTextColor={TG.textHint}
            multiline
          />

          <Text style={styles.inputLabel}>Image *</Text>
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
            style={[styles.submitBtn, creating && { opacity: 0.5 }]}
            activeOpacity={0.7}
            onPress={handleCreate}
            disabled={creating}
          >
            {creating ? (
              <ActivityIndicator size="small" color={TG.textWhite} />
            ) : (
              <Text style={styles.submitBtnText}>Create Ad</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
    height: 200,
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
