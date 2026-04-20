import { useAlert } from '@/components/CustomAlert';
import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import { useCachedFetch } from '@/hooks/useCachedFetch';
import { apiFetchMyGroups, apiJoinGlobalGroup, apiRequestJoinGroup, apiSearchGroups } from '@/lib/api';
import type { Group } from '@/lib/groups';
import { useAuth } from '@/store/auth';
import { useRouter } from 'expo-router';
import { Globe, Plus, Search, UserPlus, Users, X } from 'lucide-react-native';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ── Telegram-style avatar color palette ──────────────────────
const AVATAR_COLORS = [
  { bg: '#e17076', text: '#fff' }, // red
  { bg: '#faa774', text: '#fff' }, // orange
  { bg: '#a695e7', text: '#fff' }, // violet
  { bg: '#7bc862', text: '#fff' }, // green
  { bg: '#6ec9cb', text: '#fff' }, // cyan
  { bg: '#65aadd', text: '#fff' }, // blue
  { bg: '#ee7aae', text: '#fff' }, // pink
];

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function getAvatarColor(name: string) {
  return AVATAR_COLORS[hashCode(name) % AVATAR_COLORS.length];
}

// ── Helpers ──────────────────────────────────────────────────
function formatMemberCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return `${n}`;
}

export default function GroupsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { alert } = useAlert();
  const { data: cachedGroups, isLoading: loading, isRefreshing: refreshing, refresh } = useCachedFetch<Group[]>({
    cacheKey: 'my_groups',
    apiFn: () => apiFetchMyGroups(),
    staleTime: 2 * 60_000,
  });
  const groups = cachedGroups ?? [];

  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'local' | 'global'>('local');
  const [globalResults, setGlobalResults] = useState<any[]>([]);
  const [globalSearching, setGlobalSearching] = useState(false);
  const searchAnim = useRef(new Animated.Value(0)).current;
  const searchInputRef = useRef<TextInput>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onRefresh = useCallback(async () => {
    await refresh();
  }, [refresh]);

  const toggleSearch = useCallback(() => {
    if (searchVisible) {
      Animated.timing(searchAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start(() => {
        setSearchVisible(false);
        setSearchQuery('');
        setSearchMode('local');
        setGlobalResults([]);
      });
    } else {
      setSearchVisible(true);
      Animated.timing(searchAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: false,
      }).start(() => {
        searchInputRef.current?.focus();
      });
    }
  }, [searchVisible, searchAnim]);

  const doGlobalSearch = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setGlobalResults([]);
      return;
    }
    setGlobalSearching(true);
    try {
      const results = await apiSearchGroups(query.trim());
      setGlobalResults(results || []);
    } catch {
      setGlobalResults([]);
    } finally {
      setGlobalSearching(false);
    }
  }, []);

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
    if (searchMode === 'global') {
      if (searchTimer.current) clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(() => doGlobalSearch(text), 400);
    }
  }, [searchMode, doGlobalSearch]);

  const handleRequestJoin = useCallback(async (groupId: string, groupName: string) => {
    alert('Request to Join', `Send a join request to "${groupName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send Request',
        onPress: async () => {
          try {
            await apiRequestJoinGroup(groupId);
            toast.success('Sent', 'Your join request has been sent.');
            doGlobalSearch(searchQuery);
          } catch (e: any) {
            toast.error('Error', e.message);
          }
        },
      },
    ]);
  }, [searchQuery, doGlobalSearch, alert, toast]);

  const handleJoinGlobal = useCallback(async (groupId: string) => {
    try {
      await apiJoinGlobalGroup(groupId);
      toast.success('Joined', 'You joined the group');
      refresh();
    } catch (e: any) {
      toast.error('Error', e.message);
    }
  }, [refresh, toast]);

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const q = searchQuery.toLowerCase();
    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        (g.description && g.description.toLowerCase().includes(q))
    );
  }, [groups, searchQuery]);

  // ── searchBarHeight ────────────────────────────────────────
  const searchBarHeight = searchAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 52],
  });

  // ── List item ─────────────────────────────────────────────
  const renderGroup = ({ item: group }: { item: Group }) => {
    const avatarColor = getAvatarColor(group.name);
    const memberCount = group.member_count ?? 0;
    const isUnjoined = group.isGlobal && !group.myRole;

    return (
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.6}
        onPress={() => {
          if (isUnjoined) {
            handleJoinGlobal(group.id);
            return;
          }
          router.push(`/group/${group.id}` as any);
        }}
      >
        {/* Avatar */}
        {group.avatarUrl ? (
          <Image source={{ uri: group.avatarUrl }} style={styles.avatarImg} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: avatarColor.bg }]}>
            <Text style={[styles.avatarLetter, { color: avatarColor.text }]}>
              {group.name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        {/* Content */}
        <View style={styles.rowContent}>
          {/* Top row: name + global badge */}
          <View style={styles.rowTop}>
            <Text style={styles.groupName} numberOfLines={1}>
              {group.name}
            </Text>
            {group.isGlobal && (
              <View style={styles.globalBadge}>
                <Globe size={10} color={TG.accent} />
              </View>
            )}
          </View>

          {/* Bottom row: description / members */}
          <View style={styles.rowBottom}>
            <Text style={styles.subtitle} numberOfLines={1}>
              {group.description
                ? group.description
                : `${formatMemberCount(memberCount)} member${memberCount !== 1 ? 's' : ''}`}
            </Text>
          </View>
        </View>

        {isUnjoined && (
          <View style={[styles.statusChip, { backgroundColor: TG.accentLight }]}>
            <UserPlus size={14} color={TG.accent} />
            <Text style={[styles.statusChipText, { color: TG.accent }]}>Join</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const ListSeparator = useCallback(
    () => <View style={styles.separator} />,
    []
  );

  // ── Render ─────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Groups</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerBtn}
            activeOpacity={0.6}
            onPress={toggleSearch}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {searchVisible ? (
              <X size={22} color={TG.textWhite} />
            ) : (
              <Search size={22} color={TG.textWhite} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Animated search bar */}
      <Animated.View style={[styles.searchBarWrap, { height: searchBarHeight, opacity: searchAnim }]}>
        <View style={styles.searchBar}>
          <Search size={16} color={TG.textHint} />
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder={searchMode === 'global' ? 'Search all groups…' : 'Search my groups…'}
            placeholderTextColor={TG.textHint}
            value={searchQuery}
            onChangeText={handleSearchChange}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchQuery(''); setGlobalResults([]); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={16} color={TG.textSecondary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => {
              const next = searchMode === 'local' ? 'global' : 'local';
              setSearchMode(next);
              setGlobalResults([]);
              if (next === 'global' && searchQuery.trim().length >= 2) {
                doGlobalSearch(searchQuery);
              }
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Globe size={16} color={searchMode === 'global' ? TG.accent : TG.textHint} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Body */}
      {searchMode === 'global' && searchVisible ? (
        globalSearching ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={TG.accent} />
          </View>
        ) : globalResults.length === 0 && searchQuery.length >= 2 ? (
          <View style={styles.emptyContainer}>
            <Search size={44} color={TG.textHint} />
            <Text style={[styles.emptyTitle, { marginTop: 16 }]}>No results</Text>
            <Text style={styles.emptySubtitle}>No groups matching "{searchQuery}"</Text>
          </View>
        ) : globalResults.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Globe size={44} color={TG.textHint} />
            <Text style={[styles.emptyTitle, { marginTop: 16 }]}>Search All Groups</Text>
            <Text style={styles.emptySubtitle}>Type at least 2 characters to search</Text>
          </View>
        ) : (
          <FlatList
            style={{ backgroundColor: TG.bg }}
            data={globalResults}
            keyExtractor={(g) => g.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={ListSeparator}
            renderItem={({ item: g }) => {
              const avatarColor = getAvatarColor(g.name);
              return (
                <TouchableOpacity
                  style={styles.row}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (g.status === 'member') {
                      router.push(`/group/${g.id}` as any);
                      return;
                    }
                    if (g.status === 'pending') {
                      toast.warning('Pending', 'Your join request is already pending.');
                      return;
                    }
                    handleRequestJoin(g.id, g.name);
                  }}
                >
                  {g.avatarUrl ? (
                    <Image source={{ uri: g.avatarUrl }} style={styles.avatarImg} />
                  ) : (
                    <View style={[styles.avatar, { backgroundColor: avatarColor.bg }]}>
                      <Text style={[styles.avatarLetter, { color: avatarColor.text }]}>
                        {g.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.rowContent}>
                    <Text style={styles.groupName} numberOfLines={1}>{g.name}</Text>
                    <Text style={styles.subtitle} numberOfLines={1}>
                      {g.memberCount ? `${formatMemberCount(g.memberCount)} members` : g.description || ''}
                    </Text>
                  </View>
                  {g.status === 'member' ? (
                    <TouchableOpacity
                      style={[styles.statusChip, { backgroundColor: TG.greenLight }]}
                      onPress={() => router.push(`/group/${g.id}` as any)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.statusChipText, { color: TG.green }]}>Open</Text>
                    </TouchableOpacity>
                  ) : g.status === 'pending' ? (
                    <View style={[styles.statusChip, { backgroundColor: TG.orangeLight }]}>
                      <Text style={[styles.statusChipText, { color: TG.orange }]}>Pending</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.statusChip, { backgroundColor: TG.accentLight }]}
                      onPress={() => handleRequestJoin(g.id, g.name)}
                      activeOpacity={0.7}
                    >
                      <UserPlus size={14} color={TG.accent} />
                      <Text style={[styles.statusChipText, { color: TG.accent }]}>Join</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            }}
          />
        )
      ) : loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={TG.accent} />
        </View>
      ) : filteredGroups.length === 0 && !searchQuery ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconWrap}>
            <Users size={44} color={TG.textHint} />
          </View>
          <Text style={styles.emptyTitle}>No Groups Yet</Text>
          <Text style={styles.emptySubtitle}>
            Create your own group or join one{'\n'}with a referral code
          </Text>
          <View style={styles.emptyActions}>
            <TouchableOpacity
              style={styles.emptyBtnPrimary}
              activeOpacity={0.7}
              onPress={() => router.push('/group/create' as any)}
            >
              <Plus size={16} color="#fff" />
              <Text style={styles.emptyBtnPrimaryText}>Create Group</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.emptyBtnSecondary}
              activeOpacity={0.7}
              onPress={() => router.push('/group/join' as any)}
            >
              <UserPlus size={16} color={TG.accent} />
              <Text style={styles.emptyBtnSecondaryText}>Join Group</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : filteredGroups.length === 0 && searchQuery ? (
        <View style={styles.emptyContainer}>
          <Search size={44} color={TG.textHint} />
          <Text style={[styles.emptyTitle, { marginTop: 16 }]}>No results</Text>
          <Text style={styles.emptySubtitle}>No groups matching "{searchQuery}"</Text>
        </View>
      ) : (
        <FlatList
          style={{ backgroundColor: TG.bg }}
          data={filteredGroups}
          renderItem={renderGroup}
          keyExtractor={(g) => g.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={ListSeparator}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={TG.accent}
              colors={[TG.accent]}
            />
          }
        />
      )}

      {/* FAB row – Create & Join */}
      {!loading && groups.length > 0 && (
        <View style={styles.fabStack}>
          <TouchableOpacity
            style={styles.fabSecondary}
            activeOpacity={0.85}
            onPress={() => router.push('/group/join' as any)}
          >
            <UserPlus size={16} color={TG.accent} />
            <Text style={styles.fabSecondaryText}>Join</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.fabPrimary}
            activeOpacity={0.9}
            onPress={() => router.push('/group/create' as any)}
          >
            <Plus size={18} color="#fff" strokeWidth={2.4} />
            <Text style={styles.fabPrimaryText}>Create</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

// ── Styles ──────────────────────────────────────────────────
const AVATAR_SIZE = 54;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TG.headerBg },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: TG.headerBg,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: TG.textWhite,
    letterSpacing: 0.3,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Search
  searchBarWrap: {
    backgroundColor: TG.bg,
    overflow: 'hidden',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TG.bgSecondary,
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: TG.textPrimary,
    padding: 0,
  },

  // List
  list: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 110 },
  separator: {
    height: 10,
    backgroundColor: 'transparent',
  },

  // Row (group item)
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 22,
    backgroundColor: TG.bgSecondary,
    gap: 14,
  },

  // Avatar
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    fontSize: 22,
    fontWeight: '600',
    marginTop: Platform.OS === 'android' ? -1 : 0,
  },
  avatarImg: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },

  // Row content
  rowContent: { flex: 1, justifyContent: 'center', gap: 3 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    color: TG.textPrimary,
    flex: 1,
  },
  rowBottom: { flexDirection: 'row', alignItems: 'center' },
  subtitle: {
    fontSize: 14,
    color: TG.textSecondary,
    flex: 1,
    lineHeight: 19,
  },

  // Loading
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: TG.bg },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    backgroundColor: TG.bg,
  },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: TG.bgSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: TG.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: TG.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  emptyActions: { flexDirection: 'row', gap: 12 },
  emptyBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: TG.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  emptyBtnPrimaryText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  emptyBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: TG.accentLight,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  emptyBtnSecondaryText: { fontSize: 15, fontWeight: '600', color: TG.accent },

  // Status chip (global search)
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  statusChipText: { fontSize: 12, fontWeight: '600' },

  // Global badge
  globalBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: TG.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // FABs
  fabStack: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 28 : 22,
    right: 20,
    alignItems: 'center',
    gap: 10,
  },
  fabPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 54,
    paddingHorizontal: 20,
    borderRadius: 27,
    backgroundColor: TG.accent,
    justifyContent: 'center',
  },
  fabPrimaryText: {
    color: TG.textWhite,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  fabSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 23,
    backgroundColor: TG.bg,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: TG.separator,
  },
  fabSecondaryText: {
    color: TG.accent,
    fontSize: 13,
    fontWeight: '700',
  },
});
