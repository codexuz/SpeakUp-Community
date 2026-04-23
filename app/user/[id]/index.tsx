import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import {
  apiFetchAchievements,
  apiFetchCommunityFeed,
  apiFetchReputation,
  apiFollowUser,
  apiGetFollowers,
  apiGetFollowing,
  apiGetUserProfile,
  apiGetUserSessions,
  apiUnfollowUser,
  FollowListItem,
  TestSession,
  UserProfileResponse,
} from '@/lib/api';
import { Achievement, UserReputation } from '@/lib/types';
import { useAuth } from '@/store/auth';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Award,
  Flame,
  Heart,
  MessageCircle,
  Mic,
  Shield,
  Star,
  Users,
  Zap,
} from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const COLORS = {
  primary: TG.headerBg,
  accent: TG.accent,
  background: TG.bgSecondary,
  surface: TG.bg,
  text: TG.textPrimary,
  textMuted: TG.textSecondary,
  border: TG.separator,
  gradientPrimary: [TG.headerBg, TG.accentDark] as [string, string],
  gradientAccent: [TG.streakOrange, '#EF4444'] as [string, string],
};

type ListMode = 'followers' | 'following';

export default function PublicUserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();

  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [sessions, setSessions] = useState<TestSession[]>([]);
  const [reputation, setReputation] = useState<UserReputation | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);

  const [listMode, setListMode] = useState<ListMode>('followers');
  const [listOpen, setListOpen] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [listData, setListData] = useState<FollowListItem[]>([]);
  const [listBusyIds, setListBusyIds] = useState<Set<string>>(new Set());
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  const loadProfile = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [profileRes, repRes, achieveRes] = await Promise.allSettled([
        apiGetUserProfile(id),
        apiFetchReputation(id),
        apiFetchAchievements(),
      ]);

      if (profileRes.status === 'fulfilled') setProfile(profileRes.value);
      if (repRes.status === 'fulfilled') setReputation(repRes.value);
      if (achieveRes.status === 'fulfilled') setAchievements(achieveRes.value.data || []);

      // Sessions endpoint may not exist in all backend versions.
      try {
        const s = await apiGetUserSessions(id, 1, 20);
        setSessions(s.data || []);
      } catch {
        const feed = await apiFetchCommunityFeed('latest', 1, 100);
        const filtered = (feed.data || []).filter(
          (x: any) => x.user?.id === id || x.student?.id === id,
        );
        setSessions(filtered);
      }
    } catch (e: any) {
      toast.error('Error', e.message || 'Failed to load user profile');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  }, [loadProfile]);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile]),
  );

  const openList = async (mode: ListMode) => {
    if (!id) return;
    setListMode(mode);
    setListOpen(true);
    setListLoading(true);
    try {
      const res = mode === 'followers' ? await apiGetFollowers(id, 1, 50) : await apiGetFollowing(id, 1, 50);
      setListData(res.data || []);
    } catch (e: any) {
      toast.error('Error', e.message || `Failed to load ${mode}`);
      setListData([]);
    } finally {
      setListLoading(false);
    }
  };

  const toggleFollowProfile = async () => {
    if (!profile || followBusy || profile.relationship.isMe) return;

    const wasFollowing = profile.relationship.isFollowing;
    const nextFollowers = Math.max(0, profile.stats.followers + (wasFollowing ? -1 : 1));

    setProfile((prev) =>
      prev
        ? {
            ...prev,
            relationship: { ...prev.relationship, isFollowing: !wasFollowing },
            stats: { ...prev.stats, followers: nextFollowers },
          }
        : prev,
    );
    setFollowBusy(true);

    try {
      if (wasFollowing) await apiUnfollowUser(profile.user.id);
      else await apiFollowUser(profile.user.id);
    } catch (e: any) {
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              relationship: { ...prev.relationship, isFollowing: wasFollowing },
              stats: { ...prev.stats, followers: profile.stats.followers },
            }
          : prev,
      );
      toast.error('Error', e.message || 'Failed to update follow');
    } finally {
      setFollowBusy(false);
    }
  };

  const toggleFollowInList = async (item: FollowListItem) => {
    if (listBusyIds.has(item.id)) return;

    const wasFollowing = !!item.isFollowing;
    setListData((prev) => prev.map((u) => (u.id === item.id ? { ...u, isFollowing: !wasFollowing } : u)));
    setListBusyIds((prev) => {
      const next = new Set(prev);
      next.add(item.id);
      return next;
    });

    try {
      if (wasFollowing) await apiUnfollowUser(item.id);
      else await apiFollowUser(item.id);
    } catch (e: any) {
      setListData((prev) => prev.map((u) => (u.id === item.id ? { ...u, isFollowing: wasFollowing } : u)));
      toast.error('Error', e.message || 'Failed to update follow');
    } finally {
      setListBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  const cardData = useMemo(() => sessions, [sessions]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>User not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
      >
        {/* ── Gradient Hero ── */}
        <LinearGradient
          colors={COLORS.gradientPrimary}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.heroBackground}
        >
          {/* Decorative circles */}
          <View style={[styles.decoCircle, { width: 180, height: 180, top: -40, right: -40, opacity: 0.08 }]} />
          <View style={[styles.decoCircle, { width: 100, height: 100, bottom: 20, left: -30, opacity: 0.06 }]} />

          {/* Header bar */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <View style={styles.headerBtn}>
                <ArrowLeft size={18} color={COLORS.primary} />
              </View>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Profile</Text>
            <View style={{ width: 34 }} />
          </View>

          {/* Avatar & info */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarWrapper}>
              {profile.user.avatarUrl ? (
                <Image source={{ uri: profile.user.avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarFallbackText}>
                    {(profile.user.fullName || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.name}>{profile.user.fullName}</Text>
            <Text style={styles.username}>@{profile.user.username}</Text>

            <View style={styles.roleRow}>
              <View style={[styles.roleBadge, profile.user.role === 'teacher' && styles.roleBadgeTeacher]}>
                <Text style={styles.roleText}>
                  {profile.user.role === 'teacher' ? 'Teacher' : 'Student'}
                </Text>
              </View>
              {profile.user.role === 'teacher' && profile.user.verifiedTeacher && (
                <View style={[styles.roleBadge, styles.roleBadgeVerified]}>
                  <Shield size={12} color="#fff" style={{ marginRight: 4 }} />
                  <Text style={styles.roleText}>Verified</Text>
                </View>
              )}
            </View>

            {/* Follow button */}
            {!profile.relationship.isMe && (
              <TouchableOpacity
                style={[styles.followBtn, profile.relationship.isFollowing && styles.followingBtn]}
                onPress={toggleFollowProfile}
                disabled={followBusy}
                activeOpacity={0.75}
              >
                {followBusy ? (
                  <ActivityIndicator size="small" color={profile.relationship.isFollowing ? COLORS.textMuted : '#fff'} />
                ) : (
                  <Text style={[styles.followBtnText, profile.relationship.isFollowing && styles.followingBtnText]}>
                    {profile.relationship.isFollowing ? 'Following' : 'Follow'}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </LinearGradient>

        {/* ── Floating Stats Card ── */}
        <View style={styles.floatingStatsWrapper}>
          <View style={styles.floatingStatsCard}>
            <TouchableOpacity style={styles.floatingStatItem} activeOpacity={0.7} onPress={() => openList('followers')}>
              <Text style={styles.floatingStatNum}>{profile.stats.followers}</Text>
              <Text style={styles.floatingStatLabel}>Followers</Text>
            </TouchableOpacity>
            <View style={styles.floatingStatDivider} />
            <TouchableOpacity style={styles.floatingStatItem} activeOpacity={0.7} onPress={() => openList('following')}>
              <Text style={styles.floatingStatNum}>{profile.stats.following}</Text>
              <Text style={styles.floatingStatLabel}>Following</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Main Content ── */}
        <View style={styles.mainContent}>

          {/* Reputation */}
          {reputation && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Reputation</Text>
                {reputation.mentorLabel ? (
                  <View style={styles.mentorBadge}>
                    <Shield size={12} color={TG.mentorTeal} />
                    <Text style={styles.mentorLabel}>{reputation.mentorLabel}</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.repCardsRow}>
                <View style={styles.repCard}>
                  <View style={[styles.repIconBox, { backgroundColor: TG.redLight }]}>
                    <Heart size={20} color={TG.red} />
                  </View>
                  <View style={styles.repCardInfo}>
                    <Text style={styles.repCardNum}>{reputation.helpfulVotes}</Text>
                    <Text style={styles.repCardLabel}>Helpful</Text>
                  </View>
                </View>
                <View style={styles.repCard}>
                  <View style={[styles.repIconBox, { backgroundColor: TG.goldLight }]}>
                    <Star size={20} color={TG.gold} />
                  </View>
                  <View style={styles.repCardInfo}>
                    <Text style={styles.repCardNum}>{reputation.reviewsGiven}</Text>
                    <Text style={styles.repCardLabel}>Reviews</Text>
                  </View>
                </View>
              </View>
              <View style={[styles.repCard, { marginTop: 10 }]}>
                <View style={[styles.repIconBox, { backgroundColor: TG.accentLight }]}>
                  <Award size={20} color={TG.accent} />
                </View>
                <View style={styles.repCardInfo}>
                  <Text style={styles.repCardNum}>{reputation.clarityScore.toFixed(1)} / 100</Text>
                  <Text style={styles.repCardLabel}>Clarity Score</Text>
                </View>
              </View>

              {/* Achievements (only earned ones) */}
              {reputation.badges && reputation.badges.length > 0 && (() => {
                const earned = achievements.filter((a) => reputation.badges.includes(a.key));
                if (earned.length === 0) return null;

                const CATEGORY_STYLE: Record<string, { bg: string; color: string; icon: React.ReactNode }> = {
                  speaking: { bg: '#EEF2FF', color: '#6366F1', icon: <Mic size={16} color="#6366F1" /> },
                  social:   { bg: '#FFF1F2', color: '#F43F5E', icon: <Heart size={16} color="#F43F5E" /> },
                  streak:   { bg: '#FFF7ED', color: '#F97316', icon: <Flame size={16} color="#F97316" /> },
                  mastery:  { bg: '#F0FDF4', color: '#22C55E', icon: <Zap size={16} color="#22C55E" /> },
                };

                return (
                  <View style={styles.achievementsWrap}>
                    {earned.map((a) => {
                      const cat = CATEGORY_STYLE[a.category] || CATEGORY_STYLE.mastery;
                      return (
                        <View key={a.id} style={[styles.achievementChip, { backgroundColor: cat.bg }]}>
                          <View style={styles.achievementIcon}>{cat.icon}</View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.achievementTitle, { color: cat.color }]}>{a.title}</Text>
                            <Text style={styles.achievementDesc} numberOfLines={1}>{a.description}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              })()}
            </View>
          )}

          {/* Sessions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sessions</Text>
            {cardData.length > 0 ? (
              <View style={styles.sessionsGrid}>
                {cardData.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.sessionCard}
                    activeOpacity={0.8}
                    onPress={() => router.push(`/community/${item.id}` as any)}
                  >
                    <Text style={styles.sessionTitle} numberOfLines={2}>
                      {item.test?.title || 'Untitled Session'}
                    </Text>
                    <Text style={styles.sessionDate}>
                      {new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                    <View style={styles.sessionMetaRow}>
                      <View style={styles.sessionMetaItem}>
                        <Heart size={13} color={item.isLiked ? TG.red : TG.textHint} fill={item.isLiked ? TG.red : 'none'} />
                        <Text style={[styles.sessionMetaText, item.isLiked && { color: TG.red }]}>{item.likes || 0}</Text>
                      </View>
                      <View style={styles.sessionMetaItem}>
                        <MessageCircle size={13} color={TG.textHint} />
                        <Text style={styles.sessionMetaText}>{item._count?.responses || item.responses?.length || 0}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.emptySessionCard}>
                <Users size={32} color={COLORS.textMuted} />
                <Text style={styles.emptySessionText}>No public sessions yet</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* ── Followers/Following Modal ── */}
      <Modal visible={listOpen} animationType="slide" transparent onRequestClose={() => setListOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setListOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{listMode === 'followers' ? 'Followers' : 'Following'}</Text>

            {listLoading ? (
              <ActivityIndicator color={COLORS.accent} style={{ marginTop: 18 }} />
            ) : (
              <FlatList
                data={listData}
                keyExtractor={(item) => item.id}
                ItemSeparatorComponent={() => <View style={styles.sep} />}
                renderItem={({ item }) => (
                  <View style={styles.userRow}>
                    <TouchableOpacity
                      style={styles.rowLeft}
                      activeOpacity={0.7}
                      onPress={() => {
                        setListOpen(false);
                        if (item.id !== user?.id) router.push(`/user/${item.id}` as any);
                      }}
                    >
                      {item.avatarUrl ? (
                        <Image source={{ uri: item.avatarUrl }} style={styles.rowAvatar} />
                      ) : (
                        <View style={styles.rowAvatarFallback}>
                          <Text style={styles.rowAvatarText}>{(item.fullName || '?').charAt(0).toUpperCase()}</Text>
                        </View>
                      )}
                      <View>
                        <Text style={styles.rowName}>{item.fullName}</Text>
                        <Text style={styles.rowHandle}>@{item.username}</Text>
                      </View>
                    </TouchableOpacity>

                    {item.id !== user?.id && (
                      <TouchableOpacity
                        style={[styles.inlineFollowBtn, item.isFollowing && styles.inlineFollowingBtn]}
                        activeOpacity={0.75}
                        disabled={listBusyIds.has(item.id)}
                        onPress={() => toggleFollowInList(item)}
                      >
                        <Text style={[styles.inlineFollowBtnText, item.isFollowing && styles.inlineFollowingBtnText]}>
                          {item.isFollowing ? 'Following' : 'Follow'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                ListEmptyComponent={<Text style={styles.emptyListText}>No users</Text>}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TG.headerBg },
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: 60 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },

  // Hero
  heroBackground: {
    paddingTop: 10,
    paddingBottom: 60,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    overflow: 'hidden',
  },
  decoCircle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  headerBtn: {
    backgroundColor: '#fff',
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },

  avatarSection: { alignItems: 'center', paddingHorizontal: 20 },
  avatarWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#fff',
    padding: 3,
    marginBottom: 14,
  },
  avatar: { width: '100%', height: '100%', borderRadius: 46 },
  avatarFallback: {
    width: '100%',
    height: '100%',
    borderRadius: 46,
    backgroundColor: TG.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: { color: TG.headerBg, fontWeight: '800', fontSize: 34 },
  name: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 4 },
  username: { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginBottom: 12 },
  roleRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 16 },
  roleBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  roleBadgeTeacher: { backgroundColor: TG.green },
  roleBadgeVerified: { backgroundColor: TG.purple },

  followBtn: {
    height: 40,
    minWidth: 130,
    paddingHorizontal: 28,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  followBtnText: { color: TG.headerBg, fontSize: 15, fontWeight: '800' },
  followingBtn: { backgroundColor: 'rgba(255,255,255,0.2)' },
  followingBtnText: { color: '#fff' },

  // Floating Stats
  floatingStatsWrapper: { paddingHorizontal: 24, marginTop: -35, zIndex: 10 },
  floatingStatsCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingVertical: 18,
  },
  floatingStatItem: { flex: 1, alignItems: 'center' },
  floatingStatDivider: { width: 1, backgroundColor: COLORS.border },
  floatingStatNum: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  floatingStatLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },

  // Main
  mainContent: { paddingHorizontal: 20, paddingTop: 24 },
  section: { marginBottom: 28 },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginBottom: 16 },

  // Reputation
  mentorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: TG.mentorTealLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  mentorLabel: { fontSize: 12, fontWeight: '600', color: TG.mentorTeal },
  repCardsRow: { flexDirection: 'row', gap: 10 },
  repCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 12,
  },
  repIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  repCardInfo: { flex: 1 },
  repCardNum: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginBottom: 2 },
  repCardLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },

  achievementsWrap: { marginTop: 14, gap: 8 },
  achievementChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  achievementIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  achievementTitle: { fontSize: 13, fontWeight: '800' },
  achievementDesc: { fontSize: 11, fontWeight: '500', color: TG.textSecondary, marginTop: 1 },

  // Sessions
  sessionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sessionCard: {
    width: '48%' as any,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
  },
  sessionTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text, minHeight: 38 },
  sessionDate: { fontSize: 11, color: COLORS.textMuted, marginTop: 8 },
  sessionMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  sessionMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sessionMetaText: { fontSize: 12, color: TG.textHint },

  emptySessionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySessionText: { fontSize: 14, color: COLORS.textMuted, marginTop: 12, fontWeight: '600' },

  emptyText: { color: COLORS.textMuted, textAlign: 'center', marginTop: 20, fontSize: 14 },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
    minHeight: 360,
    maxHeight: '75%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginBottom: 14 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border, marginVertical: 8 },

  userRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  rowAvatar: { width: 44, height: 44, borderRadius: 22 },
  rowAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: TG.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowAvatarText: { color: TG.accent, fontWeight: '700', fontSize: 16 },
  rowName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  rowHandle: { fontSize: 12, color: COLORS.textMuted },

  inlineFollowBtn: {
    height: 32,
    minWidth: 80,
    borderRadius: 10,
    backgroundColor: TG.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  inlineFollowBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  inlineFollowingBtn: { backgroundColor: TG.bgSecondary },
  inlineFollowingBtnText: { color: TG.textSecondary },
  emptyListText: { color: COLORS.textMuted, textAlign: 'center', marginTop: 24, fontSize: 14 },
});