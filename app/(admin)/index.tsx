import { TG } from '@/constants/theme';
import { apiFetchAllVerifications, apiFetchAnalyticsOverview } from '@/lib/api';
import { fetchTestsWithQuestions } from '@/lib/data';
import { useAuth } from '@/store/auth';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { ChevronRight, ClipboardList, FileText, Image as ImageIcon, Shield } from 'lucide-react-native';
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

export default function AdminHomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingVerifications, setPendingVerifications] = useState(0);
  const [overview, setOverview] = useState<any>(null);
  const [testCount, setTestCount] = useState(0);

  const loadData = useCallback(async () => {
    try {
      const [verifications, analytics, tests] = await Promise.all([
        apiFetchAllVerifications('pending').catch(() => []),
        apiFetchAnalyticsOverview().catch(() => null),
        fetchTestsWithQuestions().catch(() => []),
      ]);
      setPendingVerifications(Array.isArray(verifications) ? verifications.length : 0);
      setOverview(analytics);
      setTestCount(Array.isArray(tests) ? tests.length : 0);
    } catch (e) {
      console.error('Failed to load admin dashboard', e);
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
        <Text style={styles.headerTitle}>Admin Panel</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, backgroundColor: TG.bg, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={TG.accent} />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1, backgroundColor: TG.bg }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TG.accent} colors={[TG.accent]} />
          }
        >
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user?.fullName?.charAt(0) || 'A'}</Text>
            </View>
            <Text style={styles.greeting}>Welcome, {user?.fullName}</Text>
            <Text style={styles.subGreeting}>Manage the platform</Text>
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={[styles.statNumber, pendingVerifications > 0 ? { color: TG.orange } : {}]}>
                {pendingVerifications}
              </Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{testCount}</Text>
              <Text style={styles.statLabel}>Tests</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{overview?.totalStudents ?? 0}</Text>
              <Text style={styles.statLabel}>Students</Text>
            </View>
          </View>

          {/* Quick Actions */}
          <TouchableOpacity
            style={styles.actionCard}
            activeOpacity={0.7}
            onPress={() => router.push('/(admin)/verification' as any)}
          >
            <View style={[styles.actionIcon, { backgroundColor: TG.orangeLight }]}>
              <Shield size={22} color={TG.orange} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Teacher Verification</Text>
              <Text style={styles.actionDesc}>
                {pendingVerifications > 0
                  ? `${pendingVerifications} pending requests`
                  : 'No pending requests'}
              </Text>
            </View>
            <ChevronRight size={20} color={TG.textHint} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            activeOpacity={0.7}
            onPress={() => router.push('/(admin)/tests' as any)}
          >
            <View style={[styles.actionIcon, { backgroundColor: TG.purpleLight }]}>
              <ClipboardList size={22} color={TG.purple} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Manage Tests</Text>
              <Text style={styles.actionDesc}>{testCount} tests available</Text>
            </View>
            <ChevronRight size={20} color={TG.textHint} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            activeOpacity={0.7}
            onPress={() => router.push('/ads' as any)}
          >
            <View style={[styles.actionIcon, { backgroundColor: TG.accentLight }]}>
              <ImageIcon size={22} color={TG.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Manage Ads</Text>
              <Text style={styles.actionDesc}>Control banner advertisements</Text>
            </View>
            <ChevronRight size={20} color={TG.textHint} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            activeOpacity={0.7}
            onPress={() => router.push('/writing' as any)}
          >
            <View style={[styles.actionIcon, { backgroundColor: TG.greenLight }]}>
              <FileText size={22} color={TG.green} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Writing Tests</Text>
              <Text style={styles.actionDesc}>Manage writing tests & AI assessment</Text>
            </View>
            <ChevronRight size={20} color={TG.textHint} />
          </TouchableOpacity>
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
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: TG.textWhite },
  scrollContent: { paddingBottom: 100 },

  avatarContainer: { alignItems: 'center', paddingVertical: 24, gap: 6 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: TG.purpleLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarText: { fontSize: 24, fontWeight: '700', color: TG.purple },
  greeting: { fontSize: 20, fontWeight: '700', color: TG.textPrimary },
  subGreeting: { fontSize: 14, color: TG.textSecondary },

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
