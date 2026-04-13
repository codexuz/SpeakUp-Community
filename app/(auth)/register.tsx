import { TG } from '@/constants/theme';
import { apiRegister } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { useRouter } from 'expo-router';
import { ChevronLeft, Eye, EyeOff } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const TOTAL_STEPS = 4;
const REGIONS = [
  'Tashkent', 'Andijan', 'Bukhara', 'Fergana', 'Jizzakh', 'Namangan', 'Navoiy', 'Kashkadarya', 'Samarkand', 'Syrdarya', 'Surkhandarya', 'Khorezm', 'Karakalpakstan'
];

const GENDER_AVATARS: Record<string, string> = {
  Female: 'https://0c274cbb-6ce5-45fb-8540-ad2b7912cd23.srvstatic.uz/female.jpg',
  Male: 'https://0c274cbb-6ce5-45fb-8540-ad2b7912cd23.srvstatic.uz/male.jpg',
};

export default function RegisterScreen() {
  const router = useRouter();
  const { login } = useAuth();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    username: '',
    fullName: '',
    gender: 'Male',
    region: 'Tashkent',
    avatarUrl: GENDER_AVATARS['Male'],
    password: ''
  });

  const progressAnim = useRef(new Animated.Value(0.25)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: step / TOTAL_STEPS,
      duration: 300,
      useNativeDriver: false,
    }).start();

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
  }, [fadeAnim, progressAnim, slideAnim, step]);

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
            <Text style={styles.stepTitle}>Create your account</Text>
            <Text style={styles.stepSubtitle}>Pick a username and enter your name</Text>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              placeholder="Choose a username"
              placeholderTextColor={TG.textHint}
              autoCapitalize="none"
              value={formData.username}
              onChangeText={(text) => updateForm('username', text)}
              autoFocus
            />
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your full name"
              placeholderTextColor={TG.textHint}
              value={formData.fullName}
              onChangeText={(text) => updateForm('fullName', text)}
            />
          </View>
        );
      case 2:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Your region</Text>
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
            <Text style={styles.stepTitle}>A bit more details</Text>
            <Text style={styles.stepSubtitle}>Help us personalise your experience</Text>
            
            <View style={styles.genderRow}>
              {['Male', 'Female'].map(g => {
                const isActive = formData.gender === g;
                return (
                  <TouchableOpacity
                    key={g}
                    style={[styles.genderCard, isActive && styles.genderCardActive]}
                    onPress={() => setFormData(prev => ({ ...prev, gender: g, avatarUrl: GENDER_AVATARS[g] }))}
                    activeOpacity={0.7}
                  >
                    <Image source={{ uri: GENDER_AVATARS[g] }} style={styles.genderAvatar} />
                    <Text style={[styles.genderText, isActive && styles.genderTextActive]}>
                      {g}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );
      case 4:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Set a password</Text>
            <Text style={styles.stepSubtitle}>Secure your account with a password</Text>
            
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter your password"
                placeholderTextColor={TG.textHint}
                secureTextEntry={!showPassword}
                value={formData.password}
                onChangeText={(text) => updateForm('password', text)}
                autoFocus
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
        );
    }
  };

  const getButtonText = () => {
    if (step === 1 && (!formData.username || !formData.fullName)) return "Fill in required fields";
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
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header & Progress Bar */}
        <View style={styles.header}>
          <TouchableOpacity onPress={step > 1 ? prevStep : () => router.back()} style={styles.backButton}>
            <ChevronLeft color={TG.textWhite} size={28} />
          </TouchableOpacity>
          <View style={styles.progressBarContainer}>
            <Animated.View style={[styles.progressBarFill, { width: progressWidth }]} />
          </View>
          <Text style={styles.stepIndicator}>{step}/{TOTAL_STEPS}</Text>
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
            style={[styles.primaryButton, isButtonDisabled && styles.primaryButtonDisabled]} 
            onPress={step < 4 ? nextStep : handleRegister}
            disabled={isButtonDisabled}
            activeOpacity={0.7}
          >
            {loading ? (
              <ActivityIndicator color={TG.textWhite} />
            ) : (
              <Text style={styles.primaryButtonText}>{getButtonText()}</Text>
            )}
          </TouchableOpacity>

          {step === 1 && (
            <TouchableOpacity onPress={() => router.push('/(auth)/login')} style={styles.loginLink}>
              <Text style={styles.loginLinkText}>Already have an account? <Text style={{ color: TG.accent }}>Sign In</Text></Text>
            </TouchableOpacity>
          )}
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
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  progressBarContainer: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: TG.textWhite,
    borderRadius: 2,
  },
  stepIndicator: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '600',
    minWidth: 28,
    textAlign: 'right',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  stepContent: {
    flex: 1,
    paddingTop: 28,
  },
  stepTitle: { fontSize: 24, fontWeight: '700', color: TG.textPrimary, marginBottom: 6 },
  stepSubtitle: { fontSize: 15, color: TG.textSecondary, marginBottom: 28 },
  
  label: {
    color: TG.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    marginLeft: 4,
    marginTop: 8,
  },
  
  input: {
    backgroundColor: TG.bgSecondary,
    borderRadius: 12,
    padding: 16,
    color: TG.textPrimary,
    fontSize: 16,
    borderWidth: 0.5,
    borderColor: TG.separator,
    marginBottom: 4,
  },
  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TG.bgSecondary,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: TG.separator,
    marginBottom: 4,
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
  
  regionList: { flex: 1 },
  choiceCard: { 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16, 
    backgroundColor: TG.bgSecondary,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: TG.separator,
    marginBottom: 8,
  },
  choiceCardActive: { 
    borderColor: TG.accent, 
    backgroundColor: TG.accentLight,
    borderWidth: 1.5,
  },
  choiceText: { color: TG.textPrimary, fontSize: 16, fontWeight: '500' },
  choiceTextActive: { color: TG.accent, fontWeight: '600' },
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: TG.accent,
  },

  genderRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  genderCard: { 
    flex: 1, 
    paddingVertical: 18, 
    backgroundColor: TG.bgSecondary, 
    borderRadius: 12, 
    borderWidth: 0.5, 
    borderColor: TG.separator, 
    alignItems: 'center',
    gap: 10,
  },
  genderAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: TG.separator,
  },
  genderCardActive: { 
    borderColor: TG.accent, 
    backgroundColor: TG.accentLight,
    borderWidth: 1.5,
  },
  genderText: { color: TG.textSecondary, fontSize: 16, fontWeight: '600' },
  genderTextActive: { color: TG.accent },
  
  footer: { padding: 24, paddingBottom: 16, borderTopWidth: 0.5, borderTopColor: TG.separator },
  primaryButton: { 
    backgroundColor: TG.accent, 
    borderRadius: 12, 
    paddingVertical: 16, 
    alignItems: 'center',
  },
  primaryButtonDisabled: { 
    backgroundColor: TG.separator,
  },
  primaryButtonText: { color: TG.textWhite, fontSize: 16, fontWeight: '700' },
  
  loginLink: { alignItems: 'center', marginTop: 20 },
  loginLinkText: { color: TG.textSecondary, fontSize: 14 },
});
