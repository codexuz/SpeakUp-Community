import { fetchStudentGroups, fetchTeacherGroups, Group } from '@/lib/groups';
import { useAuth } from '@/store/auth';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Hash, LogIn, Plus, RefreshCw, Users } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function GroupsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    try {
      if (user?.role === 'teacher') {
        const data = await fetchTeacherGroups(user.id);
        setGroups(data);
      } else if (user?.role === 'student') {
        const data = await fetchStudentGroups(user.id);
        setGroups(data);
      }
    } catch (e) {
      console.error('Failed to load groups', e);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.role]);

  useFocusEffect(
    useCallback(() => {
      void loadGroups();
    }, [loadGroups])
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0f172a', '#1e293b']} style={StyleSheet.absoluteFillObject} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Groups</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={loadGroups} style={styles.iconBtn} activeOpacity={0.7}>
              <RefreshCw size={22} color="#3b82f6" />
            </TouchableOpacity>
            {user?.role === 'teacher' ? (
              <TouchableOpacity
                style={styles.addBtn}
                activeOpacity={0.8}
                onPress={() => router.push('/group/create' as any)}
              >
                <Plus size={22} color="#fff" strokeWidth={3} />
                <Text style={styles.addBtnText}>NEW</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.joinBtn}
                activeOpacity={0.8}
                onPress={() => router.push('/group/join' as any)}
              >
                <LogIn size={20} color="#fff" strokeWidth={2.5} />
                <Text style={styles.joinBtnText}>JOIN</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 60 }} />
        ) : groups.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Users size={48} color="#334155" style={{ marginBottom: 16 }} />
            <Text style={styles.emptyText}>
              {user?.role === 'teacher' ? 'No groups yet. Create one!' : 'No groups yet. Join with a referral code!'}
            </Text>
          </View>
        ) : (
          groups.map((group) => (
            <TouchableOpacity
              key={group.id}
              style={styles.card}
              activeOpacity={0.8}
              onPress={() => router.push(`/group/${group.id}` as any)}
            >
              <View style={styles.cardInner}>
                <View style={styles.cardIcon}>
                  <Users size={28} color="#8b5cf6" strokeWidth={2} />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle}>{group.name}</Text>
                  {group.description ? (
                    <Text style={styles.cardDesc} numberOfLines={1}>{group.description}</Text>
                  ) : null}
                  <View style={styles.cardMeta}>
                    <Users size={14} color="#64748b" />
                    <Text style={styles.cardMetaText}>{group.member_count ?? 0} members</Text>
                    {user?.role === 'teacher' && (
                      <>
                        <Hash size={14} color="#64748b" style={{ marginLeft: 12 }} />
                        <Text style={styles.cardMetaText}>{group.referral_code}</Text>
                      </>
                    )}
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingTop: 40, paddingBottom: 100 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '800', color: '#fff' },
  headerActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  iconBtn: {
    padding: 10,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    borderBottomWidth: 4,
    borderColor: '#7c3aed',
  },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    borderBottomWidth: 4,
    borderColor: '#059669',
  },
  joinBtnText: { color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },

  card: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 2,
    borderColor: '#334155',
    borderBottomWidth: 5,
  },
  cardInner: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cardIcon: {
    width: 52,
    height: 52,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    borderBottomWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 2 },
  cardDesc: { fontSize: 13, color: '#94a3b8', fontWeight: '500', marginBottom: 6 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardMetaText: { fontSize: 13, color: '#64748b', fontWeight: '600' },

  emptyContainer: { alignItems: 'center', marginTop: 80 },
  emptyText: { color: '#94a3b8', fontSize: 16, fontWeight: '600', textAlign: 'center' },
});
