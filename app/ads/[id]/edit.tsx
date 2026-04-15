import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import { Ad, apiFetchAdById, apiUpdateAd } from '@/lib/api';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Image as ImageIcon } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
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

export default function EditAdScreen() {
  const router = useRouter();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [ad, setAd] = useState<Ad | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [adText, setAdText] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const data = await apiFetchAdById(Number(id));
        setAd(data);
        setTitle(data.title);
        setLinkUrl(data.linkUrl || '');
        setAdText(data.adText || '');
        setIsActive(data.isActive);
      } catch (e: any) {
        toast.error('Error', e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

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

  const handleSave = async () => {
    if (!ad) return;
    setSaving(true);
    try {
      await apiUpdateAd(ad.id, {
        title: title.trim() || undefined,
        linkUrl: linkUrl.trim() || undefined,
        adText: adText.trim() || undefined,
        imageUri: imageUri || undefined,
        isActive,
      });
      toast.success('Done', 'Ad updated');
      router.back();
    } catch (e: any) {
      toast.error('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center', backgroundColor: TG.bgSecondary }]}>
        <ActivityIndicator size="large" color={TG.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={22} color={TG.textWhite} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Ad</Text>
        </View>

        <ScrollView style={{ flex: 1, backgroundColor: TG.bgSecondary }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.inputLabel}>Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Ad title"
            placeholderTextColor={TG.textHint}
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

          <Text style={styles.inputLabel}>Image</Text>
          <TouchableOpacity style={styles.imagePicker} onPress={handlePickImage} activeOpacity={0.7}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.previewImage} />
            ) : ad?.imageUrl ? (
              <Image source={{ uri: ad.imageUrl }} style={styles.previewImage} />
            ) : (
              <View style={styles.imagePickerPlaceholder}>
                <ImageIcon size={28} color={TG.textHint} />
                <Text style={styles.imagePickerText}>Tap to change image</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Active</Text>
            <Switch
              value={isActive}
              onValueChange={setIsActive}
              trackColor={{ false: TG.separator, true: TG.accent }}
              thumbColor={TG.textWhite}
            />
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, saving && { opacity: 0.5 }]}
            activeOpacity={0.7}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={TG.textWhite} />
            ) : (
              <Text style={styles.submitBtnText}>Save Changes</Text>
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
  imagePicker: {
    backgroundColor: TG.bg,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: TG.separator,
    marginBottom: 16,
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: TG.bg,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 0.5,
    borderColor: TG.separator,
    marginBottom: 24,
  },
  switchLabel: { fontSize: 15, fontWeight: '600', color: TG.textPrimary },
  submitBtn: {
    backgroundColor: TG.accent,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 10,
  },
  submitBtnText: { color: TG.textWhite, fontWeight: '700', fontSize: 16 },
});
