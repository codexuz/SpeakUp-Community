import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import { apiLogin } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { useRouter } from 'expo-router';
import { Eye, EyeOff, MessageCircle } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const { login } = useAuth();
  const toast = useToast();

  const handleLogin = async () => {
    if (!username || !password) return toast.error('Error', 'Please enter both fields.');

    setLoading(true);
    try {
      const data = await apiLogin(username, password);

      login({
        token: data.token,
        user: {
          id: data.user.id,
          username: data.user.username,
          fullName: data.user.fullName,
          role: data.user.role,
          avatarUrl: data.user.avatarUrl,
          gender: data.user.gender,
          region: data.user.region,
        },
      });
      router.replace('/(tabs)');
    } catch (e: any) {
      toast.error('Error', e.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const isButtonDisabled = !username || !password || loading;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.iconContainer}>
            <MessageCircle size={44} color={TG.accent} strokeWidth={1.5} />
          </View>
          <Text style={styles.title}>SpeakUp</Text>
          <Text style={styles.subtitle}>Sign in to continue your IELTS journey</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. johndoe"
              placeholderTextColor={TG.textHint}
              autoCapitalize="none"
              value={username}
              onChangeText={setUsername}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter your password"
                placeholderTextColor={TG.textHint}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(prev => !prev)}
                style={styles.eyeBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {showPassword ? (
                  <EyeOff size={20} color={TG.textHint} />
                ) : (
                  <Eye size={20} color={TG.textHint} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, isButtonDisabled && styles.primaryButtonDisabled]}
            onPress={handleLogin}
            disabled={isButtonDisabled}
            activeOpacity={0.7}
          >
            {loading ? (
              <ActivityIndicator color={TG.textWhite} />
            ) : (
              <Text style={styles.primaryButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <View style={styles.signupContainer}>
            <Text style={styles.signupText}>Don&apos;t have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')} activeOpacity={0.7}>
              <Text style={styles.signupLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: TG.bg,
  },
  content: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
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
    fontSize: 28,
    fontWeight: '700',
    color: TG.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: TG.textSecondary,
    marginBottom: 36,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 16,
  },
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
  primaryButtonDisabled: {
    backgroundColor: TG.separator,
  },
  primaryButtonText: {
    color: TG.textWhite,
    fontSize: 16,
    fontWeight: '700',
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 28,
  },
  signupText: {
    color: TG.textSecondary,
    fontSize: 14,
  },
  signupLink: {
    color: TG.accent,
    fontWeight: '600',
    fontSize: 14,
  },
});
