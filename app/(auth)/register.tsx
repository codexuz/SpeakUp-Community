import { apiRegister } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ChevronLeft, Image as ImageIcon, MapPin, Shield, Sparkles, User } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const TOTAL_STEPS = 4;
const REGIONS = [
  'Tashkent', 'Andijan', 'Bukhara', 'Fergana', 'Jizzakh', 'Namangan', 'Navoiy', 'Kashkadarya', 'Samarkand', 'Syrdarya', 'Surkhandarya', 'Khorezm', 'Karakalpakstan'
];

export default function RegisterScreen() {
  const router = useRouter();
  const { login } = useAuth();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    username: '',
    fullName: '',
    gender: 'Male',
    region: 'Tashkent',
    avatarUrl: 'https://i.ibb.co/68vS1zZ/default-avatar.png',
    password: ''
  });

  // Animations
  const progressAnim = useRef(new Animated.Value(0.25)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: step / TOTAL_STEPS,
      duration: 300,
      useNativeDriver: false,
    }).start();

    // Trigger slide and fade for content
    slideAnim.setValue(50);
    fadeAnim.setValue(0);
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 50,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      })
    ]).start();
  }, [step]);

  const updateForm = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const nextStep = () => {
    if (step < TOTAL_STEPS) setStep(prev => prev + 1);
  };
  
  const prevStep = () => {
    if (step > 1) setStep(prev => prev - 1);
  };

  const handleRegister = async () => {
    if (!formData.username || !formData.fullName || !formData.password) {
      return Alert.alert('Error', 'Please fill all required fields');
    }
    
    setLoading(true);
    try {
      const data = await apiRegister({
        username: formData.username,
        fullName: formData.fullName,
        password: formData.password,
        gender: formData.gender,
        region: formData.region,
        avatarUrl: formData.avatarUrl,
      });
      
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
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const renderCurrentStep = () => {
    switch(step) {
      case 1:
        return (
          <View style={styles.stepContent}>
            <View style={styles.iconContainer}>
               <User size={48} color="#3b82f6" strokeWidth={1.5} />
            </View>
            <Text style={styles.stepTitle}>Let's get to know you!</Text>
            <Text style={styles.stepSubtitle}>Pick a username and enter your name</Text>
            <TextInput
              style={[styles.input, { marginBottom: 12 }]}
              placeholder="Choose a username"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
              value={formData.username}
              onChangeText={(text) => updateForm('username', text)}
              autoFocus
            />
            <TextInput
              style={styles.input}
              placeholder="Enter your full name"
              placeholderTextColor="#64748b"
              value={formData.fullName}
              onChangeText={(text) => updateForm('fullName', text)}
            />
          </View>
        );
      case 2:
        return (
          <View style={styles.stepContent}>
             <View style={styles.iconContainer}>
               <MapPin size={48} color="#10b981" strokeWidth={1.5} />
            </View>
            <Text style={styles.stepTitle}>Where are you from?</Text>
            <Text style={styles.stepSubtitle}>Select your home region</Text>
            <ScrollView style={styles.regionList} showsVerticalScrollIndicator={false}>
              {REGIONS.map(region => {
                const isActive = formData.region === region;
                return (
                  <TouchableOpacity
                    key={region}
                    style={[styles.choiceCard, isActive && styles.choiceCardActive]}
                    onPress={() => updateForm('region', region)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.choiceText, isActive && styles.choiceTextActive]}>
                      {region}
                    </Text>
                    {isActive && <View style={styles.activeDot} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        );
      case 3:
        return (
          <View style={styles.stepContent}>
            <View style={styles.iconContainer}>
               <Sparkles size={48} color="#8b5cf6" strokeWidth={1.5} />
            </View>
            <Text style={styles.stepTitle}>A bit more details</Text>
            <Text style={styles.stepSubtitle}>Help us personalize your experience</Text>
            
            <View style={styles.genderRow}>
              {['Male', 'Female'].map(g => {
                const isActive = formData.gender === g;
                return (
                  <TouchableOpacity
                    key={g}
                    style={[styles.genderCard, isActive && styles.genderCardActive]}
                    onPress={() => updateForm('gender', g)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.genderText, isActive && styles.genderTextActive]}>
                      {g}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.inputGroup}>
                <View style={styles.labelRow}>
                    <ImageIcon size={18} color="#94a3b8" />
                    <Text style={styles.label}>Avatar Image URL</Text>
                </View>
                <TextInput
                style={styles.input}
                placeholder="Optional image link..."
                placeholderTextColor="#64748b"
                value={formData.avatarUrl}
                onChangeText={(text) => updateForm('avatarUrl', text)}
                />
            </View>
          </View>
        );
      case 4:
        return (
          <View style={styles.stepContent}>
            <View style={styles.iconContainer}>
               <Shield size={48} color="#f59e0b" strokeWidth={1.5} />
            </View>
            <Text style={styles.stepTitle}>Keep it safe!</Text>
            <Text style={styles.stepSubtitle}>Create a password to secure your progress</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor="#64748b"
              secureTextEntry
              value={formData.password}
              onChangeText={(text) => updateForm('password', text)}
              autoFocus
            />
          </View>
        );
    }
  };

  const getButtonText = () => {
    if (step === 1 && (!formData.username || !formData.fullName)) return "Username & name required";
    if (step === 4 && !formData.password) return "Password required";
    if (step === 4) return "Create Account";
    return "Continue";
  };

  const isButtonDisabled = (step === 1 && (!formData.username || !formData.fullName)) || (step === 4 && !formData.password) || loading;

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%']
  });

  return (
    <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView 
          style={{ flex: 1 }} 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header & Progress Bar */}
          <View style={styles.header}>
              <TouchableOpacity onPress={step > 1 ? prevStep : () => router.back()} style={styles.backButton}>
                  <ChevronLeft color="#94a3b8" size={32} />
              </TouchableOpacity>
              
              <View style={styles.progressBarContainer}>
                  <Animated.View style={[styles.progressBarFill, { width: progressWidth }]} />
              </View>
          </View>

          {/* Animated Content Area */}
          <Animated.ScrollView 
             style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
             contentContainerStyle={{ flexGrow: 1 }}
             keyboardShouldPersistTaps="handled"
             showsVerticalScrollIndicator={false}
          >
            {renderCurrentStep()}
          </Animated.ScrollView>

          {/* Footer Navigation */}
          <View style={styles.footer}>
            <TouchableOpacity 
              style={[
                  styles.primaryButton, 
                  isButtonDisabled && styles.primaryButtonDisabled,
                  step === 4 && !isButtonDisabled && styles.successButton
              ]} 
              onPress={step < 4 ? nextStep : handleRegister}
              disabled={isButtonDisabled}
              activeOpacity={0.8}
            >
              {loading ? (
                  <ActivityIndicator color="#fff" />
              ) : (
                  <Text style={styles.primaryButtonText}>{getButtonText()}</Text>
              )}
            </TouchableOpacity>

            {step === 1 && (
              <TouchableOpacity onPress={() => router.push('/(auth)/login')} style={styles.loginLink}>
                <Text style={styles.loginLinkText}>ALREADY HAVE AN ACCOUNT?</Text>
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 20,
    gap: 16
  },
  backButton: {
    padding: 4,
  },
  progressBarContainer: {
    flex: 1,
    height: 12,
    backgroundColor: '#334155',
    borderRadius: 6,
    overflow: 'hidden',
    marginRight: 16,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 6,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  stepContent: {
    flex: 1,
    paddingTop: 20,
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
  stepTitle: { fontSize: 28, fontWeight: '800', color: '#f8fafc', marginBottom: 8, textAlign: 'center' },
  stepSubtitle: { fontSize: 16, color: '#94a3b8', marginBottom: 32, textAlign: 'center' },
  
  inputGroup: {
      marginTop: 20
  },
  labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
      marginLeft: 4,
  },
  label: { color: '#94a3b8', fontSize: 14, fontWeight: '700', textTransform: 'uppercase' },
  
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
  
  regionList: { flex: 1, marginTop: -10 },
  choiceCard: { 
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 20, 
      backgroundColor: '#1e293b',
      borderRadius: 16,
      borderWidth: 2,
      borderColor: '#334155',
      marginBottom: 12,
      // Duolingo-style bottom border
      borderBottomWidth: 4,
  },
  choiceCardActive: { 
      borderColor: '#3b82f6', 
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  choiceText: { color: '#f8fafc', fontSize: 18, fontWeight: '600' },
  choiceTextActive: { color: '#3b82f6' },
  activeDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: '#3b82f6'
  },

  genderRow: { flexDirection: 'row', gap: 16, marginBottom: 24 },
  genderCard: { 
      flex: 1, 
      paddingVertical: 24, 
      backgroundColor: '#1e293b', 
      borderRadius: 16, 
      borderWidth: 2, 
      borderColor: '#334155', 
      alignItems: 'center',
      borderBottomWidth: 4,
  },
  genderCardActive: { 
      borderColor: '#8b5cf6', 
      backgroundColor: 'rgba(139, 92, 246, 0.1)' 
  },
  genderText: { color: '#94a3b8', fontSize: 18, fontWeight: '700' },
  genderTextActive: { color: '#8b5cf6' },
  
  footer: { padding: 24, paddingBottom: 40, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
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
  primaryButtonText: { color: '#fff', fontSize: 18, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  
  loginLink: { alignItems: 'center', marginTop: 24 },
  loginLinkText: { color: '#3b82f6', fontWeight: '800', fontSize: 14, letterSpacing: 1 }
});
