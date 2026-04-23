import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import { useDeleteAccount } from '@/hooks/useDeleteAccount';
import { useRouter } from 'expo-router';
import { AlertTriangle, Lock } from 'lucide-react-native';
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

export default function DeleteAccountPage() {
  const router = useRouter();
  const toast = useToast();
  const { deleteAccount, loading } = useDeleteAccount();
  const [password, setPassword] = useState('');

  const handleDelete = async () => {
    try {
      await deleteAccount(password.trim());
    } catch (e: any) {
      toast.error('Error', e.message);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Warning icon */}
          <View style={styles.iconWrap}>
            <AlertTriangle size={48} color={TG.red} />
          </View>

          <Text style={styles.title}>Delete Account</Text>
          <Text style={styles.subtitle}>
            This will permanently delete your account and all your data. This action{' '}
            <Text style={styles.bold}>cannot be undone.</Text>
          </Text>

          {/* What gets deleted */}
          <View style={styles.warningCard}>
            {[
              'All your recordings and responses',
              'Your progress, XP, and achievements',
              'Your followers and following',
              'Your community posts and comments',
            ].map((item) => (
              <View key={item} style={styles.warningRow}>
                <View style={styles.bullet} />
                <Text style={styles.warningText}>{item}</Text>
              </View>
            ))}
          </View>

          {/* Password field */}
          <Text style={styles.inputLabel}>Confirm with your password</Text>
          <View style={styles.inputWrap}>
            <Lock size={18} color={TG.textHint} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor={TG.textHint}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Actions */}
          <TouchableOpacity
            style={[styles.deleteBtn, (loading || !password.trim()) && styles.disabledBtn]}
            activeOpacity={0.8}
            onPress={handleDelete}
            disabled={loading || !password.trim()}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.deleteBtnText}>Delete My Account</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelBtn}
            activeOpacity={0.7}
            onPress={() => router.back()}
            disabled={loading}
          >
            <Text style={styles.cancelBtnText}>Back</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: TG.bg,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
  },
  iconWrap: {
    alignSelf: 'center',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: TG.redLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: TG.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: TG.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  bold: {
    fontWeight: '700',
    color: TG.red,
  },
  warningCard: {
    backgroundColor: TG.redLight,
    borderRadius: 12,
    padding: 16,
    marginBottom: 28,
    gap: 10,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: TG.red,
  },
  warningText: {
    fontSize: 14,
    color: TG.red,
    flex: 1,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: TG.textPrimary,
    marginBottom: 8,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: TG.separator,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: TG.bgSecondary,
    marginBottom: 24,
    height: 50,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: TG.textPrimary,
  },
  deleteBtn: {
    backgroundColor: TG.red,
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  disabledBtn: {
    opacity: 0.45,
  },
  deleteBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  cancelBtn: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TG.bgSecondary,
    borderRadius: 12,
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: TG.textSecondary,
  },
});
