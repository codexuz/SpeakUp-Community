import { TG } from '@/constants/theme';
import { fetchMyGroups, Group } from '@/lib/groups';
import { useAuth } from '@/store/auth';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Hash, LogIn, Plus, Users } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function GroupsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

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

  useFocusEffect(
    useCallback(() => {
      void loadGroups();
    }, [loadGroups])
  );

  const roleBadge = (role?: string) => {
    if (!role) return null;
    const color = role === 'owner' ? TG.purple : role === 'teacher' ? TG.accent : TG.green;
    const bg = role === 'owner' ? TG.purpleLight : role === 'teacher' ? TG.accentLight : TG.greenLight;
    return (
      <View style={[styles.roleBadge, { backgroundColor: bg }]}>
        <Text style={[styles.roleText, { color }]}>{role}</Text>
      </View>
    );
  };

  const renderGroup = ({ item: group }: { item: Group }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => router.push(`/group/${group.id}` as any)}
    >
      <View style={styles.cardAvatar}>
        <Text style={styles.cardAvatarText}>{group.name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.cardInfo}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardTitle} numberOfLines={1}>{group.name}</Text>
          {roleBadge(group.myRole)}
        </View>
        {group.description ? (
          <Text style={styles.cardDesc} numberOfLines={1}>{group.description}</Text>
        ) : null}
        <View style={styles.cardMeta}>
          <Users size={13} color={TG.textSecondary} />
          <Text style={styles.cardMetaText}>{group.member_count ?? 0} members</Text>
          {(group.myRole === 'owner' || group.myRole === 'teacher') && (
            <>
              <Hash size={13} color={TG.textSecondary} style={{ marginLeft: 10 }} />
              <Text style={styles.cardMetaText}>{group.referralCode}</Text>
            </>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Groups</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.createBtn}
            activeOpacity={0.7}
            onPress={() => router.push('/group/create' as any)}
          >
            <Plus size={20} color={TG.textWhite} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.joinBtn}
            activeOpacity={0.7}
            onPress={() => router.push('/group/join' as any)}
          >
            <LogIn size={18} color={TG.accent} />
            <Text style={styles.joinBtnText}>Join</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={TG.accent} style={{ marginTop: 60 }} />
      ) : groups.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Users size={48} color={TG.separator} style={{ marginBottom: 16 }} />
          <Text style={styles.emptyText}>No groups yet</Text>
          <Text style={styles.emptyHint}>Create a group or join one with a referral code</Text>
        </View>
      ) : (
        <FlatList
          data={groups}
          renderItem={renderGroup}
          keyExtractor={(g) => g.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TG.bg },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: TG.headerBg,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: TG.textWhite },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  createBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: TG.bg,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
  },
  joinBtnText: { fontSize: 14, fontWeight: '600', color: TG.accent },

  list: { paddingBottom: 100 },
  separator: { height: 0.5, backgroundColor: TG.separator, marginLeft: 76 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: TG.bg,
  },
  cardAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: TG.purpleLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardAvatarText: { fontSize: 22, fontWeight: '700', color: TG.purple },
  cardInfo: { flex: 1 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: TG.textPrimary, flex: 1 },
  cardDesc: { fontSize: 14, color: TG.textSecondary, marginBottom: 4 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  cardMetaText: { fontSize: 13, color: TG.textSecondary },

  roleBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  roleText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },

  emptyContainer: { alignItems: 'center', marginTop: 80 },
  emptyText: { color: TG.textPrimary, fontSize: 18, fontWeight: '600', marginBottom: 4 },
  emptyHint: { color: TG.textSecondary, fontSize: 14 },
});
