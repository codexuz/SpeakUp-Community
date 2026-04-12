import { fetchQuestionById, Question } from '@/lib/data';
import { saveResponseOffline } from '@/lib/db';
import { useAuth } from '@/store/auth';
import { AudioModule, RecordingPresets, useAudioRecorder } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { ArrowLeft, Clock, Mic, StopCircle } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function SpeakingScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  
  const [question, setQuestion] = useState<Question | null>(null);
  const [loadingQ, setLoadingQ] = useState(true);
  
  const [phase, setPhase] = useState<'prep' | 'speak' | 'done'>('prep');
  const [timeLeft, setTimeLeft] = useState(0);
  
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  
  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const startRecording = useCallback(async () => {
    try {
      const perms = await AudioModule.requestRecordingPermissionsAsync();
      if (perms.status === 'granted') {
        await audioRecorder.record();
      }
    } catch (err) {
      console.warn('Failed to start recording', err);
    }
  }, [audioRecorder]);

  const stopRecording = useCallback(async () => {
    try {
      setPhase('done');
      if (audioRecorder.isRecording) {
        await audioRecorder.stop();
      }
      
      const uri = audioRecorder.uri;
      if (uri && user && question) {
        const filename = `response_${user.id}_${Date.now()}.m4a`;
        const dest = new File(Paths.document, filename);
        new File(uri).copy(dest);
        
        await saveResponseOffline(question.id, user.id, dest.uri);
      }
      
      router.back();
    } catch (err) {
      console.error('Failed to stop recording', err);
      router.back();
    }
  }, [audioRecorder, question, router, user]);

  // Load question from DB
  useEffect(() => {
    (async () => {
      const q = await fetchQuestionById(Number(id));
      setQuestion(q);
      setLoadingQ(false);
    })();
  }, [id]);

  // Timers and Phases
  useEffect(() => {
    if (!question) return;
    
    if (phase === 'prep') {
      setTimeLeft(question.prep_timer);
      Speech.speak(question.q_text, { language: 'en-GB', rate: 0.9 });
    } else if (phase === 'speak') {
      setTimeLeft(question.speaking_timer);
      startRecording();
      
      // Start pulse animation when speaking
      Animated.loop(
        Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 1.2, duration: 800, useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true })
        ])
      ).start();
    }
  }, [phase, pulseAnim, question, startRecording]);

  useEffect(() => {
    if (timeLeft <= 0) {
      if (phase === 'prep') {
        setPhase('speak');
      } else if (phase === 'speak') {
        stopRecording();
      }
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [phase, stopRecording, timeLeft]);

  if (loadingQ) return (
    <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <LinearGradient colors={['#0f172a', '#1e293b']} style={StyleSheet.absoluteFillObject} />
      <ActivityIndicator size="large" color="#3b82f6" />
    </View>
  );

  if (!question) return (
    <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
      <LinearGradient colors={['#0f172a', '#1e293b']} style={StyleSheet.absoluteFillObject} />
      <Text style={styles.text}>Question not found</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient 
          colors={phase === 'speak' ? ['#450a0a', '#1e293b'] : ['#0f172a', '#1e293b']} 
          style={StyleSheet.absoluteFillObject} 
      />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color="#fff" size={28} />
        </TouchableOpacity>
        <View style={styles.badge}>
            <Text style={styles.headerTitle}>PART {question.part}</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.questionCard}>
            {question.image && (
                <View style={styles.imageCard}>
                    <Image source={{ uri: question.image }} style={styles.image} resizeMode="contain" />
                </View>
            )}
            <Text style={styles.questionText}>{question.q_text}</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.timerContainer}>
          <Animated.View style={[
              styles.micCircle, 
              phase === 'speak' && { backgroundColor: 'rgba(239, 68, 68, 0.2)', borderColor: 'rgba(239, 68, 68, 0.5)' },
              { transform: [{ scale: phase === 'speak' ? pulseAnim : 1 }] }
          ]}>
              {phase === 'speak' ? (
                  <Mic size={40} color="#ef4444" />
              ) : (
                  <Clock size={40} color="#3b82f6" />
              )}
          </Animated.View>

          <Text style={styles.timerLabel}>{phase === 'prep' ? 'PREPARATION' : 'RECORDING'}</Text>
          <Text style={[styles.timerValue, phase === 'speak' && { color: '#ef4444' }]}>
            {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
          </Text>
        </View>

        {phase === 'prep' ? (
          <TouchableOpacity style={styles.primaryButton} onPress={() => setTimeLeft(0)} activeOpacity={0.8}>
            <Text style={styles.primaryButtonText}>START SPEAKING</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.dangerButton} onPress={() => setTimeLeft(0)} activeOpacity={0.8}>
            <StopCircle color="#fff" size={24} />
            <Text style={styles.primaryButtonText}>FINISH EXAM</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  text: { color: '#fff', fontSize: 18, fontWeight: '600' },
  
  header: { 
      flexDirection: 'row', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      paddingTop: 60, 
      paddingHorizontal: 20, 
      paddingBottom: 20 
  },
  backBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12 },
  badge: { 
      backgroundColor: 'rgba(59, 130, 246, 0.2)', 
      paddingHorizontal: 16, 
      paddingVertical: 8, 
      borderRadius: 16,
      borderWidth: 2,
      borderColor: 'rgba(59, 130, 246, 0.4)'
  },
  headerTitle: { color: '#60a5fa', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  
  content: { padding: 24, alignItems: 'center' },
  questionCard: {
      backgroundColor: '#1e293b',
      borderRadius: 24,
      padding: 24,
      width: '100%',
      // Chunky borders
      borderWidth: 2,
      borderColor: '#334155',
      borderBottomWidth: 6,
      alignItems: 'center'
  },
  imageCard: {
      width: '100%',
      backgroundColor: '#fff',
      borderRadius: 16,
      padding: 8,
      marginBottom: 24,
      borderWidth: 2,
      borderColor: '#e2e8f0',
      borderBottomWidth: 4,
  },
  image: { width: '100%', height: 220, borderRadius: 12 },
  questionText: { color: '#f8fafc', fontSize: 26, fontWeight: '800', textAlign: 'center', lineHeight: 36 },
  
  footer: { padding: 24, paddingBottom: 50, alignItems: 'center' },
  
  timerContainer: { alignItems: 'center', marginBottom: 32 },
  micCircle: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      borderWidth: 4,
      borderColor: 'rgba(59, 130, 246, 0.3)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16
  },
  timerLabel: { color: '#94a3b8', fontSize: 16, fontWeight: '800', marginBottom: 8, letterSpacing: 1 },
  timerValue: { color: '#fff', fontSize: 56, fontWeight: '900', fontVariant: ['tabular-nums'], letterSpacing: 2 },
  
  primaryButton: { 
      backgroundColor: '#3b82f6', 
      borderRadius: 20, 
      paddingVertical: 20, 
      paddingHorizontal: 32, 
      width: '100%', 
      alignItems: 'center',
      borderBottomWidth: 5,
      borderColor: '#2563eb'
  },
  primaryButtonText: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  
  dangerButton: { 
      backgroundColor: '#ef4444', 
      borderRadius: 20, 
      paddingVertical: 20, 
      paddingHorizontal: 32, 
      width: '100%', 
      alignItems: 'center', 
      flexDirection: 'row', 
      justifyContent: 'center', 
      gap: 12,
      borderBottomWidth: 5,
      borderColor: '#dc2626'
  },
});
