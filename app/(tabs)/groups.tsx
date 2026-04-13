import { TG } from '@/constants/theme';
import { fetchMyGroups, Group } from '@/lib/groups';
import { useAuth } from '@/store/auth';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { ChevronRight, LogIn, Pencil, Search, Users, X } from 'lucide-react-native';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
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
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchAnim = useRef(new Animated.Value(0)).current;
  const searchInputRef = useRef<TextInput>(null);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMyGroups();
      setGroups(data);
    } catch (e) {
      console.error('Failed to load groups', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await fetchMyGroups();
      setGroups(data);
    } catch (e) {
      console.error('Failed to refresh groups', e);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadGroups();
    }, [loadGroups])
  );

  const toggleSearch = useCallback(() => {
    if (searchVisible) {
      Animated.timing(searchAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start(() => {
        setSearchVisible(false);
        setSearchQuery('');
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

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const q = searchQuery.toLowerCase();
    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        (g.description && g.description.toLowerCase().includes(q))
    );
  }, [groups, searchQuery]);

  // ── Role badge ────────────────────────────────────────────
  const roleBadge = (role?: string) => {
    if (!role) return null;
    const map: Record<string, { color: string; bg: string; label: string }> = {
      owner: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)', label: 'Owner' },
      teacher: { color: TG.accent, bg: TG.accentLight, label: 'Teacher' },
      student: { color: TG.green, bg: TG.greenLight, label: 'Student' },
    };
    const info = map[role] ?? { color: TG.textSecondary, bg: TG.separatorLight, label: role };
    return (
      <View style={[styles.roleBadge, { backgroundColor: info.bg }]}>
        <Text style={[styles.roleText, { color: info.color }]}>{info.label}</Text>
      </View>
    );
  };

  // ── searchBarHeight ────────────────────────────────────────
  const searchBarHeight = searchAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 52],
  });

  // ── List item ─────────────────────────────────────────────
  const renderGroup = ({ item: group }: { item: Group }) => {
    const avatarColor = getAvatarColor(group.name);
    const memberCount = group.member_count ?? 0;

    return (
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.6}
        onPress={() => router.push(`/group/${group.id}` as any)}
      >
        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: avatarColor.bg }]}>
          <Text style={[styles.avatarLetter, { color: avatarColor.text }]}>
            {group.name.charAt(0).toUpperCase()}
          </Text>
        </View>

        {/* Content */}
        <View style={styles.rowContent}>
          {/* Top row: name + role */}
          <View style={styles.rowTop}>
            <Text style={styles.groupName} numberOfLines={1}>
              {group.name}
            </Text>
            {roleBadge(group.myRole)}
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

        {/* Right side: member count badge + chevron */}
        <View style={styles.rowRight}>
          {group.description ? (
            <View style={styles.memberBadge}>
              <Users size={11} color={TG.textSecondary} />
              <Text style={styles.memberBadgeText}>{formatMemberCount(memberCount)}</Text>
            </View>
          ) : null}
          <ChevronRight size={18} color={TG.separator} />
        </View>
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
            placeholder="Search groups…"
            placeholderTextColor={TG.textHint}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={16} color={TG.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {/* Body */}
      {loading && !refreshing ? (
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
              <Pencil size={16} color="#fff" />
              <Text style={styles.emptyBtnPrimaryText}>Create Group</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.emptyBtnSecondary}
              activeOpacity={0.7}
              onPress={() => router.push('/group/join' as any)}
            >
              <LogIn size={16} color={TG.accent} />
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
        <View style={styles.fabRow}>
          <TouchableOpacity
            style={styles.fabSecondary}
            activeOpacity={0.8}
            onPress={() => router.push('/group/join' as any)}
          >
            <LogIn size={20} color={TG.accent} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.fab}
            activeOpacity={0.8}
            onPress={() => router.push('/group/create' as any)}
          >
            <Pencil size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

// ── Styles ──────────────────────────────────────────────────
const AVATAR_SIZE = 54;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TG.bg },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: TG.headerBg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
      },
      android: { elevation: 4 },
    }),
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: TG.separator,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TG.bgSecondary,
    marginHorizontal: 12,
    marginVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    height: 36,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: TG.textPrimary,
    padding: 0,
  },

  // List
  list: { paddingBottom: 110 },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: TG.separator,
    marginLeft: 16 + AVATAR_SIZE + 14,
  },

  // Row (group item)
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: TG.bg,
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

  // Row right side
  rowRight: { alignItems: 'flex-end', justifyContent: 'center', gap: 4 },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: TG.bgSecondary,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  memberBadgeText: { fontSize: 11, fontWeight: '600', color: TG.textSecondary },

  // Role badge
  roleBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  roleText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Loading
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
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
    ...Platform.select({
      ios: { shadowColor: TG.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
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

  // FABs
  fabRow: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 28 : 20,
    right: 20,
    alignItems: 'center',
    gap: 12,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: TG.accent,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
    }),
  },
  fabSecondary: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: TG.bg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: TG.separator,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: { elevation: 3 },
    }),
  },
});
