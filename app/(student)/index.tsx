import { TG } from '@/constants/theme';
import { fetchTestsWithQuestions, Test } from '@/lib/data';
import { useAuth } from '@/store/auth';
import { useRouter } from 'expo-router';
import { BookOpen, ChevronRight } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function StudentHomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={TG.headerBg} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>SpeakUp</Text>
      </View>
      <ScrollView
        style={styles.scrollView}
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
  safeArea: { flex: 1, backgroundColor: TG.headerBg },
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
  scrollView: { flex: 1, backgroundColor: TG.bg },
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
});
