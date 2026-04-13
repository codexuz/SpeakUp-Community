import { TG } from '@/constants/theme';
import { fetchTestsWithQuestions, Test } from '@/lib/data';
import { useAuth } from '@/store/auth';
import { useRouter } from 'expo-router';
import { BarChart3, BookOpen, ChevronRight, Mic } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTests = async () => {
    setLoading(true);
    try {
      const data = await fetchTestsWithQuestions();
      console.log('Fetched tests:', JSON.stringify(data));
      setTests(data);
    } catch (e) {
      console.error('Failed to load tests', e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await fetchTestsWithQuestions();
      setTests(data);
    } catch (e) {
      console.error('Failed to refresh tests', e);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTests();
  }, []);

  if (user?.role === 'teacher') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>SpeakUp</Text>
        </View>
        <ScrollView
          contentContainerStyle={styles.teacherContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TG.accent} colors={[TG.accent]} />
          }
        >
          <View style={styles.teacherAvatar}>
            <Text style={styles.teacherAvatarText}>{user.fullName?.charAt(0) || 'T'}</Text>
          </View>
          <Text style={styles.teacherGreeting}>Welcome, {user.fullName}</Text>
          <Text style={styles.teacherSubtitle}>Review student submissions and manage your groups</Text>
          
          <TouchableOpacity 
            style={styles.actionCard}
            activeOpacity={0.7}
            onPress={() => router.push('/(tabs)/responses')}
          >
            <View style={[styles.actionIcon, { backgroundColor: TG.accentLight }]}>
              <Mic size={22} color={TG.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Pending Reviews</Text>
              <Text style={styles.actionDesc}>Grade student speaking submissions</Text>
            </View>
            <ChevronRight size={20} color={TG.textHint} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionCard}
            activeOpacity={0.7}
            onPress={() => router.push('/(tabs)/groups')}
          >
            <View style={[styles.actionIcon, { backgroundColor: TG.greenLight }]}>
              <BarChart3 size={22} color={TG.green} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>My Groups</Text>
              <Text style={styles.actionDesc}>Manage groups and view analytics</Text>
            </View>
            <ChevronRight size={20} color={TG.textHint} />
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>SpeakUp</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TG.accent} colors={[TG.accent]} />
        }
      >
        <Text style={styles.greeting}>Hello, {user?.fullName} 👋</Text>
        <Text style={styles.subGreeting}>Choose a test to practice your speaking</Text>

        {loading ? (
          <ActivityIndicator size="large" color={TG.accent} style={{ marginTop: 60 }} />
        ) : tests.length === 0 ? (
          <Text style={styles.emptyText}>No tests available yet.</Text>
        ) : (
          tests.map(test => {
            const questions = test.questions || [];
            const firstQuestion = questions[0];

            return (
              <TouchableOpacity 
                key={test.id} 
                style={styles.testCard}
                activeOpacity={0.7}
                onPress={() => {
                    router.push({ pathname: '/speaking/[id]', params: { id: String(test.id) } } as any);
                }}
              >
                <View style={[styles.testIcon, { backgroundColor: TG.accentLight }]}>
                  <BookOpen size={22} color={TG.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.testTitle}>{test.title}</Text>
                  <Text style={styles.testSub}>{questions.length} questions</Text>
                </View>
                <ChevronRight size={20} color={TG.textHint} />
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TG.bg },
  header: {
    backgroundColor: TG.headerBg,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: TG.textWhite,
  },
  scrollContent: { paddingBottom: 100 },

  greeting: { fontSize: 22, fontWeight: '700', color: TG.textPrimary, paddingHorizontal: 16, paddingTop: 20 },
  subGreeting: { fontSize: 14, color: TG.textSecondary, paddingHorizontal: 16, marginBottom: 20, marginTop: 4 },

  emptyText: { color: TG.textSecondary, textAlign: 'center', marginTop: 40, fontSize: 15 },

  testCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: TG.bg,
    borderBottomWidth: 0.5,
    borderBottomColor: TG.separatorLight,
    gap: 14,
  },
  testIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  testTitle: { fontSize: 16, fontWeight: '600', color: TG.textPrimary, marginBottom: 2 },
  testSub: { fontSize: 13, color: TG.textSecondary },

  teacherContainer: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 40 },
  teacherAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: TG.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  teacherAvatarText: { fontSize: 30, fontWeight: '700', color: TG.textWhite },
  teacherGreeting: { fontSize: 22, fontWeight: '700', color: TG.textPrimary, marginBottom: 6 },
  teacherSubtitle: { fontSize: 14, color: TG.textSecondary, textAlign: 'center', marginBottom: 32, lineHeight: 20 },

  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: TG.bg,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: TG.separator,
    gap: 14,
    marginBottom: 10,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionTitle: { fontSize: 16, fontWeight: '600', color: TG.textPrimary, marginBottom: 2 },
  actionDesc: { fontSize: 13, color: TG.textSecondary },
});
