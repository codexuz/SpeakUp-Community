import { TG } from '@/constants/theme';
import { apiFetchAnalyticsOverview, apiFetchPendingSpeaking } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { ChevronRight, Mic, Users } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TeacherHomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [overview, setOverview] = useState<any>(null);

  const loadData = useCallback(async () => {
    try {
      const [pending, analytics] = await Promise.all([
        apiFetchPendingSpeaking(1, 1).catch(() => ({ data: [], pagination: { total: 0 } })),
        apiFetchAnalyticsOverview().catch(() => null),
      ]);
      setPendingCount(pending.pagination?.total || pending.data?.length || 0);
      setOverview(analytics);
    } catch (e) {
      console.error('Failed to load teacher dashboard', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>SpeakUp</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={TG.accent} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TG.accent} colors={[TG.accent]} />
          }
        >
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user?.fullName?.charAt(0) || 'T'}</Text>
            </View>
            <Text style={styles.greeting}>Welcome, {user?.fullName}</Text>
            <Text style={styles.subGreeting}>Review student submissions and manage your groups</Text>
          </View>

          {/* Stats Row */}
          {overview && (
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{overview.totalReviews ?? 0}</Text>
                <Text style={styles.statLabel}>Reviews</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{overview.totalStudents ?? 0}</Text>
                <Text style={styles.statLabel}>Students</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statNumber, { color: pendingCount > 0 ? TG.orange : TG.textPrimary }]}>
                  {pendingCount}
                </Text>
                <Text style={styles.statLabel}>Pending</Text>
              </View>
            </View>
          )}

          {/* Quick Actions */}
          <TouchableOpacity
            style={styles.actionCard}
            activeOpacity={0.7}
            onPress={() => router.push('/(teacher)/reviews' as any)}
          >
            <View style={[styles.actionIcon, { backgroundColor: TG.accentLight }]}>
              <Mic size={22} color={TG.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Pending Reviews</Text>
              <Text style={styles.actionDesc}>
                {pendingCount > 0 ? `${pendingCount} submissions waiting` : 'No pending submissions'}
              </Text>
            </View>
            <ChevronRight size={20} color={TG.textHint} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            activeOpacity={0.7}
            onPress={() => router.push('/(teacher)/groups' as any)}
          >
            <View style={[styles.actionIcon, { backgroundColor: TG.greenLight }]}>
              <Users size={22} color={TG.green} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>My Groups</Text>
              <Text style={styles.actionDesc}>Manage groups and view analytics</Text>
            </View>
            <ChevronRight size={20} color={TG.textHint} />
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TG.bg },
  header: {
    backgroundColor: TG.headerBg,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: TG.textWhite },
  scrollContent: { paddingBottom: 100 },

  avatarContainer: { alignItems: 'center', paddingVertical: 24, gap: 6 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: TG.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarText: { fontSize: 24, fontWeight: '700', color: TG.accent },
  greeting: { fontSize: 20, fontWeight: '700', color: TG.textPrimary },
  subGreeting: { fontSize: 14, color: TG.textSecondary, textAlign: 'center', paddingHorizontal: 40 },

  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: TG.bgSecondary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 2,
  },
  statNumber: { fontSize: 22, fontWeight: '700', color: TG.textPrimary },
  statLabel: { fontSize: 12, color: TG.textSecondary, fontWeight: '500' },

  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: TG.bg,
    borderBottomWidth: 0.5,
    borderBottomColor: TG.separatorLight,
    gap: 14,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionTitle: { fontSize: 16, fontWeight: '600', color: TG.textPrimary },
  actionDesc: { fontSize: 13, color: TG.textSecondary, marginTop: 2 },
});
