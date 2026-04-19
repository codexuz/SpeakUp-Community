import { TG } from '@/constants/theme';
import { apiFetchAnalyticsOverview, apiFetchPendingSpeaking } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { ArrowRight, BellRing, ClipboardList, FileText, Mic, Star, Users } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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

  const firstName = user?.fullName?.split(' ')[0] || 'Teacher';

  return (
    <SafeAreaView style={styles.safeArea}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={TG.accent} />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TG.textWhite} />
          }
        >
          {/* Header Banner */}
          <View style={styles.topBanner}>
            <View style={styles.greetingHeader}>
              <View style={styles.greetingTextContainer}>
                <Text style={styles.greetingTitle}>Hello, {firstName} 👋</Text>
                <Text style={styles.greetingSubtitle}>Ready to inspire your students?</Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/(teacher)/profile' as any)} activeOpacity={0.8}>
                {user?.avatarUrl ? (
                  <Image source={{ uri: user.avatarUrl }} style={styles.avatarImg} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarFallbackText}>{firstName.charAt(0)}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Floating Stats Summary */}
            {overview && (
              <View style={styles.statsFloatingCard}>
                <View style={styles.statColumn}>
                  <View style={[styles.statIconWrap, { backgroundColor: TG.accentLight }]}>
                    <Star size={18} color={TG.accent} />
                  </View>
                  <Text style={styles.statNumber}>{overview.totalReviews ?? 0}</Text>
                  <Text style={styles.statLabel}>Reviews</Text>
                </View>

                <View style={styles.statDivider} />

                <View style={styles.statColumn}>
                  <View style={[styles.statIconWrap, { backgroundColor: TG.greenLight }]}>
                    <Users size={18} color={TG.green} />
                  </View>
                  <Text style={styles.statNumber}>{overview.totalStudents ?? 0}</Text>
                  <Text style={styles.statLabel}>Students</Text>
                </View>

                <View style={styles.statDivider} />

                <View style={styles.statColumn}>
                  <View style={[styles.statIconWrap, { backgroundColor: TG.orangeLight }]}>
                     <BellRing size={18} color={TG.orange} />
                  </View>
                  <Text style={[styles.statNumber, pendingCount > 0 ? { color: TG.orange } : {}]}>
                    {pendingCount}
                  </Text>
                  <Text style={styles.statLabel}>Pending</Text>
                </View>
              </View>
            )}
          </View>

          {/* Body Content */}
          <View style={styles.bodyContent}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Your Tasks</Text>
            </View>

            {/* Pending Priority Card */}
            <TouchableOpacity
              style={[styles.taskCard, pendingCount > 0 ? styles.taskCardUrgent : styles.taskCardNormal]}
              activeOpacity={0.8}
              onPress={() => router.push('/(teacher)/reviews' as any)}
            >
               <View style={[styles.taskIconBg, pendingCount > 0 ? { backgroundColor: 'rgba(255,255,255,0.2)' } : { backgroundColor: TG.accentLight }]}>
                  <Mic size={24} color={pendingCount > 0 ? '#ffffff' : TG.accent} />
               </View>
               <View style={styles.taskTextWrap}>
                 <Text style={[styles.taskTitle, pendingCount > 0 ? { color: '#ffffff' } : { color: TG.textPrimary }]}>
                   Pending Reviews
                 </Text>
                 <Text style={[styles.taskDesc, pendingCount > 0 ? { color: 'rgba(255,255,255,0.85)' } : { color: TG.textSecondary }]}>
                   {pendingCount > 0 
                     ? `You have ${pendingCount} submissions waiting for your feedback.` 
                     : 'All caught up! No pending submissions.'}
                 </Text>
               </View>
               <ArrowRight size={20} color={pendingCount > 0 ? 'rgba(255,255,255,0.8)' : TG.textHint} />
            </TouchableOpacity>

            <View style={[styles.sectionHeader, { marginTop: 32 }]}>
              <Text style={styles.sectionTitle}>Management</Text>
            </View>
            
            <View style={styles.managementGrid}>
              <TouchableOpacity
                style={styles.gridCard}
                activeOpacity={0.7}
                onPress={() => router.push('/(teacher)/groups' as any)}
              >
                <View style={[styles.gridIcon, { backgroundColor: TG.greenLight }]}>
                   <Users size={24} color={TG.green} />
                </View>
                <Text style={styles.gridTitle}>My Groups</Text>
                <Text style={styles.gridDesc}>Manage your classes</Text>
              </TouchableOpacity>

              {user?.verifiedTeacher && (
                <TouchableOpacity
                  style={styles.gridCard}
                  activeOpacity={0.7}
                  onPress={() => router.push('/test' as any)}
                >
                  <View style={[styles.gridIcon, { backgroundColor: TG.purpleLight }]}>
                     <ClipboardList size={24} color={TG.purple} />
                  </View>
                  <Text style={styles.gridTitle}>Tests</Text>
                  <Text style={styles.gridDesc}>Create speaking tasks</Text>
                </TouchableOpacity>
              )}

              {user?.verifiedTeacher && (
                <TouchableOpacity
                  style={styles.gridCard}
                  activeOpacity={0.7}
                  onPress={() => router.push('/writing' as any)}
                >
                  <View style={[styles.gridIcon, { backgroundColor: TG.accentLight }]}>
                     <FileText size={24} color={TG.accent} />
                  </View>
                  <Text style={styles.gridTitle}>Writing</Text>
                  <Text style={styles.gridDesc}>Create writing tests</Text>
                </TouchableOpacity>
              )}
            </View>

          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TG.headerBg },
  loadingContainer: { flex: 1, backgroundColor: TG.bg, justifyContent: 'center', alignItems: 'center' },
  scrollView: { flex: 1, backgroundColor: TG.bgSecondary },
  scrollContent: { paddingBottom: 120 },

  // Top Banner
  topBanner: {
    backgroundColor: TG.headerBg,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    zIndex: 10,
  },
  greetingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greetingTextContainer: { flex: 1, paddingRight: 16 },
  greetingTitle: { fontSize: 24, fontWeight: '700', color: TG.textWhite, marginBottom: 4 },
  greetingSubtitle: { fontSize: 15, color: 'rgba(255,255,255,0.85)' },
  
  avatarImg: { width: 50, height: 50, borderRadius: 25, backgroundColor: TG.bgSecondary },
  avatarFallback: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: TG.bgSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarFallbackText: { fontSize: 20, fontWeight: '700', color: TG.accent },

  statsFloatingCard: {
    flexDirection: 'row',
    backgroundColor: TG.bg,
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 10,
    marginTop: 10,
    marginBottom: -60, // overlaps with body
  },
  statColumn: { flex: 1, alignItems: 'center' },
  statIconWrap: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statNumber: { fontSize: 20, fontWeight: '700', color: TG.textPrimary, marginBottom: 2 },
  statLabel: { fontSize: 13, color: TG.textSecondary, fontWeight: '500' },
  statDivider: { width: 1, backgroundColor: TG.separatorLight, height: '80%', alignSelf: 'center' },

  // Body
  bodyContent: {
    paddingHorizontal: 20,
    paddingTop: 80, // accounts for the overlapping floating card
  },
  sectionHeader: { marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: TG.textPrimary },

  // Task Card
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 20,
  },
  taskCardNormal: { backgroundColor: TG.bg },
  taskCardUrgent: { backgroundColor: TG.orange },
  taskIconBg: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  taskTextWrap: { flex: 1, marginLeft: 16, marginRight: 12 },
  taskTitle: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  taskDesc: { fontSize: 14, lineHeight: 20 },

  // Management Grid
  managementGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  gridCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: TG.bg,
    padding: 20,
    borderRadius: 20,
  },
  gridIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  gridTitle: { fontSize: 16, fontWeight: '700', color: TG.textPrimary, marginBottom: 4 },
  gridDesc: { fontSize: 13, color: TG.textSecondary, lineHeight: 18 },
});
