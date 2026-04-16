import { TG } from '@/constants/theme';
import {
  apiFetchChallenges,
  apiFetchCourses,
  apiFetchLeaderboard,
  apiFetchProgress,
  apiFetchWeeklySummary,
} from '@/lib/api';
import { fetchTestsWithQuestions, Test } from '@/lib/data';
import type { Challenge, Course, LeaderboardEntry, UserProgress, WeeklySummary } from '@/lib/types';
import { useAuth } from '@/store/auth';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  ChevronRight,
  Crown,
  Flame,
  Minus,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function StudentHomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [dailyChallenge, setDailyChallenge] = useState<Challenge | null>(null);
  const [activeCourse, setActiveCourse] = useState<Course | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<number>(0);
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [progressRes, summaryRes, challengesRes, coursesRes, lbRes, testsRes] = await Promise.allSettled([
        apiFetchProgress(),
        apiFetchWeeklySummary(),
        apiFetchChallenges('daily'),
        apiFetchCourses(),
        apiFetchLeaderboard('weekly', 5),
        fetchTestsWithQuestions(),
      ]);

      if (progressRes.status === 'fulfilled') setProgress(progressRes.value);
      if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value);
      if (challengesRes.status === 'fulfilled') {
        const active = challengesRes.value.data?.find((c: Challenge) => c.isActive && !c.submitted);
        setDailyChallenge(active || challengesRes.value.data?.[0] || null);
      }
      if (coursesRes.status === 'fulfilled') {
        const inProgress = coursesRes.value.data?.find((c: Course) => c.progressPercent > 0 && c.progressPercent < 100);
        setActiveCourse(inProgress || coursesRes.value.data?.[0] || null);
      }
      if (lbRes.status === 'fulfilled') {
        setLeaderboard(lbRes.value.data || []);
        setUserRank(lbRes.value.userRank || 0);
      }
      if (testsRes.status === 'fulfilled') setTests(testsRes.value);
    } catch (e) {
      console.error('Failed to load dashboard', e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData();
    }, []),
  );

  const getTimeRemaining = (endsAt: string) => {
    const diff = new Date(endsAt).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h ${m}m left`;
  };

  const ImprovementArrow = ({ value }: { value: number }) => {
    if (value > 0) return <ArrowUp size={12} color={TG.scoreGreen} />;
    if (value < 0) return <ArrowDown size={12} color={TG.scoreRed} />;
    return <Minus size={12} color={TG.textHint} />;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={TG.headerBg} />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>SpeakUp</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={TG.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={TG.headerBg} />
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>SpeakUp</Text>
        </View>
        <View style={styles.headerRight}>
          {progress && (
            <View style={styles.coinBadge}>
              <Text style={styles.coinText}>🪙 {progress.coins}</Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TG.accent} colors={[TG.accent]} />
        }
      >
        {/* ── Streak & XP Bar ────────────────────── */}
        {progress && (
          <View style={styles.progressCard}>
            <View style={styles.progressTopRow}>
              <View style={styles.streakContainer}>
                <Flame size={22} color={progress.currentStreak > 0 ? TG.streakOrange : TG.textHint} />
                <Text style={[styles.streakText, progress.currentStreak > 0 && { color: TG.streakOrange }]}>
                  {progress.currentStreak}-day streak
                </Text>
              </View>
              <View style={styles.levelBadge}>
                <Text style={styles.levelText}>Lv. {progress.level}</Text>
              </View>
            </View>
            <View style={styles.xpBarContainer}>
              <View style={styles.xpBarBg}>
                <View style={[styles.xpBarFill, { width: `${Math.min(progress.xpPercent, 100)}%` }]} />
              </View>
              <Text style={styles.xpText}>
                {progress.xpInCurrentLevel} / {progress.xpForNextLevel} XP
              </Text>
            </View>
            <View style={styles.progressStatsRow}>
              <View style={styles.miniStat}>
                <Text style={styles.miniStatValue}>{progress.xp}</Text>
                <Text style={styles.miniStatLabel}>Total XP</Text>
              </View>
              <View style={styles.miniStatDivider} />
              <View style={styles.miniStat}>
                <Text style={styles.miniStatValue}>{progress.weeklyXP}</Text>
                <Text style={styles.miniStatLabel}>This Week</Text>
              </View>
              <View style={styles.miniStatDivider} />
              <View style={styles.miniStat}>
                <Text style={styles.miniStatValue}>{progress.longestStreak}</Text>
                <Text style={styles.miniStatLabel}>Best Streak</Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Quick Actions ─────────────────────── */}
        <View style={styles.quickActionsRow}>
          {dailyChallenge && (
            <TouchableOpacity
              style={[styles.quickCard, { backgroundColor: TG.streakOrangeLight }]}
              activeOpacity={0.7}
              onPress={() => router.push('/challenges' as any)}
            >
              <Target size={24} color={TG.streakOrange} />
              <Text style={styles.quickCardTitle}>Daily Challenge</Text>
              <Text style={styles.quickCardSub} numberOfLines={1}>
                {dailyChallenge.title}
              </Text>
              {dailyChallenge.submitted ? (
                <View style={[styles.quickBadge, { backgroundColor: TG.scoreGreen }]}>
                  <Text style={styles.quickBadgeText}>✓ Done</Text>
                </View>
              ) : (
                <Text style={styles.quickCardTimer}>{getTimeRemaining(dailyChallenge.endsAt)}</Text>
              )}
            </TouchableOpacity>
          )}
          {activeCourse && (
            <TouchableOpacity
              style={[styles.quickCard, { backgroundColor: TG.accentLight }]}
              activeOpacity={0.7}
              onPress={() => router.push(`/course/${activeCourse.id}` as any)}
            >
              <BookOpen size={24} color={TG.accent} />
              <Text style={styles.quickCardTitle}>Continue Course</Text>
              <Text style={styles.quickCardSub} numberOfLines={1}>
                {activeCourse.title}
              </Text>
              <View style={styles.miniProgressBar}>
                <View style={[styles.miniProgressFill, { width: `${activeCourse.progressPercent}%` }]} />
              </View>
              <Text style={styles.quickCardTimer}>{activeCourse.progressPercent}% complete</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Weekly Improvements ────────────────── */}
        {summary && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Sparkles size={18} color={TG.gold} />
              <Text style={styles.sectionTitle}>This Week</Text>
            </View>
            <View style={styles.improvementsGrid}>
              <View style={styles.improvementItem}>
                <View style={styles.improvementRow}>
                  <Text style={styles.improvementLabel}>Grammar</Text>
                  <View style={styles.deltaRow}>
                    <ImprovementArrow value={summary.improvements.grammar} />
                    <Text
                      style={[
                        styles.deltaText,
                        { color: summary.improvements.grammar >= 0 ? TG.scoreGreen : TG.scoreRed },
                      ]}
                    >
                      {summary.improvements.grammar > 0 ? '+' : ''}
                      {summary.improvements.grammar}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.improvementItem}>
                <View style={styles.improvementRow}>
                  <Text style={styles.improvementLabel}>Fluency</Text>
                  <View style={styles.deltaRow}>
                    <ImprovementArrow value={summary.improvements.fluency} />
                    <Text
                      style={[
                        styles.deltaText,
                        { color: summary.improvements.fluency >= 0 ? TG.scoreGreen : TG.scoreRed },
                      ]}
                    >
                      {summary.improvements.fluency > 0 ? '+' : ''}
                      {summary.improvements.fluency}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.improvementItem}>
                <View style={styles.improvementRow}>
                  <Text style={styles.improvementLabel}>Vocabulary</Text>
                  <View style={styles.deltaRow}>
                    <ImprovementArrow value={summary.improvements.vocabulary} />
                    <Text
                      style={[
                        styles.deltaText,
                        { color: summary.improvements.vocabulary >= 0 ? TG.scoreGreen : TG.scoreRed },
                      ]}
                    >
                      {summary.improvements.vocabulary > 0 ? '+' : ''}
                      {summary.improvements.vocabulary}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.improvementItem}>
                <View style={styles.improvementRow}>
                  <Text style={styles.improvementLabel}>Recordings</Text>
                  <Text style={styles.improvementValue}>{summary.weeklyRecordings}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ── Practice Tests ────────────────────── */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Zap size={18} color={TG.accent} />
            <Text style={styles.sectionTitle}>Practice Speaking</Text>
          </View>
          {tests.length === 0 ? (
            <Text style={styles.emptyText}>No tests available yet.</Text>
          ) : (
            tests.slice(0, 4).map((test) => (
              <TouchableOpacity
                key={test.id}
                style={styles.testRow}
                activeOpacity={0.7}
                onPress={() => router.push({ pathname: '/speaking/[id]', params: { id: String(test.id) } } as any)}
              >
                <View style={[styles.testIcon, { backgroundColor: TG.accentLight }]}>
                  <BookOpen size={18} color={TG.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.testTitle}>{test.title}</Text>
                  <Text style={styles.testSub}>{test.questions?.length || 0} questions</Text>
                </View>
                <ChevronRight size={18} color={TG.textHint} />
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* ── Mini Leaderboard ──────────────────── */}
        {leaderboard.length > 0 && (
          <View style={styles.sectionCard}>
            <TouchableOpacity
              style={styles.sectionHeader}
              activeOpacity={0.7}
              onPress={() => router.push('/leaderboard' as any)}
            >
              <Trophy size={18} color={TG.gold} />
              <Text style={styles.sectionTitle}>Weekly Leaderboard</Text>
              <ChevronRight size={16} color={TG.textHint} style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
            {leaderboard.slice(0, 5).map((entry, i) => (
              <View
                key={entry.userId}
                style={[
                  styles.leaderboardRow,
                  entry.userId === user?.id && styles.leaderboardHighlight,
                ]}
              >
                <View style={styles.rankContainer}>
                  {i === 0 ? (
                    <Crown size={18} color={TG.gold} />
                  ) : (
                    <Text style={styles.rankText}>{i + 1}</Text>
                  )}
                </View>
                <Image
                  source={{ uri: entry.user.avatarUrl || 'https://i.ibb.co/68vS1zZ/default-avatar.png' }}
                  style={styles.lbAvatar}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.lbName} numberOfLines={1}>
                    {entry.user.fullName}
                    {entry.userId === user?.id ? ' (You)' : ''}
                  </Text>
                  <Text style={styles.lbLevel}>Level {entry.level}</Text>
                </View>
                <Text style={styles.lbXP}>{entry.weeklyXP || 0} XP</Text>
              </View>
            ))}
            {userRank > 5 && (
              <View style={[styles.leaderboardRow, styles.leaderboardHighlight]}>
                <View style={styles.rankContainer}>
                  <Text style={styles.rankText}>{userRank}</Text>
                </View>
                <Image
                  source={{ uri: user?.avatarUrl || 'https://i.ibb.co/68vS1zZ/default-avatar.png' }}
                  style={styles.lbAvatar}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.lbName}>You</Text>
                  <Text style={styles.lbLevel}>Level {progress?.level || 0}</Text>
                </View>
                <Text style={styles.lbXP}>{progress?.weeklyXP || 0} XP</Text>
              </View>
            )}
          </View>
        )}

        <View style={{ height: 30 }} />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: TG.textWhite },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  coinBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  coinText: { color: TG.textWhite, fontSize: 13, fontWeight: '600' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: TG.bg },
  scrollView: { flex: 1, backgroundColor: TG.bgSecondary },
  scrollContent: { paddingBottom: 100 },

  // Progress Card
  progressCard: {
    backgroundColor: TG.bg,
    marginHorizontal: 14,
    marginTop: 14,
    borderRadius: 16,
    padding: 16,
  },
  progressTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  streakContainer: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  streakText: { fontSize: 15, fontWeight: '700', color: TG.textHint },
  levelBadge: {
    backgroundColor: TG.goldLight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  levelText: { fontSize: 13, fontWeight: '700', color: TG.gold },
  xpBarContainer: { marginBottom: 14 },
  xpBarBg: {
    height: 10,
    backgroundColor: TG.bgSecondary,
    borderRadius: 5,
    overflow: 'hidden',
  },
  xpBarFill: {
    height: 10,
    backgroundColor: TG.gold,
    borderRadius: 5,
  },
  xpText: {
    fontSize: 11,
    color: TG.textSecondary,
    marginTop: 4,
    textAlign: 'right',
  },
  progressStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniStat: { flex: 1, alignItems: 'center' },
  miniStatValue: { fontSize: 17, fontWeight: '700', color: TG.textPrimary },
  miniStatLabel: { fontSize: 11, color: TG.textSecondary, marginTop: 2 },
  miniStatDivider: { width: 1, height: 28, backgroundColor: TG.separatorLight },

  // Quick Actions
  quickActionsRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    gap: 10,
    marginTop: 14,
  },
  quickCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  quickCardTitle: { fontSize: 13, fontWeight: '700', color: TG.textPrimary },
  quickCardSub: { fontSize: 12, color: TG.textSecondary },
  quickCardTimer: { fontSize: 11, color: TG.textHint, marginTop: 2 },
  quickBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 2,
  },
  quickBadgeText: { fontSize: 11, fontWeight: '600', color: '#fff' },
  miniProgressBar: {
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 4,
  },
  miniProgressFill: {
    height: 4,
    backgroundColor: TG.accent,
    borderRadius: 2,
  },

  // Section Card
  sectionCard: {
    backgroundColor: TG.bg,
    marginHorizontal: 14,
    marginTop: 14,
    borderRadius: 16,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: TG.separatorLight,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: TG.textPrimary },
  emptyText: { color: TG.textSecondary, textAlign: 'center', paddingVertical: 20, fontSize: 14 },

  // Improvements
  improvementsGrid: { padding: 14, gap: 10 },
  improvementItem: {},
  improvementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  improvementLabel: { fontSize: 14, color: TG.textSecondary },
  improvementValue: { fontSize: 14, fontWeight: '700', color: TG.textPrimary },
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  deltaText: { fontSize: 14, fontWeight: '700' },

  // Tests
  testRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: TG.separatorLight,
  },
  testIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  testTitle: { fontSize: 15, fontWeight: '600', color: TG.textPrimary, marginBottom: 1 },
  testSub: { fontSize: 12, color: TG.textSecondary },

  // Leaderboard
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: TG.separatorLight,
  },
  leaderboardHighlight: {
    backgroundColor: TG.goldLight,
  },
  rankContainer: { width: 26, alignItems: 'center' },
  rankText: { fontSize: 14, fontWeight: '700', color: TG.textSecondary },
  lbAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: TG.bgSecondary },
  lbName: { fontSize: 14, fontWeight: '600', color: TG.textPrimary },
  lbLevel: { fontSize: 11, color: TG.textSecondary },
  lbXP: { fontSize: 14, fontWeight: '700', color: TG.gold },
});
