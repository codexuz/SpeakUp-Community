import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import { apiRequestPasswordReset } from '@/lib/api';
import { useRouter } from 'expo-router';
import { ArrowLeft, Send } from 'lucide-react-native';
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

export default function ForgotPasswordScreen() {
  const [login, setLogin] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const toast = useToast();

  const handleRequest = async () => {
    if (!login.trim()) return toast.error('Error', 'Please enter your username or phone.');
    setLoading(true);
    try {
      await apiRequestPasswordReset(login.trim());
      toast.success('Code Sent', 'Check your Telegram for the reset code.');
      router.push({ pathname: '/(auth)/reset-password', params: { login: login.trim() } } as any);
    } catch (e: any) {
      toast.error('Error', e.message || 'Failed to request reset code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <ArrowLeft size={22} color={TG.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.iconContainer}>
            <Send size={36} color={TG.accent} strokeWidth={1.5} />
          </View>
          <Text style={styles.title}>Forgot Password</Text>
          <Text style={styles.subtitle}>
            Enter your username or phone number. We&apos;ll send a 6-digit reset code to your linked Telegram account.
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Username or Phone</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. johndoe or +998901234567"
              placeholderTextColor={TG.textHint}
              autoCapitalize="none"
              value={login}
              onChangeText={setLogin}
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, (!login.trim() || loading) && styles.primaryButtonDisabled]}
            onPress={handleRequest}
            disabled={!login.trim() || loading}
            activeOpacity={0.7}
          >
            {loading ? <ActivityIndicator color={TG.textWhite} /> : <Text style={styles.primaryButtonText}>Send Reset Code</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TG.bg },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  content: {
    flexGrow: 1,
    padding: 24,
  },
  iconContainer: {
    alignSelf: 'center',
    marginBottom: 16,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: TG.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: TG.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: TG.textSecondary,
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 20,
  },
  inputGroup: { marginBottom: 16 },
  label: {
    color: TG.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    marginLeft: 4,
  },
  input: {
    backgroundColor: TG.bgSecondary,
    borderRadius: 12,
    padding: 16,
    color: TG.textPrimary,
    fontSize: 16,
    borderWidth: 0.5,
    borderColor: TG.separator,
  },
  primaryButton: {
    backgroundColor: TG.accent,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  primaryButtonDisabled: { backgroundColor: TG.separator },
  primaryButtonText: {
    color: TG.textWhite,
    fontSize: 16,
    fontWeight: '700',
  },
});
