import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import {
  apiFetchCommunityFeed,
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
import { useAuth } from '@/store/auth';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Heart, Shield, Users } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type ListMode = 'followers' | 'following';

export default function PublicUserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();

  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [sessions, setSessions] = useState<TestSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [followBusy, setFollowBusy] = useState(false);

  const [listMode, setListMode] = useState<ListMode>('followers');
  const [listOpen, setListOpen] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [listData, setListData] = useState<FollowListItem[]>([]);
  const [listBusyIds, setListBusyIds] = useState<Set<string>>(new Set());

  const loadProfile = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const p = await apiGetUserProfile(id);
      setProfile(p);

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
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={TG.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>User not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <ArrowLeft size={22} color={TG.textWhite} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 22 }} />
      </View>

      <FlatList
        style={{ flex: 1, backgroundColor: TG.bgSecondary }}
        data={cardData}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.profileCard}>
            <View style={styles.topUserRow}>
              <View style={styles.avatarWrap}>
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

              <View style={{ flex: 1 }}>
                <Text style={styles.fullName}>{profile.user.fullName}</Text>
                <Text style={styles.username}>@{profile.user.username}</Text>
                {profile.user.verifiedTeacher && (
                  <View style={styles.verifiedBadge}>
                    <Shield size={12} color={TG.green} />
                    <Text style={styles.verifiedBadgeText}>Verified Teacher</Text>
                  </View>
                )}
              </View>

              {!profile.relationship.isMe && (
                <TouchableOpacity
                  style={[styles.followBtn, profile.relationship.isFollowing && styles.followingBtn]}
                  onPress={toggleFollowProfile}
                  disabled={followBusy}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.followBtnText, profile.relationship.isFollowing && styles.followingBtnText]}>
                    {profile.relationship.isFollowing ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.statsRow}>
              <TouchableOpacity style={styles.statCard} activeOpacity={0.75} onPress={() => openList('followers')}>
                <Text style={styles.statNum}>{profile.stats.followers}</Text>
                <Text style={styles.statLabel}>Followers</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.statCard} activeOpacity={0.75} onPress={() => openList('following')}>
                <Text style={styles.statNum}>{profile.stats.following}</Text>
                <Text style={styles.statLabel}>Following</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Sessions</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.sessionCard}
            activeOpacity={0.8}
            onPress={() => router.push(`/community/${item.id}` as any)}
          >
            <Text style={styles.sessionTitle} numberOfLines={2}>{item.test?.title || 'Untitled Session'}</Text>
            <Text style={styles.sessionDate}>
              {new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </Text>
            <View style={styles.sessionMetaRow}>
              <Heart size={12} color={item.isLiked ? TG.red : TG.textHint} fill={item.isLiked ? TG.red : 'none'} />
              <Text style={[styles.sessionMetaText, item.isLiked && { color: TG.red }]}>{item.likes || 0}</Text>
              <Users size={12} color={TG.textHint} />
              <Text style={styles.sessionMetaText}>{item._count?.responses || item.responses?.length || 0}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>No public sessions yet</Text>}
      />

      <Modal visible={listOpen} animationType="slide" transparent onRequestClose={() => setListOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setListOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{listMode === 'followers' ? 'Followers' : 'Following'}</Text>

            {listLoading ? (
              <ActivityIndicator color={TG.accent} style={{ marginTop: 18 }} />
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: TG.bgSecondary },

  header: {
    backgroundColor: TG.headerBg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: TG.textWhite },

  listContent: { padding: 12, paddingBottom: 110 },
  profileCard: {
    backgroundColor: TG.bg,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  topUserRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarWrap: { width: 58, height: 58 },
  avatar: { width: 58, height: 58, borderRadius: 29 },
  avatarFallback: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: TG.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: { color: TG.accent, fontWeight: '700', fontSize: 20 },
  fullName: { fontSize: 18, fontWeight: '700', color: TG.textPrimary },
  username: { fontSize: 13, color: TG.textSecondary, marginTop: 2 },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: TG.greenLight, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 4 },
  verifiedBadgeText: { fontSize: 11, fontWeight: '600', color: TG.green },

  followBtn: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: TG.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followBtnText: { color: TG.textWhite, fontSize: 13, fontWeight: '700' },
  followingBtn: { backgroundColor: TG.bgSecondary },
  followingBtnText: { color: TG.textSecondary },

  statsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  statCard: {
    flex: 1,
    backgroundColor: TG.bgSecondary,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  statNum: { fontSize: 18, fontWeight: '700', color: TG.textPrimary },
  statLabel: { fontSize: 12, color: TG.textSecondary, marginTop: 2 },
  sectionTitle: { marginTop: 14, fontSize: 14, fontWeight: '700', color: TG.textPrimary },

  gridRow: { gap: 10 },
  sessionCard: {
    flex: 1,
    backgroundColor: TG.bg,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  sessionTitle: { fontSize: 13, fontWeight: '600', color: TG.textPrimary, minHeight: 36 },
  sessionDate: { fontSize: 11, color: TG.textHint, marginTop: 6 },
  sessionMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  sessionMetaText: { fontSize: 12, color: TG.textHint, marginRight: 8 },

  emptyText: { color: TG.textSecondary, textAlign: 'center', marginTop: 20, fontSize: 14 },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: TG.bg,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 24,
    minHeight: 360,
    maxHeight: '75%',
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: TG.textPrimary, marginBottom: 10 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: TG.separator, marginVertical: 8 },

  userRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  rowAvatar: { width: 42, height: 42, borderRadius: 21 },
  rowAvatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: TG.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowAvatarText: { color: TG.accent, fontWeight: '700' },
  rowName: { fontSize: 14, fontWeight: '600', color: TG.textPrimary },
  rowHandle: { fontSize: 12, color: TG.textSecondary },

  inlineFollowBtn: {
    height: 30,
    minWidth: 76,
    borderRadius: 9,
    backgroundColor: TG.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  inlineFollowBtnText: { color: TG.textWhite, fontSize: 12, fontWeight: '700' },
  inlineFollowingBtn: { backgroundColor: TG.bgSecondary },
  inlineFollowingBtnText: { color: TG.textSecondary },
  emptyListText: { color: TG.textSecondary, textAlign: 'center', marginTop: 24 },
});