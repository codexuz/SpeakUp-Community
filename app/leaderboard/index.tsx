import { TG } from '@/constants/theme';
import { apiFetchLeaderboard } from '@/lib/api';
import type { LeaderboardEntry, LeaderboardResponse } from '@/lib/types';
import { useAuth } from '@/store/auth';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import {
    ChevronLeft,
    Crown,
    Flame,
    Sparkles,
    TrendingUp,
    Trophy
} from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Image,
    Platform,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const AVATAR_SM = 44;
const AVATAR_MD = 56;
const AVATAR_LG = 74;

type TabKey = 'weekly' | 'alltime' | 'streak';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'weekly', label: 'Weekly' },
  { key: 'alltime', label: 'All Time' },
  { key: 'streak', label: 'Streak' },
];

const RANK_THEME = {
  1: {
    bg: '#FEF3C7',
    border: '#F59E0B',
    text: '#92400E',
    grad: ['#FBBF24', '#F59E0B'] as [string, string],
    glow: 'rgba(245, 158, 11, 0.30)',
  },
  2: {
    bg: '#F1F5F9',
    border: '#94A3B8',
    text: '#475569',
    grad: ['#CBD5E1', '#94A3B8'] as [string, string],
    glow: 'rgba(148, 163, 184, 0.25)',
  },
  3: {
    bg: '#FFF7ED',
    border: '#EA580C',
    text: '#9A3412',
    grad: ['#FB923C', '#EA580C'] as [string, string],
    glow: 'rgba(234, 88, 12, 0.25)',
  },
} as const;

export default function LeaderboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [tab, setTab] = useState<TabKey>('weekly');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async (type: TabKey = tab) => {
    try {
      const res: LeaderboardResponse = await apiFetchLeaderboard(type, 50);
      setEntries(res.data || []);
      setUserRank(res.userRank || 0);
    } catch (e) {
      console.error('Failed to load leaderboard', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData();
    }, [tab]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [tab]);

  const switchTab = (key: TabKey) => {
    if (key === tab) return;
    setTab(key);
    setLoading(true);
    loadData(key);
  };

  const getXP = (entry: LeaderboardEntry) => {
    if (tab === 'streak') return entry.currentStreak ?? 0;
    if (tab === 'weekly') return entry.weeklyXP ?? 0;
    return entry.xp ?? 0;
  };

  const xpLabel = tab === 'streak' ? 'days' : 'XP';
  const hasPodium = entries.length >= 3;
  const podiumEntries = hasPodium ? entries.slice(0, 3) : [];
  const listEntries = hasPodium
    ? entries.slice(3).map((e, i) => ({ ...e, _rank: i + 4 }))
    : entries.map((e, i) => ({ ...e, _rank: i + 1 }));

  // ═══════════════════════════════════════════
  // Podium Card
  // ═══════════════════════════════════════════
  const PodiumCard = ({ entry, rank }: { entry: LeaderboardEntry; rank: 1 | 2 | 3 }) => {
    const t = RANK_THEME[rank];
    const isFirst = rank === 1;
    const size = isFirst ? AVATAR_LG : AVATAR_MD;
    const isMe = entry.userId === user?.id;

    return (
      <View style={[s.podCard, isFirst && s.podCardFirst]}>
        {/* Soft glow */}
        <View
          style={[
            s.podGlow,
            {
              backgroundColor: t.glow,
              width: size + 24,
              height: size + 24,
              borderRadius: (size + 24) / 2,
            },
          ]}
        />

        {/* Crown */}
        {isFirst && (
          <View style={s.crownWrap}>
            <Crown size={28} color="#F59E0B" fill="#FDE68A" />
          </View>
        )}

        {/* Avatar ring */}
        <View
          style={[
            s.podAvatarRing,
            {
              width: size + 8,
              height: size + 8,
              borderRadius: (size + 8) / 2,
              borderColor: t.border,
            },
          ]}
        >
          <Image
            source={{ uri: entry.user.avatarUrl || 'https://i.ibb.co/68vS1zZ/default-avatar.png' }}
            style={{ width: size, height: size, borderRadius: size / 2 }}
          />
        </View>

        {/* Rank badge */}
        <LinearGradient
          colors={t.grad}
          style={s.podRankBadge}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={s.podRankNum}>{rank}</Text>
        </LinearGradient>

        {/* Name */}
        <Text style={[s.podName, isFirst && s.podNameFirst]} numberOfLines={1}>
          {entry.user.fullName.split(' ')[0]}
          {isMe ? ' (You)' : ''}
        </Text>

        {/* XP pill */}
        <View style={[s.podScorePill, { backgroundColor: t.bg }]}>
          <Text style={[s.podScoreVal, { color: t.text }]}>
            {getXP(entry).toLocaleString()} {xpLabel}
          </Text>
        </View>

        {/* Level */}
        <Text style={s.podLevel}>Lvl {entry.level}</Text>
      </View>
    );
  };

  // ═══════════════════════════════════════════
  // List Header (tabs + podium + divider)
  // ═══════════════════════════════════════════
  const renderHeader = () => (
    <>
      {/* Tab selector */}
      <View style={s.tabBar}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[s.tabBtn, active && s.tabBtnActive]}
              onPress={() => switchTab(t.key)}
              activeOpacity={0.7}
            >
              {active ? (
                <LinearGradient
                  colors={['#6366F1', '#818CF8'] as const}
                  style={[StyleSheet.absoluteFill, { borderRadius: 12 }]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
              ) : null}
              <Text style={[s.tabLabel, active && s.tabLabelActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Podium */}
      {hasPodium && (
        <View style={s.podRow}>
          <PodiumCard entry={podiumEntries[1]} rank={2} />
          <PodiumCard entry={podiumEntries[0]} rank={1} />
          <PodiumCard entry={podiumEntries[2]} rank={3} />
        </View>
      )}

      {/* Divider */}
      {listEntries.length > 0 && (
        <View style={s.dividerRow}>
          <View style={s.dividerLine} />
          <Text style={s.dividerText}>Rankings</Text>
          <View style={s.dividerLine} />
        </View>
      )}
    </>
  );

  // ═══════════════════════════════════════════
  // List Row
  // ═══════════════════════════════════════════
  const maxXP = entries.length > 0 ? Math.max(...entries.map(getXP), 1) : 1;

  const RankIcon = ({ rank }: { rank: number }) => {
    if (rank === 1) return <Crown size={16} color="#F59E0B" fill="#FDE68A" />;
    if (rank === 2) return <Crown size={16} color="#94A3B8" fill="#CBD5E1" />;
    if (rank === 3) return <Crown size={16} color="#EA580C" fill="#FDBA74" />;
    return <Text style={s.rowRankNum}>{rank}</Text>;
  };

  const renderItem = ({ item }: { item: LeaderboardEntry & { _rank: number } }) => {
    const isMe = item.userId === user?.id;
    const xpVal = getXP(item);
    const barPercent = Math.min((xpVal / maxXP) * 100, 100);

    return (
      <TouchableOpacity
        style={[s.row, isMe && s.rowHighlight]}
        activeOpacity={0.65}
        onPress={() => router.push(`/user/${item.userId}` as any)}
      >
        {/* Left: rank + avatar */}
        <View style={s.rowLeft}>
          <View style={[s.rowRankWrap, isMe && s.rowRankWrapSelf]}>
            <RankIcon rank={item._rank} />
          </View>

          <View style={s.rowAvatarWrap}>
            <Image
              source={{ uri: item.user.avatarUrl || 'https://i.ibb.co/68vS1zZ/default-avatar.png' }}
              style={[s.rowAvatar, isMe && s.rowAvatarSelf]}
            />
            <View style={s.rowLevelPip}>
              <Text style={s.rowLevelText}>{item.level}</Text>
            </View>
          </View>
        </View>

        {/* Center: name + bar */}
        <View style={s.rowCenter}>
          <View style={s.rowNameRow}>
            <Text style={[s.rowName, isMe && s.rowNameSelf]} numberOfLines={1}>
              {item.user.fullName}{isMe ? ' (You)' : ''}
            </Text>
            {item.currentStreak != null && item.currentStreak > 0 && (
              <View style={s.streakChip}>
                <Flame size={10} color="#F97316" fill="#FDBA74" />
                <Text style={s.streakVal}>{item.currentStreak}</Text>
              </View>
            )}
          </View>
          <Text style={s.rowHandle}>@{item.user.username}</Text>
          {/* XP progress bar */}
          <View style={s.rowBarTrack}>
            <LinearGradient
              colors={isMe ? ['#6366F1', '#818CF8'] as const : ['#C7D2FE', '#A5B4FC'] as const}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[s.rowBarFill, { width: `${barPercent}%` }]}
            />
          </View>
        </View>

        {/* Right: score */}
        <View style={s.rowScoreCol}>
          <Text style={[s.rowScore, isMe && s.rowScoreSelf]}>
            {xpVal.toLocaleString()}
          </Text>
          <Text style={s.rowScoreUnit}>{xpLabel}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  // ═══════════════════════════════════════════
  // Shared header chrome
  // ═══════════════════════════════════════════
  const HeaderChrome = () => (
    <>
      <LinearGradient
        colors={['#4338CA', '#6366F1', '#818CF8'] as const}
        style={s.headerGrad}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <View style={[s.deco, s.deco1]} />
      <View style={[s.deco, s.deco2]} />
      <View style={[s.deco, s.deco3]} />
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={22} color="#fff" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Trophy size={20} color="#FDE68A" fill="#FDE68A" />
          <Text style={s.headerTitle}>Leaderboard</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>
    </>
  );

  // ── Loading ──
  if (loading) {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <HeaderChrome />
        <View style={s.loadWrap}>
          <ActivityIndicator size="large" color="#818CF8" />
          <Text style={s.loadText}>Loading rankings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main ──
  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <HeaderChrome />

      {/* Rank banner */}
      {userRank > 0 && (
        <View style={s.rankBanner}>
          <LinearGradient
            colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.06)'] as const}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          <View style={s.rankBannerLeft}>
            <View style={s.rankBannerIcon}>
              <TrendingUp size={16} color="#FDE68A" />
            </View>
            <View>
              <Text style={s.rankBannerLabel}>Your Position</Text>
              <Text style={s.rankBannerVal}>#{userRank}</Text>
            </View>
          </View>
          <View style={s.rankBannerRight}>
            <Sparkles size={14} color="rgba(255,255,255,0.6)" />
            <Text style={s.rankBannerHint}>Keep practicing!</Text>
          </View>
        </View>
      )}

      <FlatList
        data={listEntries}
        keyExtractor={(item) => item.userId}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          !hasPodium && entries.length === 0 ? (
            <View style={s.emptyWrap}>
              <View style={s.emptyIcon}>
                <Trophy size={42} color={TG.textHint} />
              </View>
              <Text style={s.emptyTitle}>No Rankings Yet</Text>
              <Text style={s.emptySub}>Start practicing to climb the leaderboard!</Text>
            </View>
          ) : null
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.listContent}
        style={s.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#fff"
            colors={[TG.accent]}
          />
        }
      />
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════
const SHADOW = Platform.select({
  ios: {
    shadowColor: '#1e1b4b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  android: { elevation: 0.5 },
}) as object;

const SHADOW_SM = Platform.select({
  ios: {
    shadowColor: '#1e1b4b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  android: { elevation: 0 },
}) as object;

const s = StyleSheet.create({
  // ── Layout ──
  container: { flex: 1, backgroundColor: '#F4F2FF' },
  list: { flex: 1 },
  listContent: { paddingBottom: 50 },

  // ── Header gradient & decorations ──
  headerGrad: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 380,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
  },
  deco: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  deco1: { width: 180, height: 180, top: -40, right: -50 },
  deco2: { width: 120, height: 120, top: 80, left: -30 },
  deco3: { width: 80, height: 80, top: 200, right: 30 },

  // ── Header bar ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },

  // ── Rank banner ──
  rankBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 6,
  },
  rankBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rankBannerIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBannerLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '500' },
  rankBannerVal: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
  rankBannerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rankBannerHint: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '500' },

  // ── Tab bar ──
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    padding: 4,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
    overflow: 'hidden',
  },
  tabBtnActive: {},
  tabLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
  tabLabelActive: { color: '#fff', fontWeight: '700' },

  // ── Podium ──
  podRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    marginBottom: 28,
    minHeight: 230,
  },
  podCard: {
    alignItems: 'center',
    width: (width - 44) / 3,
    paddingTop: 24,
  },
  podCardFirst: {
    paddingTop: 0,
    marginTop: -10,
  },
  podGlow: {
    position: 'absolute',
    top: 14,
    alignSelf: 'center',
  },
  crownWrap: {
    marginBottom: -6,
    zIndex: 10,
  },
  podAvatarRing: {
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  podRankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -12,
    borderWidth: 2,
    borderColor: '#fff',
    zIndex: 10,
  },
  podRankNum: { color: '#fff', fontSize: 12, fontWeight: '800' },
  podName: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
  podNameFirst: { fontSize: 15, fontWeight: '700' },
  podScorePill: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  podScoreVal: { fontSize: 12, fontWeight: '700' },
  podLevel: { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '500', marginTop: 4 },

  // ── Divider ──
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 24,
    marginBottom: 16,
    marginTop: 4,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E2E0F0' },
  dividerText: {
    marginHorizontal: 14,
    color: '#dfdfdf',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  // ── List rows ──
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 10,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EDEBF5',
    ...SHADOW_SM,
  },
  rowHighlight: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    ...SHADOW,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowRankWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: '#F4F2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowRankWrapSelf: {
    backgroundColor: '#EEF2FF',
  },
  rowRankNum: { fontSize: 14, fontWeight: '800', color: '#8B85B1' },
  rowAvatarWrap: { position: 'relative' },
  rowAvatar: {
    width: AVATAR_SM,
    height: AVATAR_SM,
    borderRadius: AVATAR_SM / 2,
    borderWidth: 2,
    borderColor: '#E2E0F0',
  },
  rowAvatarSelf: {
    borderColor: '#C7D2FE',
  },
  rowLevelPip: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  rowLevelText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  rowCenter: { flex: 1, marginHorizontal: 10 },
  rowNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 1 },
  rowName: { fontSize: 14, fontWeight: '700', color: '#1E1B4B', flexShrink: 1 },
  rowNameSelf: { color: '#4338CA' },
  rowHandle: { fontSize: 11, color: '#A5A1C5', marginBottom: 6 },
  rowBarTrack: {
    height: 5,
    backgroundColor: '#F0EEF8',
    borderRadius: 3,
    overflow: 'hidden',
  },
  rowBarFill: {
    height: '100%',
    borderRadius: 3,
    minWidth: 6,
  },
  rowScoreCol: { alignItems: 'flex-end', minWidth: 48 },
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 2,
  },
  streakVal: { color: '#EA580C', fontSize: 10, fontWeight: '700' },
  rowScore: { fontSize: 16, fontWeight: '800', color: '#4338CA' },
  rowScoreSelf: { color: '#6366F1' },
  rowScoreUnit: { fontSize: 10, color: '#A5A1C5', fontWeight: '600', marginTop: 1 },

  // ── Loading ──
  loadWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 },
  loadText: { color: '#8B85B1', fontSize: 14, fontWeight: '500' },

  // ── Empty ──
  emptyWrap: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EDEBFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1E1B4B', marginBottom: 6 },
  emptySub: { fontSize: 14, color: '#8B85B1', textAlign: 'center', paddingHorizontal: 40 },
});
