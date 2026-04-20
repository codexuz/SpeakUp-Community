import { TG } from '@/constants/theme';
import { useCachedFetch } from '@/hooks/useCachedFetch';
import {
  apiFetchChallenges,
  apiFetchCourses,
  apiFetchLeaderboard,
  apiFetchProgress,
  apiFetchTests,
  apiFetchWeeklySummary,
} from '@/lib/api';
import type { Test } from '@/lib/data';
import type { Challenge, Course, LeaderboardEntry, UserProgress, WeeklySummary } from '@/lib/types';
import { useAuth } from '@/store/auth';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  Crown,
  FileText,
  Flame,
  Mic,
  Minus,
  PlayIcon,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Zap
} from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions, FlatList, Image,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

// Theme-aligned Premium Color Palette
const COLORS = {
  background: TG.bgSecondary,
  surface: TG.bg,
  text: TG.textPrimary,
  textMuted: TG.textSecondary,
  primary: TG.accent,
  secondary: TG.accentDark,
  accent: TG.gold,
  success: TG.scoreGreen,
  danger: TG.scoreRed,
  gold: TG.gold,
  border: TG.separator,
  gradientPrimary: [TG.accent, TG.accentDark],
  gradientAccent: [TG.streakOrange, TG.scoreOrange],
  gradientBlue: [TG.mentorTeal, TG.accent],
};

export default function StudentHomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [dailyChallenge, setDailyChallenge] = useState<Challenge | null>(null);
  const [activeCourse, setActiveCourse] = useState<Course | null>(null);
  const [userRank, setUserRank] = useState<number>(0);
  const [greeting, setGreeting] = useState('Hello');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good Morning');
    else if (hour < 18) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');
  }, []);

  const { data: dashboardData, isLoading: loading, isRefreshing: refreshing, refresh } = useCachedFetch<{
    progress: UserProgress | null;
    summary: WeeklySummary | null;
    challenges: Challenge[];
    courses: Course[];
    leaderboard: LeaderboardEntry[];
    leaderboardRank: number;
    tests: Test[];
  }>({
    cacheKey: 'student_dashboard',
    apiFn: async () => {
      const [progressRes, summaryRes, challengesRes, coursesRes, lbRes, testsRes] = await Promise.allSettled([
        apiFetchProgress(),
        apiFetchWeeklySummary(),
        apiFetchChallenges('daily'),
        apiFetchCourses(),
        apiFetchLeaderboard('weekly', 5),
        apiFetchTests({ limit: 3 }),
      ]);
      return {
        progress: progressRes.status === 'fulfilled' ? progressRes.value : null,
        summary: summaryRes.status === 'fulfilled' ? summaryRes.value : null,
        challenges: challengesRes.status === 'fulfilled' ? (challengesRes.value.data || []) : [],
        courses: coursesRes.status === 'fulfilled' ? (coursesRes.value.data || []) : [],
        leaderboard: lbRes.status === 'fulfilled' ? (lbRes.value.data || []) : [],
        leaderboardRank: lbRes.status === 'fulfilled' ? (lbRes.value.userRank || 0) : 0,
        tests: testsRes.status === 'fulfilled' ? (testsRes.value.data || []) : [],
      };
    },
    enabled: true,
    staleTime: 60_000,
  });

  const progress = dashboardData?.progress ?? null;
  const summary = dashboardData?.summary ?? null;
  const courses = dashboardData?.courses ?? [];
  const leaderboard = dashboardData?.leaderboard ?? [];
  const tests = dashboardData?.tests ?? [];

  useEffect(() => {
    if (!dashboardData) return;
    setUserRank(dashboardData.leaderboardRank);
    const active = dashboardData.challenges.find((c: Challenge) => c.isActive && !c.submitted);
    setDailyChallenge(active || dashboardData.challenges[0] || null);
    const inProgress = dashboardData.courses.find((c: Course) => c.progressPercent > 0 && c.progressPercent < 100);
    setActiveCourse(inProgress || dashboardData.courses[0] || null);
  }, [dashboardData]);

  const onRefresh = useCallback(async () => {
    await refresh();
  }, [refresh]);

  const getTimeRemaining = (endsAt: string) => {
    const diff = new Date(endsAt).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${h}h ${m}m ${s}s`;
  };

  // Animated countdown
  const [countdown, setCountdown] = useState('');
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!dailyChallenge || dailyChallenge.submitted) return;
    const tick = () => setCountdown(getTimeRemaining(dailyChallenge.endsAt));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [dailyChallenge]);

  useEffect(() => {
    if (!dailyChallenge || dailyChallenge.submitted) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [dailyChallenge]);

  const ImprovementArrow = ({ value }: { value: number }) => {
    if (value > 0) return <ArrowUp size={14} color={COLORS.success} />;
    if (value < 0) return <ArrowDown size={14} color={COLORS.danger} />;
    return <Minus size={14} color={COLORS.textMuted} />;
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      
      {/* ── Top Header ────────────────────── */}
      <View style={styles.headerContainer}>
        <View style={styles.userInfo}>
          <View style={styles.avatarShadow}>
            <Image
              source={{ uri: user?.avatarUrl || 'https://i.ibb.co/68vS1zZ/default-avatar.png' }}
              style={styles.avatar}
            />
          </View>
          <View>
            <Text style={styles.greetingText}>{greeting},</Text>
            <Text style={styles.nameText}>{user?.fullName?.split(' ')[0] || 'Student'} 👋</Text>
          </View>
        </View>
        
        {progress && (
          <View style={styles.coinBadge}>
            <Text style={styles.coinText}>🪙 {progress.coins}</Text>
          </View>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} colors={[COLORS.primary]} />
        }
      >
        {/* ── Hero / Progress Card ────────────────────── */}
        {progress && (
          <TouchableOpacity activeOpacity={0.85} onPress={() => router.push('/streak' as any)} style={styles.heroWrapper}>
            <LinearGradient
              colors={COLORS.gradientAccent as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.heroCard}
            >
              <View style={styles.heroTop}>
                  <View style={[styles.streakBox, { backgroundColor: 'rgba(255,255,255,0.25)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }]}>
                    <Flame size={18} color="#fff" fill="#fff" />
                    <Text style={[styles.streakText, { color: '#fff' }]}>
                      {progress.currentStreak} Day Streak
                    </Text>
                  </View>
                <View style={styles.levelBox}>
                  <Text style={styles.levelLabel}>Current Level</Text>
                  <Text style={styles.levelValue}>{progress.level}</Text>
                </View>
              </View>
              
              <View style={styles.heroProgressContainer}>
                <View style={styles.progressLabels}>
                  <Text style={styles.xpLabel}>Total: {progress.xp} XP</Text>
                  <Text style={styles.xpRemaining}>{progress.xpForNextLevel - progress.xpInCurrentLevel} to next level</Text>
                </View>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${Math.min(progress.xpPercent, 100)}%` }]} />
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* ── Daily Challenge Card ─────────────────── */}
        {dailyChallenge && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push('/challenges' as any)}
            style={styles.dailyChallengeWrapper}
          >
            <LinearGradient
              colors={['#0F172A', '#1E293B'] as unknown as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.dailyChallengeCard}
            >
              <View style={styles.dcTopRow}>
                <View style={styles.dcLeft}>
                  <View style={styles.dcIconBox}>
                    <Target size={20} color="#fff" strokeWidth={2.5} />
                  </View>
                  <View style={styles.dcTextCol}>
                    <Text style={styles.dcTitle}>Daily Challenge</Text>
                    <Text style={styles.dcSubtitle} numberOfLines={1}>{dailyChallenge.title}</Text>
                  </View>
                </View>
                <ChevronRight size={18} color="rgba(255,255,255,0.7)" />
              </View>
              {dailyChallenge.submitted ? (
                <View style={styles.dcBadgeDone}>
                  <CheckCircle2 size={13} color="#10B981" strokeWidth={2.5} />
                  <Text style={styles.dcBadgeDoneText}>Completed</Text>
                </View>
              ) : (
                <View style={styles.dcCountdownRow}>
                  <Animated.View style={[styles.dcPulseDot, { opacity: pulseAnim }]} />
                  <Clock size={12} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.dcCountdownText}>{countdown || getTimeRemaining(dailyChallenge.endsAt)}</Text>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* ── Courses Horizontal Scroll ─────────────────── */}
        {courses.length > 0 && (
          <View style={styles.coursesSection}>
            <View style={[styles.sectionHeader, { paddingHorizontal: 20 }]}>
              <View style={styles.sectionTitleWrap}>
                <BookOpen size={22} color={COLORS.primary} strokeWidth={2.5} />
                <Text style={styles.sectionTitle}>Courses</Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/courses' as any)}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={courses}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.coursesListContent}
              keyExtractor={(item) => item.id}
              renderItem={({ item, index }) => {
                const pct = Math.min(item.progressPercent, 100);
                const isComplete = pct >= 100;
                const LEVEL_COLORS: Record<string, { bg: string; dark: string }> = {
                  'A1':           { bg: '#58CC02', dark: '#4CAD02' },
                  'A2':           { bg: '#1CB0F6', dark: '#1899D6' },
                  'B1':           { bg: '#FF9600', dark: '#E08600' },
                  'B2':           { bg: '#CE82FF', dark: '#B56AE8' },
                  'C1':           { bg: '#FF4B4B', dark: '#E04343' },
                  'C2':           { bg: '#2B70C9', dark: '#2460B0' },
                  'Beginner':     { bg: '#58CC02', dark: '#4CAD02' },
                  'Elementary':   { bg: '#1CB0F6', dark: '#1899D6' },
                  'Intermediate': { bg: '#FF9600', dark: '#E08600' },
                  'Advanced':     { bg: '#CE82FF', dark: '#B56AE8' },
                };
                const c = LEVEL_COLORS[item.level] || { bg: '#1E90FF', dark: '#1873CC' };

                return (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => router.push(`/course/${item.id}` as any)}
                    style={styles.courseCard}
                  >
                    <View style={[styles.courseCardInner, { backgroundColor: c.bg }]}>
                      {/* Bottom depth layer */}
                      <View style={[styles.courseCardDepth, { backgroundColor: c.dark }]} />

                      {/* Content */}
                      <View style={styles.courseContent}>
                        <View style={styles.courseTopRow}>
                          <View style={styles.courseLevelPill}>
                            <Text style={styles.courseLevelText}>{item.level}</Text>
                          </View>
                          {isComplete && <CheckCircle2 size={18} color="#fff" />}
                        </View>

                        <Text style={styles.courseTitle} numberOfLines={2}>{item.title}</Text>

                        <View style={styles.courseBottomRow}>
                          <Text style={styles.courseLessonsText}>
                            {item.completedLessons}/{item.totalLessons} lessons
                          </Text>
                          <View style={styles.courseProgressPill}>
                            <View style={styles.courseProgressBarBg}>
                              <View style={[styles.courseProgressBarFill, { width: `${Math.max(pct, 4)}%` as any }]} />
                            </View>
                          </View>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        )}

        {/* ── Weekly Insights (Stats Grid) ────────────────── */}
        {summary && (
          <View style={styles.statsWrapper}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleWrap}>
                <TrendingUp size={22} color={COLORS.primary} strokeWidth={2.5} />
                <Text style={styles.sectionTitle}>Weekly Insights</Text>
              </View>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <View style={styles.statHeader}>
                  <View style={[styles.statIconWrap, { backgroundColor: '#EEF2FF' }]}>
                    <BookOpen size={16} color={COLORS.primary} />
                  </View>
                  <Text style={styles.statLabel}>Grammar</Text>
                </View>
                <View style={styles.statValueRow}>
                  <Text style={styles.statValue}>{summary.improvements.grammar}</Text>
                  <View style={styles.statDelta}>
                    <ImprovementArrow value={summary.improvements.grammar} />
                  </View>
                </View>
              </View>
              
              <View style={styles.statCard}>
                <View style={styles.statHeader}>
                  <View style={[styles.statIconWrap, { backgroundColor: '#F0FDF4' }]}>
                    <Zap size={16} color={COLORS.success} />
                  </View>
                  <Text style={styles.statLabel}>Fluency</Text>
                </View>
                <View style={styles.statValueRow}>
                  <Text style={styles.statValue}>{summary.improvements.fluency}</Text>
                  <View style={styles.statDelta}>
                    <ImprovementArrow value={summary.improvements.fluency} />
                  </View>
                </View>
              </View>
              
              <View style={styles.statCard}>
                <View style={styles.statHeader}>
                  <View style={[styles.statIconWrap, { backgroundColor: '#FFFBEB' }]}>
                    <Sparkles size={16} color={COLORS.accent} />
                  </View>
                  <Text style={styles.statLabel}>Vocabulary</Text>
                </View>
                <View style={styles.statValueRow}>
                  <Text style={styles.statValue}>{summary.improvements.vocabulary}</Text>
                  <View style={styles.statDelta}>
                    <ImprovementArrow value={summary.improvements.vocabulary} />
                  </View>
                </View>
              </View>

              <View style={styles.statCard}>
                <View style={styles.statHeader}>
                  <View style={[styles.statIconWrap, { backgroundColor: '#FEF2F2' }]}>
                    <Mic size={16} color={COLORS.danger} />
                  </View>
                  <Text style={styles.statLabel}>Recordings</Text>
                </View>
                <View style={styles.statValueRow}>
                  <Text style={styles.statValue}>{summary.weeklyRecordings}</Text>
                  <View style={styles.statDelta}>
                     <Text style={[styles.statDeltaText, { color: COLORS.textMuted }]}>This Week</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ── Practice Tests ────────────────────── */}
        <View style={styles.testsWrapper}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleWrap}>
              <Mic size={22} color={COLORS.primary} strokeWidth={2.5} />
              <Text style={styles.sectionTitle}>Practice Speaking</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/speaking' as any)}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>

          {tests.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No reading tests available yet.</Text>
            </View>
          ) : (
            tests.slice(0, 3).map((test) => (
              <TouchableOpacity
                key={test.id}
                style={styles.testCard}
                activeOpacity={0.7}
                onPress={() => router.push({ pathname: '/speaking/[id]', params: { id: String(test.id) } } as any)}
              >
                <View style={styles.testIconWrap}>
                  <Mic size={24} color={COLORS.primary} strokeWidth={2} />
                </View>
                <View style={styles.testInfo}>
                  <Text style={styles.testTitle}>{test.title}</Text>
                  <View style={styles.testSubRow}>
                    <Text style={styles.testSub}>{test.questions?.length || 0} Topics • Speaking</Text>
                    {test.testType && (
                      <View style={styles.testTypeBadge}>
                        <Text style={styles.testTypeBadgeText}>{test.testType.toUpperCase()}</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.playButton}>
                  <PlayIcon fill="#FFF" color="#FFF" size={16} />
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* ── Practice Writing ────────────────────── */}
        <View style={styles.testsWrapper}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleWrap}>
              <FileText size={22} color={COLORS.primary} strokeWidth={2.5} />
              <Text style={styles.sectionTitle}>Practice Writing</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/writing/tests' as any)}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.testCard}
            activeOpacity={0.7}
            onPress={() => router.push('/writing/tests' as any)}
          >
            <View style={styles.testIconWrap}>
              <FileText size={24} color={COLORS.primary} strokeWidth={2} />
            </View>
            <View style={styles.testInfo}>
              <Text style={styles.testTitle}>Browse Writing Tests</Text>
              <View style={styles.testSubRow}>
                <Text style={styles.testSub}>IELTS & CEFR • AI Assessment</Text>
              </View>
            </View>
            <View style={styles.playButton}>
              <ChevronRight color="#FFF" size={16} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.testCard}
            activeOpacity={0.7}
            onPress={() => router.push('/writing/my' as any)}
          >
            <View style={[styles.testIconWrap, { backgroundColor: COLORS.success + '15' }]}>
              <FileText size={24} color={COLORS.success} strokeWidth={2} />
            </View>
            <View style={styles.testInfo}>
              <Text style={styles.testTitle}>My Writing Sessions</Text>
              <View style={styles.testSubRow}>
                <Text style={styles.testSub}>View your past essays & feedback</Text>
              </View>
            </View>
            <View style={styles.playButton}>
              <ChevronRight color="#FFF" size={16} />
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Leaderboard Preview ──────────────────── */}
        {leaderboard.length > 0 && (
          <View style={styles.lbWrapper}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleWrap}>
                <Trophy size={22} color={COLORS.gold} strokeWidth={2.5} />
                <Text style={styles.sectionTitle}>Top Learners</Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/leaderboard' as any)}>
                <Text style={styles.seeAllText}>View Rank</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.lbCard}>
              {leaderboard.slice(0, 3).map((entry, i) => {
                const isUser = entry.userId === user?.id;
                return (
                  <View
                    key={entry.userId}
                    style={[styles.lbRow, isUser && styles.lbHighlight]}
                  >
                    <View style={styles.lbRankBox}>
                      {i === 0 ? <Crown size={20} color={COLORS.gold} /> : 
                       i === 1 ? <Crown size={20} color="#94A3B8" /> : 
                       i === 2 ? <Crown size={20} color="#B45309" /> : 
                       <Text style={styles.lbRankText}>{i + 1}</Text>}
                    </View>
                    <Image
                      source={{ uri: entry.user.avatarUrl || 'https://i.ibb.co/68vS1zZ/default-avatar.png' }}
                      style={styles.lbAvatar}
                    />
                    <View style={styles.lbUserInfo}>
                      <Text style={styles.lbName} numberOfLines={1}>
                        {entry.user.fullName} {isUser && '(You)'}
                      </Text>
                      <Text style={styles.lbLevel}>Level {entry.level}</Text>
                    </View>
                    <View style={styles.lbScoreBox}>
                      <Text style={styles.lbScore}>{entry.weeklyXP || 0}</Text>
                      <Text style={styles.lbScoreLabel}>XP</Text>
                    </View>
                  </View>
                );
              })}
              
              {userRank > 3 && progress && (
                <View style={styles.lbDividerWrap}>
                  <View style={styles.lbDivider} />
                  <View style={[styles.lbRow, styles.lbHighlight, { marginTop: 8 }]}>
                    <View style={styles.lbRankBox}>
                      <Text style={styles.lbRankText}>{userRank}</Text>
                    </View>
                    <Image
                      source={{ uri: user?.avatarUrl || 'https://i.ibb.co/68vS1zZ/default-avatar.png' }}
                      style={styles.lbAvatar}
                    />
                    <View style={styles.lbUserInfo}>
                      <Text style={styles.lbName}>You</Text>
                      <Text style={styles.lbLevel}>Level {progress?.level || 0}</Text>
                    </View>
                    <View style={styles.lbScoreBox}>
                      <Text style={styles.lbScore}>{progress?.weeklyXP || 0}</Text>
                      <Text style={styles.lbScoreLabel}>XP</Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  
  // Header
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 10 : 8,
    paddingBottom: 20,
    backgroundColor: COLORS.background,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#FFF',
    backgroundColor: COLORS.border,
  },
  avatarShadow: {
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  greetingText: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '500',
    marginBottom: 2,
  },
  nameText: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  coinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  coinText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#D97706', // Amber 600
  },

  // Hero Card
  heroWrapper: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  heroCard: {
    borderRadius: 24,
    padding: 16,
    shadowColor: TG.streakOrange,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  streakBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  streakText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  levelBox: {
    alignItems: 'flex-end',
  },
  levelLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  levelValue: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 32,
  },
  heroProgressContainer: {
    gap: 10,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  xpLabel: {
    color: 'rgba(255, 255, 255, 0.95)',
    fontSize: 14,
    fontWeight: '700',
  },
  xpRemaining: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '500',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FFF',
    borderRadius: 4,
  },

  // Section Headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },

  // Daily Challenge Card
  dailyChallengeWrapper: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  dailyChallengeCard: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
    gap: 10,
  },
  dcTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dcLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  dcIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dcTextCol: {
    flex: 1,
  },
  dcTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  dcSubtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  dcBadgeDone: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  dcBadgeDoneText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
  },
  dcCountdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  dcPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  dcCountdownText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },

  // Courses Horizontal
  coursesSection: {
    marginBottom: 32,
  },
  coursesListContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  courseCard: {
    width: 165,
  },
  courseCardInner: {
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    paddingBottom: 6,
  },
  courseCardDepth: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 6,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  courseContent: {
    padding: 16,
    paddingBottom: 14,
  },
  courseTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  courseLevelPill: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  courseLevelText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  courseTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#fff',
    lineHeight: 21,
    marginBottom: 16,
    minHeight: 42,
  },
  courseBottomRow: {
    gap: 8,
  },
  courseLessonsText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
  },
  courseProgressPill: {
    marginTop: 2,
  },
  courseProgressBarBg: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  courseProgressBarFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#fff',
  },

  // Stats Grid
  statsWrapper: {
    paddingHorizontal: 20,
    marginBottom: 36,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    justifyContent: 'space-between',
  },
  statCard: {
    width: (width - 54) / 2,
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.02)',
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  statIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
  },
  statDelta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statDeltaText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Practice Tests
  testsWrapper: {
    paddingHorizontal: 20,
    marginBottom: 36,
  },
  testCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.02)',
    gap: 16,
  },
  testIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  testInfo: {
    flex: 1,
  },
  testTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 4,
  },
  testSub: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  testSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  testTypeBadge: {
    backgroundColor: COLORS.primary + '18',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  testTypeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.primary,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCard: {
    padding: 30,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'dashed',
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 15,
    fontWeight: '500',
  },

  // Leaderboard
  lbWrapper: {
    paddingHorizontal: 20,
    marginBottom: 40,
  },
  lbCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.02)',
  },
  lbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    gap: 14,
  },
  lbHighlight: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  lbRankBox: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lbRankText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textMuted,
  },
  lbAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E2E8F0',
  },
  lbUserInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  lbName: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 2,
  },
  lbLevel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  lbScoreBox: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  lbScore: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.accent,
  },
  lbScoreLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '700',
  },
  lbDividerWrap: {
    marginTop: 8,
  },
  lbDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 16,
  },
});
