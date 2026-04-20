import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import { apiBroadcastNotification } from '@/lib/api';
import { useRouter } from 'expo-router';
import { ArrowLeft, Bell, Send } from 'lucide-react-native';
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

export default function AdminNotificationsScreen() {
  const router = useRouter();
  const toast = useToast();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; message: string } | null>(null);

  const handleSend = async () => {
    if (!title.trim()) {
      toast.warning('Validation', 'Title is required');
      return;
    }
    if (!body.trim()) {
      toast.warning('Validation', 'Message body is required');
      return;
    }

    setSending(true);
    setResult(null);
    try {
      const res = await apiBroadcastNotification({ title: title.trim(), body: body.trim() });
      setResult(res);
      toast.success('Sent!', `Notification delivered to ${res.sent} users`);
      setTitle('');
      setBody('');
    } catch (e: any) {
      toast.error('Failed', e.message || 'Could not send notification');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} activeOpacity={0.7}>
          <ArrowLeft size={24} color={TG.textWhite} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Send Notification</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={{ flex: 1, backgroundColor: TG.bg }}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Icon */}
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Bell size={28} color={TG.accent} strokeWidth={1.8} />
            </View>
            <Text style={styles.subtitle}>Broadcast to all users</Text>
          </View>

          {/* Title input */}
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. App Update v2.1 🚀"
            placeholderTextColor={TG.textHint}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />

          {/* Body input */}
          <Text style={styles.label}>Message</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Write your notification message..."
            placeholderTextColor={TG.textHint}
            value={body}
            onChangeText={setBody}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            maxLength={500}
          />

          {/* Character counts */}
          <View style={styles.countsRow}>
            <Text style={styles.countText}>{title.length}/100</Text>
            <Text style={styles.countText}>{body.length}/500</Text>
          </View>

          {/* Preview */}
          {(title.trim() || body.trim()) ? (
            <View style={styles.previewCard}>
              <Text style={styles.previewLabel}>Preview</Text>
              <View style={styles.previewContent}>
                <View style={styles.previewIcon}>
                  <Bell size={16} color={TG.accent} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.previewTitle} numberOfLines={1}>{title || 'Title'}</Text>
                  <Text style={styles.previewBody} numberOfLines={2}>{body || 'Message body'}</Text>
                </View>
              </View>
            </View>
          ) : null}

          {/* Result */}
          {result && (
            <View style={styles.resultCard}>
              <Text style={styles.resultText}>
                ✅ Sent to {result.sent} user{result.sent !== 1 ? 's' : ''}
              </Text>
            </View>
          )}

          {/* Send button */}
          <TouchableOpacity
            style={[styles.sendBtn, (!title.trim() || !body.trim() || sending) && styles.sendBtnDisabled]}
            activeOpacity={0.75}
            onPress={handleSend}
            disabled={!title.trim() || !body.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Send size={18} color="#fff" strokeWidth={2} />
                <Text style={styles.sendBtnText}>Send to All Users</Text>
              </>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: TG.textWhite },
  content: { padding: 20, paddingBottom: 40 },

  iconContainer: { alignItems: 'center', marginBottom: 24 },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: TG.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  subtitle: { fontSize: 14, color: TG.textSecondary, fontWeight: '500' },

  label: {
    fontSize: 13,
    fontWeight: '600',
    color: TG.textSecondary,
    marginBottom: 6,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: TG.bgSecondary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: TG.textPrimary,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: TG.separator,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  countsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    marginTop: -4,
  },
  countText: { fontSize: 12, color: TG.textHint },

  previewCard: {
    backgroundColor: TG.bgSecondary,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: TG.separator,
  },
  previewLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: TG.textHint,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  previewContent: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  previewIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: TG.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  previewTitle: { fontSize: 14, fontWeight: '700', color: TG.textPrimary },
  previewBody: { fontSize: 13, color: TG.textSecondary, marginTop: 2, lineHeight: 18 },

  resultCard: {
    backgroundColor: TG.greenLight,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  resultText: { fontSize: 14, fontWeight: '600', color: TG.green },

  sendBtn: {
    backgroundColor: TG.accent,
    borderRadius: 12,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
