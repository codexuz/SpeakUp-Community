import { apiLogin } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Lock, LogIn, User } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!username || !password) return Alert.alert('Error', 'Please enter both fields.');

    setLoading(true);
    try {
      const data = await apiLogin(username, password);

      login({
        id: data.id,
        username: data.username,
        fullName: data.fullName,
        role: data.role,
        avatarUrl: data.avatarUrl,
        gender: data.gender,
        region: data.region,
      });
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const isButtonDisabled = !username || !password || loading;

  return (
    <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
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
               <LogIn size={48} color="#3b82f6" strokeWidth={1.5} />
            </View>
            <Text style={styles.title}>Welcome Back!</Text>
            <Text style={styles.subtitle}>Sign in to continue your IELTS journey</Text>

            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                  <User size={18} color="#94a3b8" />
                  <Text style={styles.label}>Username</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="e.g. johndoe"
                placeholderTextColor="#64748b"
                autoCapitalize="none"
                value={username}
                onChangeText={setUsername}
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                  <Lock size={18} color="#94a3b8" />
                  <Text style={styles.label}>Password</Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#64748b"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>

            <View style={{ marginTop: 24 }}>
                <TouchableOpacity
                    style={[
                        styles.primaryButton, 
                        isButtonDisabled && styles.primaryButtonDisabled,
                        !isButtonDisabled && styles.successButton
                    ]}
                    onPress={handleLogin}
                    disabled={isButtonDisabled}
                    activeOpacity={0.8}
                >
                    {loading ? (
                       <ActivityIndicator color="#fff" />
                    ) : (
                       <Text style={styles.primaryButtonText}>Sign In</Text>
                    )}
                </TouchableOpacity>
            </View>

            <View style={styles.signupContainer}>
              <Text style={styles.signupText}>Don&apos;t have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/register')} activeOpacity={0.7}>
                <Text style={styles.signupLink}>CREATE ACCOUNT</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  iconContainer: {
      alignSelf: 'center',
      marginBottom: 24,
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: '#1e293b',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: '#334155'
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#f8fafc',
    marginBottom: 8,
    textAlign: 'center'
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 40,
    textAlign: 'center'
  },
  
  inputGroup: {
      marginBottom: 20
  },
  labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
      marginLeft: 4,
  },
  label: { 
      color: '#94a3b8', 
      fontSize: 14, 
      fontWeight: '700', 
      textTransform: 'uppercase' 
  },
  
  input: {
    backgroundColor: '#1e293b',
    borderWidth: 2,
    borderColor: '#334155',
    borderRadius: 16,
    padding: 20,
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  
  primaryButton: { 
      backgroundColor: '#3b82f6', 
      borderRadius: 16, 
      paddingVertical: 18, 
      alignItems: 'center',
      borderBottomWidth: 4,
      borderColor: '#2563eb'
  },
  successButton: { 
      backgroundColor: '#22c55e',
      borderColor: '#16a34a'
  },
  primaryButtonDisabled: { 
      backgroundColor: '#334155',
      borderColor: '#1e293b',
      borderBottomWidth: 2,
      transform: [{translateY: 2}]
  },
  primaryButtonText: { 
      color: '#fff', 
      fontSize: 18, 
      fontWeight: '800', 
      textTransform: 'uppercase', 
      letterSpacing: 0.5 
  },

  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
  },
  signupText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600'
  },
  signupLink: {
    color: '#3b82f6',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.5
  },
});
