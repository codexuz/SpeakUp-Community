import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import { apiConfirmPasswordReset } from '@/lib/api';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Eye, EyeOff, ShieldCheck } from 'lucide-react-native';
import React, { useRef, useState } from 'react';
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

const CODE_LENGTH = 6;

export default function ResetPasswordScreen() {
  const { login } = useLocalSearchParams<{ login: string }>();
  const router = useRouter();
  const toast = useToast();

  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const fullCode = code.join('');
  const isValid = fullCode.length === CODE_LENGTH && newPassword.length >= 6;

  const handleCodeChange = (text: string, index: number) => {
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const updated = [...code];
    updated[index] = digit;
    setCode(updated);

    if (digit && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleConfirm = async () => {
    if (!isValid) return;
    setLoading(true);
    try {
      await apiConfirmPasswordReset(login || '', fullCode, newPassword);
      toast.success('Success', 'Password has been reset. Please log in.');
      router.replace('/(auth)/login');
    } catch (e: any) {
      toast.error('Error', e.message || 'Failed to reset password.');
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
            <ShieldCheck size={36} color={TG.green} strokeWidth={1.5} />
          </View>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>
            Enter the 6-digit code sent to your Telegram and choose a new password.
          </Text>

          {/* Code Input */}
          <View style={styles.codeRow}>
            {code.map((digit, i) => (
              <TextInput
                key={i}
                ref={(ref) => { inputRefs.current[i] = ref; }}
                style={[styles.codeInput, digit ? styles.codeInputFilled : null]}
                value={digit}
                onChangeText={(t) => handleCodeChange(t, i)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
                keyboardType="number-pad"
                maxLength={1}
                textAlign="center"
                selectTextOnFocus
              />
            ))}
          </View>

          {/* New Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>New Password</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Minimum 6 characters"
                placeholderTextColor={TG.textHint}
                secureTextEntry={!showPassword}
                value={newPassword}
                onChangeText={setNewPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((p) => !p)}
                style={styles.eyeBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {showPassword ? <EyeOff size={20} color={TG.textHint} /> : <Eye size={20} color={TG.textHint} />}
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, !isValid && styles.primaryButtonDisabled]}
            onPress={handleConfirm}
            disabled={!isValid || loading}
            activeOpacity={0.7}
          >
            {loading ? <ActivityIndicator color={TG.textWhite} /> : <Text style={styles.primaryButtonText}>Reset Password</Text>}
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
    backgroundColor: TG.greenLight,
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
    marginBottom: 28,
    textAlign: 'center',
    lineHeight: 20,
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 28,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderRadius: 12,
    backgroundColor: TG.bgSecondary,
    borderWidth: 1.5,
    borderColor: TG.separator,
    fontSize: 22,
    fontWeight: '700',
    color: TG.textPrimary,
  },
  codeInputFilled: {
    borderColor: TG.accent,
  },
  inputGroup: { marginBottom: 16 },
  label: {
    color: TG.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    marginLeft: 4,
  },
  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TG.bgSecondary,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: TG.separator,
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    color: TG.textPrimary,
    fontSize: 16,
  },
  eyeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 16,
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
