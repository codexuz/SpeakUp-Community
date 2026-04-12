import { fetchTestsWithQuestions, Test } from '@/lib/data';
import { useAuth } from '@/store/auth';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { BookOpen, Feather, PlayCircle, RefreshCw } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTests = async () => {
    setLoading(true);
    try {
      const data = await fetchTestsWithQuestions();
      setTests(data);
    } catch (e) {
      console.error('Failed to load tests', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTests();
  }, []);

  if (user?.role === 'teacher') {
    return (
      <View style={styles.teacherContainer}>
        <LinearGradient colors={['#0f172a', '#1e293b']} style={StyleSheet.absoluteFillObject} />
        
        <View style={styles.teacherIconBox}>
           <Feather size={48} color="#f59e0b" strokeWidth={1.5} />
        </View>

        <Text style={styles.teacherTitle}>Welcome, Teacher {user.fullName}</Text>
        <Text style={styles.teacherSubtitle}>Head over to Submissions to grade students.</Text>
        
        <TouchableOpacity 
            style={styles.primaryButton} 
            activeOpacity={0.8}
            onPress={() => router.push('/(tabs)/responses')}
        >
          <Text style={styles.primaryButtonText}>VIEW SUBMISSIONS</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0f172a', '#1e293b']} style={StyleSheet.absoluteFillObject} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.greeting}>Hello, {user?.fullName}</Text>
              <Text style={styles.subGreeting}>Ready for your IELTS practice?</Text>
            </View>
            <TouchableOpacity onPress={loadTests} style={styles.refreshBtn} activeOpacity={0.7}>
              <RefreshCw size={24} color="#3b82f6" />
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 60 }} />
        ) : tests.length === 0 ? (
          <Text style={styles.emptyText}>No tests available yet.</Text>
        ) : (
          tests.map(test => {
            const questions = test.questions || [];
            const firstQuestion = questions[0];

            return (
              <View key={test.id} style={styles.testSection}>
                <TouchableOpacity 
                    style={styles.testCard} 
                    activeOpacity={0.8}
                    onPress={() => {
                        if (firstQuestion) {
                            router.push(`/speaking/${firstQuestion.id}`);
                        } else {
                            Alert.alert('No Questions', 'This test does not have any questions yet.');
                        }
                    }}
                >
                    <View style={styles.testCardInner}>
                        <View style={styles.testIconWrapper}>
                            <BookOpen size={30} color="#10b981" strokeWidth={2} />
                        </View>
                        <View style={styles.testInfo}>
                            <Text style={styles.testTitle}>{test.title}</Text>
                            <Text style={styles.testSubTitle}>{questions.length} questions included</Text>
                        </View>
                        <View style={styles.chevronWrapper}>
                            <PlayCircle size={28} color="#3b82f6" />
                        </View>
                    </View>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  header: { marginBottom: 24, paddingTop: 30 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greeting: { fontSize: 24, fontWeight: '800', color: '#f8fafc', marginBottom: 4 },
  subGreeting: { fontSize: 14, color: '#94a3b8', fontWeight: '500' },
  
  refreshBtn: { 
      padding: 10, 
      backgroundColor: 'rgba(59, 130, 246, 0.1)', 
      borderRadius: 14, 
      borderWidth: 2, 
      borderColor: 'rgba(59, 130, 246, 0.3)' 
  },
  emptyText: { color: '#94a3b8', textAlign: 'center', marginTop: 40, fontSize: 16, fontWeight: '600' },

  testSection: { marginBottom: 16 },
  
  testCard: {
      backgroundColor: '#1e293b',
      borderRadius: 20,
      padding: 16,
      borderWidth: 2,
      borderColor: '#334155',
      borderBottomWidth: 4,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
  },
  testCardInner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
  },
  testIconWrapper: {
      width: 48,
      height: 48,
      backgroundColor: 'rgba(16, 185, 129, 0.15)',
      borderRadius: 14,
      borderWidth: 2,
      borderColor: 'rgba(16, 185, 129, 0.3)',
      borderBottomWidth: 3,
      justifyContent: 'center',
      alignItems: 'center',
  },
  testInfo: {
      flex: 1,
  },
  testTitle: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 2 },
  testSubTitle: { fontSize: 13, color: '#94a3b8', fontWeight: '600' },
  chevronWrapper: {
      padding: 2,
  },

  teacherContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  teacherIconBox: {
      marginBottom: 24,
      width: 90,
      height: 90,
      borderRadius: 45,
      backgroundColor: '#1e293b',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 3,
      borderColor: '#334155',
      borderBottomWidth: 5
  },
  teacherTitle: { fontSize: 24, fontWeight: '800', color: '#fff', marginBottom: 8, textAlign: 'center' },
  teacherSubtitle: { fontSize: 16, color: '#94a3b8', marginBottom: 32, textAlign: 'center', lineHeight: 24 },
  
  primaryButton: { 
      backgroundColor: '#3b82f6', 
      borderRadius: 14, 
      paddingVertical: 16, 
      paddingHorizontal: 24,
      alignItems: 'center',
      borderBottomWidth: 4,
      borderColor: '#2563eb',
      width: '100%'
  },
  primaryButtonText: { 
      color: '#fff', 
      fontSize: 16, 
      fontWeight: '800', 
      textTransform: 'uppercase', 
      letterSpacing: 1 
  },
});
