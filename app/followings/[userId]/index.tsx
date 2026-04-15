import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import {
  apiFollowUser,
  apiGetFollowing,
  apiUnfollowUser,
  FollowListItem,
} from '@/lib/api';
import { useAuth } from '@/store/auth';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function FollowingListScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();

  const [data, setData] = useState<FollowListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadFollowing = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await apiGetFollowing(userId, 1, 20);
      setData(res.data || []);
      setPage(1);
      setHasMore((res.pagination?.totalPages ?? 1) > 1);
    } catch (e: any) {
      toast.error('Error', e.message || 'Failed to load following');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void loadFollowing();
    }, [loadFollowing]),
  );

  const loadMore = async () => {
    if (!hasMore || loadingMore || !userId) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await apiGetFollowing(userId, nextPage, 20);
      setData((prev) => [...prev, ...(res.data || [])]);
      setPage(nextPage);
      setHasMore(nextPage < (res.pagination?.totalPages ?? 1));
    } catch {
      // silently fail
    } finally {
      setLoadingMore(false);
    }
  };

  const toggleFollow = async (item: FollowListItem) => {
    if (busyIds.has(item.id)) return;

    const wasFollowing = !!item.isFollowing;
    setData((prev) =>
      prev.map((u) => (u.id === item.id ? { ...u, isFollowing: !wasFollowing } : u)),
    );
    setBusyIds((prev) => {
      const next = new Set(prev);
      next.add(item.id);
      return next;
    });

    try {
      if (wasFollowing) await apiUnfollowUser(item.id);
      else await apiFollowUser(item.id);
    } catch (e: any) {
      setData((prev) =>
        prev.map((u) => (u.id === item.id ? { ...u, isFollowing: wasFollowing } : u)),
      );
      toast.error('Error', e.message || 'Failed to update follow');
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <ArrowLeft size={22} color={TG.textWhite} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Following</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={TG.accent} />
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          renderItem={({ item }) => (
            <View style={styles.userRow}>
              <TouchableOpacity
                style={styles.rowLeft}
                activeOpacity={0.7}
                onPress={() => {
                  if (item.id !== user?.id) router.push(`/user/${item.id}` as any);
                }}
              >
                {item.avatarUrl ? (
                  <Image source={{ uri: item.avatarUrl }} style={styles.rowAvatar} />
                ) : (
                  <View style={styles.rowAvatarFallback}>
                    <Text style={styles.rowAvatarText}>
                      {(item.fullName || '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName} numberOfLines={1}>{item.fullName}</Text>
                  <Text style={styles.rowHandle} numberOfLines={1}>@{item.username}</Text>
                </View>
              </TouchableOpacity>

              {item.id !== user?.id && (
                <TouchableOpacity
                  style={[styles.followBtn, item.isFollowing && styles.followingBtn]}
                  activeOpacity={0.75}
                  disabled={busyIds.has(item.id)}
                  onPress={() => toggleFollow(item)}
                >
                  <Text style={[styles.followBtnText, item.isFollowing && styles.followingBtnText]}>
                    {item.isFollowing ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Not following anyone yet</Text>
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color={TG.accent} style={{ marginVertical: 16 }} />
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TG.bgSecondary },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    backgroundColor: TG.headerBg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: TG.textWhite },

  listContent: { padding: 14, paddingBottom: 40 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: TG.separator, marginVertical: 8 },

  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: TG.bg,
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  rowAvatar: { width: 46, height: 46, borderRadius: 23 },
  rowAvatarFallback: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: TG.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowAvatarText: { color: TG.accent, fontWeight: '700', fontSize: 16 },
  rowName: { fontSize: 15, fontWeight: '600', color: TG.textPrimary },
  rowHandle: { fontSize: 12, color: TG.textSecondary, marginTop: 2 },

  followBtn: {
    height: 32,
    minWidth: 80,
    borderRadius: 10,
    backgroundColor: TG.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  followBtnText: { color: TG.textWhite, fontSize: 13, fontWeight: '700' },
  followingBtn: { backgroundColor: TG.bgSecondary },
  followingBtnText: { color: TG.textSecondary },

  emptyText: { color: TG.textSecondary, textAlign: 'center', marginTop: 40, fontSize: 14 },
});
