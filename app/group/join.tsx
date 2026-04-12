import { joinGroupByCode } from '@/lib/groups';
import { useAuth } from '@/store/auth';
import { LinearGradient } from 'expo-linear-gradient';
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

export default function JoinGroupScreen() {
  const router = useRouter();
  const { user } = useAuth();
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
      const group = await joinGroupByCode(trimmed, user!.id);
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
    <View style={styles.container}>
      <LinearGradient colors={['#0f172a', '#1e293b']} style={StyleSheet.absoluteFillObject} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Join Group</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.iconBox}>
            <Ticket size={40} color="#10b981" strokeWidth={1.5} />
          </View>

          <Text style={styles.description}>
            Enter the 5-character referral code shared by your teacher to join their group.
          </Text>

          <Text style={styles.inputLabel}>REFERRAL CODE</Text>
          <TextInput
            ref={inputRef}
            style={styles.codeInput}
            placeholder="XXXXX"
            placeholderTextColor="#475569"
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5))}
            autoFocus
            autoCapitalize="characters"
            maxLength={5}
            textAlign="center"
          />

          <TouchableOpacity
            style={[styles.joinBtn, (code.length < 5 || loading) && { opacity: 0.5 }]}
            activeOpacity={0.8}
            onPress={handleJoin}
            disabled={code.length < 5 || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <LogIn size={22} color="#fff" />
                <Text style={styles.joinBtnText}>JOIN GROUP</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
    gap: 12,
  },
  backBtn: { padding: 8, backgroundColor: '#1e293b', borderRadius: 12, borderWidth: 2, borderColor: '#334155' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },

  content: { padding: 24, alignItems: 'center' },
  iconBox: {
    marginBottom: 24,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderBottomWidth: 5,
  },
  description: {
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    fontWeight: '500',
    paddingHorizontal: 12,
  },

  inputLabel: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.5,
    alignSelf: 'flex-start',
  },
  codeInput: {
    width: '100%',
    backgroundColor: '#0f172a',
    borderRadius: 16,
    paddingVertical: 20,
    fontSize: 32,
    fontWeight: '800',
    color: '#10b981',
    letterSpacing: 12,
    borderWidth: 2,
    borderColor: '#334155',
    marginBottom: 28,
  },

  joinBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#10b981',
    borderRadius: 16,
    paddingVertical: 18,
    borderBottomWidth: 4,
    borderColor: '#059669',
  },
  joinBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 1 },
});
