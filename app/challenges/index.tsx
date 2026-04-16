import { TG } from '@/constants/theme';
import { apiFetchChallengeHistory, apiFetchChallenges } from '@/lib/api';
import type { Challenge, ChallengeSubmission } from '@/lib/types';
import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowLeft, Clock, Mic, Target, Trophy, Users } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

  const getTimeRemaining = (endsAt: string) => {
    const diff = new Date(endsAt).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (d > 0) return `${d}d ${h}h left`;
    return `${h}h ${m}m left`;
  };

  const getDifficultyColor = (d: string) => {
    switch (d.toLowerCase()) {
      case 'beginner': return TG.scoreGreen;
      case 'intermediate': return TG.scoreYellow;
      case 'advanced': return TG.scoreOrange;
      default: return TG.textSecondary;
    }
  };

  const ChallengeCard = ({ item }: { item: Challenge }) => (
    <TouchableOpacity
      style={styles.challengeCard}
      activeOpacity={0.7}
      onPress={() => router.push(`/challenge/${item.id}` as any)}
    >
      <View style={styles.challengeHeader}>
        <View style={styles.challengeTypeRow}>
          {item.type === 'daily' ? (
            <Target size={18} color={TG.streakOrange} />
          ) : (
            <Trophy size={18} color={TG.achievePurple} />
          )}
          <Text style={styles.challengeType}>{item.type.charAt(0).toUpperCase() + item.type.slice(1)}</Text>
          <View style={[styles.diffBadge, { backgroundColor: getDifficultyColor(item.difficulty) + '20' }]}>
            <Text style={[styles.diffText, { color: getDifficultyColor(item.difficulty) }]}>{item.difficulty}</Text>
          </View>
        </View>
        {item.submitted && (
          <View style={styles.submittedBadge}>
            <Text style={styles.submittedText}>✓ Done</Text>
          </View>
        )}
      </View>

      <Text style={styles.challengeTitle}>{item.title}</Text>
      {item.description && <Text style={styles.challengeDesc}>{item.description}</Text>}

      <Text style={styles.promptText}>{item.promptText}</Text>

      <View style={styles.challengeFooter}>
        <View style={styles.challengeMeta}>
          <Clock size={13} color={TG.textHint} />
          <Text style={styles.metaText}>{getTimeRemaining(item.endsAt)}</Text>
        </View>
        <View style={styles.challengeMeta}>
          <Users size={13} color={TG.textHint} />
          <Text style={styles.metaText}>{item.participantCount} participants</Text>
        </View>
      </View>

      <View style={styles.rewardsRow}>
        <Text style={styles.rewardText}>+{item.xpReward} XP</Text>
        {item.coinReward > 0 && <Text style={styles.rewardCoin}>+{item.coinReward} 🪙</Text>}
      </View>

      {!item.submitted && (
        <TouchableOpacity
          style={styles.recordBtn}
          activeOpacity={0.7}
          onPress={() => router.push(`/challenge/${item.id}` as any)}
        >
          <Mic size={18} color="#fff" />
          <Text style={styles.recordBtnText}>Record Now</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  const HistoryItem = ({ item }: { item: ChallengeSubmission }) => (
    <TouchableOpacity
      style={styles.historyItem}
      activeOpacity={0.7}
      onPress={() => item.responseId && router.push(`/ai-feedback/${item.responseId}` as any)}
    >
      <View style={styles.historyIcon}>
        <Target size={18} color={TG.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.historyTitle}>{item.challenge?.title || 'Challenge'}</Text>
        <Text style={styles.historySub}>
          {item.challenge?.type} · {item.challenge?.difficulty} · +{item.challenge?.xpReward} XP
        </Text>
      </View>
      <Text style={styles.historyDate}>
        {new Date(item.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={TG.headerBg} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={22} color={TG.textWhite} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Challenges</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* ── Tabs ────────────────────── */}
      <View style={styles.tabRow}>
        {(['daily', 'weekly', 'history'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabItem, tab === t && styles.tabItemActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

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
          ListEmptyComponent={<Text style={styles.emptyText}>No challenge submissions yet. Start a challenge!</Text>}
        />
      ) : (
        <ScrollView
          style={{ flex: 1, backgroundColor: TG.bgSecondary }}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TG.accent} />}
        >
          {challenges.length === 0 ? (
            <Text style={styles.emptyText}>No {tab} challenges available right now.</Text>
          ) : (
            challenges.map((c) => <ChallengeCard key={c.id} item={c} />)
          )}
        </ScrollView>
      )}
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
  headerTitle: { fontSize: 18, fontWeight: '700', color: TG.textWhite },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: TG.bg,
    borderBottomWidth: 0.5,
    borderBottomColor: TG.separator,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: { borderBottomColor: TG.accent },
  tabText: { fontSize: 14, fontWeight: '600', color: TG.textHint },
  tabTextActive: { color: TG.accent },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: TG.bgSecondary },
  listContent: { padding: 14, paddingBottom: 100, gap: 12 },
  emptyText: { color: TG.textSecondary, textAlign: 'center', paddingVertical: 40, fontSize: 15 },

  // Challenge Card
  challengeCard: {
    backgroundColor: TG.bg,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  challengeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  challengeTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  challengeType: { fontSize: 12, fontWeight: '600', color: TG.textSecondary },
  diffBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  diffText: { fontSize: 11, fontWeight: '600' },
  submittedBadge: {
    backgroundColor: TG.scoreGreen,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  submittedText: { fontSize: 11, fontWeight: '600', color: '#fff' },

  challengeTitle: { fontSize: 18, fontWeight: '700', color: TG.textPrimary, marginBottom: 4 },
  challengeDesc: { fontSize: 13, color: TG.textSecondary, marginBottom: 8 },
  promptText: {
    fontSize: 14,
    color: TG.textPrimary,
    lineHeight: 21,
    backgroundColor: TG.bgSecondary,
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },

  challengeFooter: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  challengeMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: TG.textHint },

  rewardsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  rewardText: { fontSize: 13, fontWeight: '700', color: TG.gold },
  rewardCoin: { fontSize: 13, fontWeight: '700', color: TG.coinGold },

  recordBtn: {
    backgroundColor: TG.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  recordBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // History
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TG.bg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 12,
  },
  historyIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: TG.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyTitle: { fontSize: 15, fontWeight: '600', color: TG.textPrimary },
  historySub: { fontSize: 12, color: TG.textSecondary, marginTop: 2 },
  historyDate: { fontSize: 12, color: TG.textHint },
});
