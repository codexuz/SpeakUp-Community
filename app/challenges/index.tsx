import { TG } from '@/constants/theme';
import { apiFetchChallengeHistory, apiFetchChallenges } from '@/lib/api';
import type { Challenge, ChallengeSubmission } from '@/lib/types';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Flame,
  Mic,
  Sparkles,
  Target,
  Trophy,
  Users,
  Zap,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const DIFFICULTY_THEME: Record<string, { bg: string; text: string; dot: string }> = {
  beginner: { bg: '#ECFDF5', text: '#059669', dot: '#10B981' },
  intermediate: { bg: '#FFFBEB', text: '#D97706', dot: '#F59E0B' },
  advanced: { bg: '#FEF2F2', text: '#DC2626', dot: '#EF4444' },
};

const TAB_CONFIG: { key: Tab; label: string; icon: any }[] = [
  { key: 'daily', label: 'Daily', icon: Target },
  { key: 'weekly', label: 'Weekly', icon: Trophy },
  { key: 'history', label: 'History', icon: Clock },
];

type Tab = 'daily' | 'weekly' | 'history';

export default function ChallengesScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('daily');
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [history, setHistory] = useState<ChallengeSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyHasMore, setHistoryHasMore] = useState(true);
  const [countdown, setCountdown] = useState('');

  // Animations
  const tabIndicator = useRef(new Animated.Value(0)).current;
  const pulseDot = useRef(new Animated.Value(1)).current;

  const loadChallenges = async () => {
    try {
      const type = tab === 'history' ? undefined : tab;
      if (tab === 'history') {
        const res = await apiFetchChallengeHistory(1, 20);
        setHistory(res.data || []);
        setHistoryPage(1);
        setHistoryHasMore((res.data?.length || 0) >= 20);
      } else {
        const res = await apiFetchChallenges(type);
        setChallenges(res.data || []);
      }
    } catch (e) {
      console.error('Failed to load challenges', e);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreHistory = async () => {
    if (!historyHasMore) return;
    const nextPage = historyPage + 1;
    try {
      const res = await apiFetchChallengeHistory(nextPage, 20);
      setHistory((prev) => [...prev, ...(res.data || [])]);
      setHistoryPage(nextPage);
      setHistoryHasMore((res.data?.length || 0) >= 20);
    } catch {}
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadChallenges();
    }, [tab]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadChallenges();
    setRefreshing(false);
  }, [tab]);

  // Animated tab indicator
  useEffect(() => {
    const idx = TAB_CONFIG.findIndex((t) => t.key === tab);
    Animated.spring(tabIndicator, { toValue: idx, friction: 8, useNativeDriver: true }).start();
  }, [tab]);

  // Pulse animation
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseDot, { toValue: 0.3, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseDot, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // Global countdown for first active challenge
  useEffect(() => {
    const active = challenges.find((c) => c.isActive && !c.submitted);
    if (!active) { setCountdown(''); return; }
    const tick = () => {
      const diff = new Date(active.endsAt).getTime() - Date.now();
      if (diff <= 0) { setCountdown('Expired'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${h}h ${m}m ${s}s`);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [challenges]);

  const getTimeLabel = (endsAt: string) => {
    const diff = new Date(endsAt).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (d > 0) return `${d}d ${h}h left`;
    return `${h}h ${m}m left`;
  };

  const tabWidth = (width - 32) / TAB_CONFIG.length;

  // ── CHALLENGE CARD ──
  const ChallengeCard = ({ item }: { item: Challenge }) => {
    const diff = DIFFICULTY_THEME[item.difficulty.toLowerCase()] || DIFFICULTY_THEME.beginner;
    const isCompleted = item.submitted;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => router.push(`/challenges/${item.id}` as any)}
      >
        <View style={styles.cardBody}>
          {/* Top row: difficulty + status */}
          <View style={styles.cardHeaderRow}>
            <View style={[styles.diffPill, { backgroundColor: diff.bg }]}>
              <View style={[styles.diffDot, { backgroundColor: diff.dot }]} />
              <Text style={[styles.diffText, { color: diff.text }]}>{item.difficulty}</Text>
            </View>
            {isCompleted ? (
              <View style={styles.completedBadge}>
                <CheckCircle2 size={13} color="#10B981" />
                <Text style={styles.completedText}>Completed</Text>
              </View>
            ) : (
              <View style={styles.cardMeta}>
                <Clock size={13} color={TG.textHint} />
                <Text style={styles.metaText}>{getTimeLabel(item.endsAt)}</Text>
              </View>
            )}
          </View>

          {/* Title */}
          <Text style={styles.cardTitle}>{item.title}</Text>

          {/* Prompt */}
          <Text style={styles.promptText} numberOfLines={2}>{item.promptText}</Text>

          {/* Bottom row: meta + action */}
          <View style={styles.cardFooter}>
            <View style={styles.cardMetaRow}>
              <View style={styles.cardMeta}>
                <Users size={13} color={TG.textHint} />
                <Text style={styles.metaText}>{item.participantCount}</Text>
              </View>
              <View style={styles.cardMeta}>
                <Zap size={13} color="#F59E0B" />
                <Text style={styles.metaXP}>{item.xpReward} XP</Text>
              </View>
              {item.coinReward > 0 && (
                <View style={styles.cardMeta}>
                  <Text style={{ fontSize: 12 }}>🪙</Text>
                  <Text style={styles.metaXP}>{item.coinReward}</Text>
                </View>
              )}
            </View>
            {!isCompleted && (
              <TouchableOpacity
                style={styles.ctaBtn}
                activeOpacity={0.8}
                onPress={() => router.push(`/challenges/${item.id}` as any)}
              >
                <Mic size={15} color="#fff" />
                <Text style={styles.ctaBtnText}>Record</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ── HISTORY ITEM ──
  const HistoryItem = ({ item }: { item: ChallengeSubmission }) => (
    <TouchableOpacity
      style={styles.historyCard}
      activeOpacity={0.7}
      onPress={() => item.responseId && router.push(`/ai-feedback/${item.responseId}` as any)}
    >
      <View style={styles.historyIconWrap}>
        <CheckCircle2 size={20} color="#10B981" />
      </View>
      <View style={styles.historyInfo}>
        <Text style={styles.historyTitle} numberOfLines={1}>{item.challenge?.title || 'Challenge'}</Text>
        <View style={styles.historyMetaRow}>
          <Text style={styles.historyMeta}>{item.challenge?.type}</Text>
          <View style={styles.historyDot} />
          <Text style={styles.historyMeta}>{item.challenge?.difficulty}</Text>
          <View style={styles.historyDot} />
          <Text style={styles.historyXP}>+{item.challenge?.xpReward} XP</Text>
        </View>
      </View>
      <View style={styles.historyDateCol}>
        <Text style={styles.historyDay}>
          {new Date(item.submittedAt).toLocaleDateString('en-US', { day: 'numeric' })}
        </Text>
        <Text style={styles.historyMonth}>
          {new Date(item.submittedAt).toLocaleDateString('en-US', { month: 'short' })}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      {/* Header */}
      <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Flame size={20} color="#FF6B35" />
          <Text style={styles.headerTitle}>Challenges</Text>
        </View>
        <View style={{ width: 22 }} />
      </LinearGradient>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <Animated.View
          style={[
            styles.tabIndicator,
            {
              width: tabWidth - 8,
              transform: [{
                translateX: tabIndicator.interpolate({
                  inputRange: [0, 1, 2],
                  outputRange: [4, tabWidth + 4, tabWidth * 2 + 4],
                }),
              }],
            },
          ]}
        />
        {TAB_CONFIG.map((t) => {
          const isActive = tab === t.key;
          const Icon = t.icon;
          return (
            <TouchableOpacity
              key={t.key}
              style={styles.tabItem}
              onPress={() => setTab(t.key)}
              activeOpacity={0.7}
            >
              <Icon size={18} color={isActive ? '#fff' : TG.textHint} strokeWidth={isActive ? 2.5 : 2} />
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={TG.accent} />
        </View>
      ) : tab === 'history' ? (
        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <HistoryItem item={item} />}
          contentContainerStyle={styles.listContent}
          onEndReached={loadMoreHistory}
          onEndReachedThreshold={0.3}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TG.accent} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Calendar size={40} color={TG.textHint} strokeWidth={1.5} />
              </View>
              <Text style={styles.emptyTitle}>No History Yet</Text>
              <Text style={styles.emptySubtitle}>Complete your first challenge to see it here</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={challenges}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ChallengeCard item={item} />}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TG.accent} />}
          ListHeaderComponent={
            countdown && tab === 'daily' ? (
              <LinearGradient colors={['#1E293B', '#334155']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.countdownBanner}>
                <Animated.View style={[styles.countdownDot, { opacity: pulseDot }]} />
                <Clock size={14} color="#38BDF8" />
                <Text style={styles.countdownLabel}>Time remaining</Text>
                <Text style={styles.countdownValue}>{countdown}</Text>
              </LinearGradient>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Sparkles size={40} color={TG.textHint} strokeWidth={1.5} />
              </View>
              <Text style={styles.emptyTitle}>No {tab === 'daily' ? 'Daily' : 'Weekly'} Challenges</Text>
              <Text style={styles.emptySubtitle}>Check back later for new challenges</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F172A' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },

  // Countdown
  countdownBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    gap: 8,
  },
  countdownDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#38BDF8' },
  countdownLabel: { fontSize: 13, fontWeight: '600', color: '#94A3B8', flex: 1 },
  countdownValue: { fontSize: 16, fontWeight: '900', color: '#38BDF8', fontVariant: ['tabular-nums'], letterSpacing: 0.5 },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    marginTop: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#E2E8F0',
    borderRadius: 16,
    padding: 4,
    position: 'relative',
  },
  tabIndicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    borderRadius: 12,
    backgroundColor: TG.accent,
    shadowColor: TG.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
    zIndex: 1,
  },
  tabText: { fontSize: 14, fontWeight: '700', color: TG.textHint },
  tabTextActive: { color: '#fff' },

  // List
  listContent: { paddingHorizontal: 16, paddingBottom: 100, paddingTop: 14, gap: 12, backgroundColor: '#F8FAFC', flexGrow: 1 },

  // Challenge Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 0.3,
  },
  cardBody: { padding: 16 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  diffPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  diffDot: { width: 6, height: 6, borderRadius: 3 },
  diffText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  completedText: { fontSize: 12, fontWeight: '600', color: '#10B981' },

  cardTitle: { fontSize: 17, fontWeight: '700', color: TG.textPrimary, letterSpacing: -0.2, marginBottom: 6 },

  promptText: {
    fontSize: 14,
    color: TG.textSecondary,
    lineHeight: 20,
    marginBottom: 14,
  },

  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardMetaRow: { flexDirection: 'row', gap: 12 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: TG.textHint, fontWeight: '500' },
  metaXP: { fontSize: 12, color: '#B45309', fontWeight: '600' },

  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: TG.accent,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  ctaBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  // History
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 14,
    gap: 12,
  },
  historyIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyInfo: { flex: 1 },
  historyTitle: { fontSize: 15, fontWeight: '700', color: TG.textPrimary, marginBottom: 4 },
  historyMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  historyMeta: { fontSize: 12, fontWeight: '600', color: TG.textHint, textTransform: 'capitalize' },
  historyDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: TG.textHint },
  historyXP: { fontSize: 12, fontWeight: '700', color: '#D97706' },
  historyDateCol: { alignItems: 'center' },
  historyDay: { fontSize: 20, fontWeight: '800', color: TG.textPrimary, lineHeight: 24 },
  historyMonth: { fontSize: 11, fontWeight: '600', color: TG.textHint, textTransform: 'uppercase' },

  // Empty
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: TG.textPrimary, marginBottom: 6 },
  emptySubtitle: { fontSize: 14, color: TG.textSecondary, fontWeight: '500' },
});
