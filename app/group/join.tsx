import { TG } from '@/constants/theme';
import { joinGroupByCode } from '@/lib/groups';
import { useRouter } from 'expo-router';
import { ArrowLeft, LogIn, Ticket } from 'lucide-react-native';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function JoinGroupScreen() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleJoin = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 5) {
      Alert.alert('Invalid', 'Please enter a valid 5-character referral code');
      return;
    }
    setLoading(true);
    try {
      const group = await joinGroupByCode(trimmed);
      Alert.alert('Joined!', `You joined "${group?.name}" successfully.`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={22} color={TG.textWhite} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Join Group</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.iconBox}>
            <Ticket size={36} color={TG.green} strokeWidth={1.5} />
          </View>

          <Text style={styles.description}>
            Enter the 5-character referral code shared by your teacher to join their group.
          </Text>

          <Text style={styles.inputLabel}>Referral Code</Text>
          <TextInput
            ref={inputRef}
            style={styles.codeInput}
            placeholder="XXXXX"
            placeholderTextColor={TG.textHint}
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5))}
            autoFocus
            autoCapitalize="characters"
            maxLength={5}
            textAlign="center"
          />

          <TouchableOpacity
            style={[styles.joinBtn, (code.length < 5 || loading) && { opacity: 0.5 }]}
            activeOpacity={0.7}
            onPress={handleJoin}
            disabled={code.length < 5 || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={TG.textWhite} />
            ) : (
              <>
                <LogIn size={20} color={TG.textWhite} />
                <Text style={styles.joinBtnText}>Join Group</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TG.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TG.headerBg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: TG.textWhite },

  content: { padding: 24, alignItems: 'center' },
  iconBox: {
    marginBottom: 20,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: TG.greenLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  description: {
    fontSize: 15,
    color: TG.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 12,
  },

  inputLabel: {
    fontSize: 14,
    color: TG.textSecondary,
    fontWeight: '600',
    marginBottom: 6,
    alignSelf: 'flex-start',
    marginLeft: 4,
  },
  codeInput: {
    width: '100%',
    backgroundColor: TG.bgSecondary,
    borderRadius: 12,
    paddingVertical: 18,
    fontSize: 28,
    fontWeight: '700',
    color: TG.green,
    letterSpacing: 10,
    borderWidth: 0.5,
    borderColor: TG.separator,
    marginBottom: 24,
  },

  joinBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: TG.green,
    borderRadius: 12,
    paddingVertical: 16,
  },
  joinBtnText: { color: TG.textWhite, fontSize: 16, fontWeight: '700' },
});
