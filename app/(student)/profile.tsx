import { useAlert } from '@/components/CustomAlert';
import { TG } from '@/constants/theme';
import { useCachedFetch } from '@/hooks/useCachedFetch';
import { apiFetchAchievements, apiFetchProgress, apiFetchReputation, apiGetUserProfile, apiLogout } from '@/lib/api';
import type { Achievement, UserProgress, UserReputation } from '@/lib/types';
import { useAuth } from '@/store/auth';
import { useTelegram } from '@/store/telegram';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Award,
  ChevronRight,
  Edit2,
  Flame,
  Heart,
  LogOut,
  MapPin,
  Monitor,
  Phone,
  Send,
  Shield,
  Star,
  Trash2,
  User as UserIcon,
  Zap,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Dimensions,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

// Badge image mapping: achievement key → [active, inactive]
const BADGE_IMAGES: Record<string, { active: any; inactive: any }> = {
  'first_recording': { active: require('@/assets/images/badges/first_rec.png'), inactive: require('@/assets/images/badges/first_rec_in.png') },
  '10_recordings': { active: require('@/assets/images/badges/10_rec.png'), inactive: require('@/assets/images/badges/10_rec_in.png') },
  '50_recordings': { active: require('@/assets/images/badges/50_rec.png'), inactive: require('@/assets/images/badges/50_rec_in.png') },
  '100_recordings': { active: require('@/assets/images/badges/100rec.png'), inactive: require('@/assets/images/badges/100rec_inac.png') },
  'helpful_reviewer': { active: require('@/assets/images/badges/helprev.png'), inactive: require('@/assets/images/badges/helprev_in.png') },
  '50_reviews': { active: require('@/assets/images/badges/dedrevie.png'), inactive: require('@/assets/images/badges/dedrevie_in.png') },
  '100_reviews': { active: require('@/assets/images/badges/revmaster.png'), inactive: require('@/assets/images/badges/revmaster_in.png') },
  '7_day_streak': { active: require('@/assets/images/badges/weekwarr.png'), inactive: require('@/assets/images/badges/weekwarr_in.png') },
  '30_day_streak': { active: require('@/assets/images/badges/streakmaster.png'), inactive: require('@/assets/images/badges/streakmaster_in.png') },
  'community_star': { active: require('@/assets/images/badges/comstar.png'), inactive: require('@/assets/images/badges/comstar_in.png') },
  'level_5': { active: require('@/assets/images/badges/rising_star.png'), inactive: require('@/assets/images/badges/rising_star_in.png') },
  'level_10': { active: require('@/assets/images/badges/fl_cham.png'), inactive: require('@/assets/images/badges/flcham_in.png') },
  'first_challenge': { active: require('@/assets/images/badges/chal_acc.png'), inactive: require('@/assets/images/badges/chal_acc_in.png') },
  'course_completer': { active: require('@/assets/images/badges/course_com.png'), inactive: require('@/assets/images/badges/course_com_in.png') },
};

function getBadgeImage(key: string, unlocked: boolean) {
  const badge = BADGE_IMAGES[key];
  if (badge) return unlocked ? badge.active : badge.inactive;
  return unlocked ? require('@/assets/images/badge_taken.png') : require('@/assets/images/badge_waiting.png');
}

const COLORS = {
  background: TG.bgSecondary,
  surface: TG.bg,
  text: TG.textPrimary,
  textMuted: TG.textSecondary,
  primary: TG.accent,
  secondary: TG.accentDark,
  accent: TG.gold,
  success: TG.scoreGreen,
  danger: TG.scoreRed,
  gold: TG.gold,
  border: TG.separator,
  gradientPrimary: [TG.headerBg, TG.accentDark] as const,
  gradientAccent: [TG.streakOrange, TG.scoreOrange] as const,
  gradientBlue: [TG.mentorTeal, TG.accent] as const,
};

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { alert } = useAlert();
  const { linked: telegramLinked, deepLink: telegramDeepLink, checkLink: checkTelegramLink } = useTelegram();
  
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ followers: 0, following: 0 });
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [reputation, setReputation] = useState<UserReputation | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const { data: profileData, refresh } = useCachedFetch<{
    stats: { followers: number; following: number };
    progress: UserProgress | null;
    reputation: UserReputation | null;
    achievements: Achievement[];
  }>({
    cacheKey: `student_profile_${user?.id}`,
    apiFn: async () => {
      const [profileRes, progRes, repRes, achRes] = await Promise.allSettled([
        apiGetUserProfile(user!.id),
        apiFetchProgress(),
        apiFetchReputation(user!.id),
        apiFetchAchievements(),
      ]);
      return {
        stats: profileRes.status === 'fulfilled' ? profileRes.value.stats : { followers: 0, following: 0 },
        progress: progRes.status === 'fulfilled' ? progRes.value : null,
        reputation: repRes.status === 'fulfilled' ? repRes.value : null,
        achievements: achRes.status === 'fulfilled' ? (achRes.value.data || []) : [],
      };
    },
    enabled: !!user?.id,
    deps: [user?.id],
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!profileData) return;
    setStats(profileData.stats);
    setProgress(profileData.progress);
    setReputation(profileData.reputation);
    setAchievements(profileData.achievements);
  }, [profileData]);

  useFocusEffect(
    useCallback(() => {
      checkTelegramLink();
    }, [checkTelegramLink]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiLogout();
            } catch {
              // still logout locally even if API fails
            }
            logout();
          },
        },
      ],
      'warning',
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TG.accent} />}
      >
        {/* ── Header & Hero ── */}
        <LinearGradient colors={COLORS.gradientPrimary} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.heroBackground}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Profile</Text>
            <TouchableOpacity onPress={() => router.push('/profile/edit' as any)} activeOpacity={0.7} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <View style={styles.editButtonIcon}>
                <Edit2 size={16} color={COLORS.primary} />
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.avatarSection}>
            <View style={styles.avatarWrapper}>
              <Image
                source={{ uri: user?.avatarUrl || 'https://i.ibb.co/68vS1zZ/default-avatar.png' }}
                style={styles.avatar}
              />
            </View>
            <Text style={styles.name}>{user?.fullName}</Text>
            <Text style={styles.username}>@{user?.username}</Text>

            <View style={styles.roleRow}>
              <View style={[styles.roleBadge, user?.role === 'teacher' && styles.roleBadgeTeacher]}>
                <Text style={[styles.roleText, user?.role === 'teacher' && styles.roleTextTeacher]}>
                  {user?.role === 'teacher' ? 'Teacher' : 'Student'}
                </Text>
              </View>
              {user?.role === 'teacher' && user?.verifiedTeacher && (
                <View style={[styles.roleBadge, styles.roleBadgeVerified]}>
                  <Shield size={12} color={TG.textWhite} style={{ marginRight: 4 }} />
                  <Text style={[styles.roleText, { color: TG.textWhite }]}>Verified</Text>
                </View>
              )}
            </View>
          </View>
        </LinearGradient>

        {/* ── Floating Stats Card ── */}
        <View style={styles.floatingStatsWrapper}>
          <View style={styles.floatingStatsCard}>
            <TouchableOpacity
              style={styles.floatingStatItem}
              activeOpacity={0.7}
              onPress={() => router.push(`/followers/${user?.id}` as any)}
            >
              <Text style={styles.floatingStatNum}>{stats.followers}</Text>
              <Text style={styles.floatingStatLabel}>Followers</Text>
            </TouchableOpacity>
            <View style={styles.floatingStatDivider} />
            <TouchableOpacity
              style={styles.floatingStatItem}
              activeOpacity={0.7}
              onPress={() => router.push(`/followings/${user?.id}` as any)}
            >
              <Text style={styles.floatingStatNum}>{stats.following}</Text>
              <Text style={styles.floatingStatLabel}>Following</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Main Content Area ── */}
        <View style={styles.mainContent}>
          {/* Progress / Gamification */}
          {progress && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Progress</Text>
              <View style={styles.gamStatsRow}>
                <LinearGradient colors={COLORS.gradientAccent} style={styles.gamStatCard}>
                  <Flame size={20} color="#fff" />
                  <View style={styles.gamStatInfo}>
                    <Text style={styles.gamStatNumW}>{progress.currentStreak}</Text>
                    <Text style={styles.gamStatLabelW}>Day Streak</Text>
                  </View>
                </LinearGradient>
                <LinearGradient colors={['#F5C542', '#E6A300']} style={styles.gamStatCard}>
                  <Zap size={20} color="#fff" />
                  <View style={styles.gamStatInfo}>
                    <Text style={styles.gamStatNumW}>{progress.xp}</Text>
                    <Text style={styles.gamStatLabelW}>Total XP</Text>
                  </View>
                </LinearGradient>
                <View style={[styles.gamStatCard, styles.gamStatCardGlass]}>
                  <Text style={{ fontSize: 20 }}>🪙</Text>
                  <View style={styles.gamStatInfo}>
                    <Text style={styles.gamStatNumD}>{progress.coins}</Text>
                    <Text style={styles.gamStatLabelD}>Coins</Text>
                  </View>
                </View>
              </View>

              <View style={styles.levelCard}>
                <View style={styles.levelHeader}>
                  <View style={styles.levelBadge}>
                    <Star size={14} color="#fff" fill="#fff" />
                    <Text style={styles.levelBadgeText}>Level {progress.level}</Text>
                  </View>
                  <Text style={styles.xpText}>{progress.xpInCurrentLevel} / {progress.xpForNextLevel} XP</Text>
                </View>
                <View style={styles.progressBg}>
                  <LinearGradient
                    colors={COLORS.gradientPrimary}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.progressFill, { width: `${Math.max(5, progress.xpPercent)}%` }]}
                  />
                </View>
              </View>
            </View>
          )}

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
            </View>
          )}

          {/* Personal Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personal Info</Text>
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <View style={styles.infoIconWrap}>
                  <MapPin size={18} color={COLORS.textMuted} />
                </View>
                <Text style={styles.infoLabel}>Region</Text>
                <Text style={styles.infoValue}>{user?.region || 'Not set'}</Text>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoRow}>
                <View style={styles.infoIconWrap}>
                  <UserIcon size={18} color={COLORS.textMuted} />
                </View>
                <Text style={styles.infoLabel}>Gender</Text>
                <Text style={styles.infoValue}>{user?.gender || 'Not set'}</Text>
              </View>
              <View style={styles.infoDivider} />
              <View style={styles.infoRow}>
                <View style={styles.infoIconWrap}>
                  <Phone size={18} color={COLORS.textMuted} />
                </View>
                <Text style={styles.infoLabel}>Phone</Text>
                <Text style={styles.infoValue}>{user?.phone || 'Not set'}</Text>
              </View>
            </View>
          </View>

          {/* Achievements */}
          {achievements.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Achievements</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.achievementsScroll}>
                {achievements.map((a) => (
                  <View key={a.id} style={[styles.achievementCard, a.unlocked && styles.achievementCardActive]}>
                    <Image
                      source={getBadgeImage(a.key, a.unlocked)}
                      style={[styles.achievementImg, !a.unlocked && styles.achievementImgLocked]}
                    />
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Settings & Admin Menu */}
          <View style={styles.menuSection}>
            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.7}
              onPress={() => {
                if (!telegramLinked && telegramDeepLink) {
                  Linking.openURL(telegramDeepLink);
                }
              }}
            >
              <View style={[styles.menuItemIcon, { backgroundColor: telegramLinked ? TG.greenLight : TG.accentLight }]}>
                <Send size={18} color={telegramLinked ? TG.green : TG.accent} />
              </View>
              <Text style={styles.menuItemText}>
                {telegramLinked ? 'Telegram Connected' : 'Connect Telegram'}
              </Text>
              {!telegramLinked && <ChevronRight size={18} color={COLORS.textMuted} />}
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} activeOpacity={0.7} onPress={() => router.push('/sessions' as any)}>
              <View style={[styles.menuItemIcon, { backgroundColor: TG.accentLight }]}>
                <Monitor size={18} color={TG.accent} />
              </View>
              <Text style={styles.menuItemText}>Active Sessions</Text>
              <ChevronRight size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0, marginTop: 12 }]} activeOpacity={0.7} onPress={handleLogout}>
              <View style={[styles.menuItemIcon, { backgroundColor: TG.redLight }]}>
                <LogOut size={18} color={TG.red} />
              </View>
              <Text style={[styles.menuItemText, { color: TG.red }]}>Log Out</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} activeOpacity={0.7} onPress={() => router.push(`/user/${user?.id}/delete` as any)}>
              <View style={[styles.menuItemIcon, { backgroundColor: TG.redLight }]}>
                <Trash2 size={18} color={TG.red} />
              </View>
              <Text style={[styles.menuItemText, { color: TG.red }]}>Delete Account</Text>
              <ChevronRight size={18} color={TG.red} />
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TG.headerBg },
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: 60 },

  // Hero Section
  heroBackground: {
    paddingTop: 10,
    paddingBottom: 60,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  editButtonIcon: {
    backgroundColor: '#fff',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  avatarWrapper: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#fff',
    padding: 3,
    marginBottom: 12,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 45,
  },
  name: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 4 },
  username: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 12 },
  roleRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  roleBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  roleBadgeTeacher: { backgroundColor: TG.green },
  roleTextTeacher: { color: '#fff' },
  roleBadgeVerified: { backgroundColor: TG.purple },

  // Floating Stats
  floatingStatsWrapper: {
    paddingHorizontal: 24,
    marginTop: -35,
    zIndex: 10,
  },
  floatingStatsCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingVertical: 18,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  floatingStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  floatingStatDivider: {
    width: 1,
    backgroundColor: COLORS.border,
  },
  floatingStatNum: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  floatingStatLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },

  // Main Content
  mainContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  section: {
    marginBottom: 30,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 16,
  },

  // Info Card
  infoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
    
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  infoIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: TG.bgSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: COLORS.text },
  infoValue: { fontSize: 15, color: COLORS.textMuted, fontWeight: '500' },
  infoDivider: { height: 1, backgroundColor: COLORS.border, marginLeft: 48 },

  // Gamification
  gamStatsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  gamStatCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 10,
  },
  gamStatCardGlass: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  gamStatInfo: { flex: 1 },
  gamStatNumW: { fontSize: 18, fontWeight: '800', color: '#fff' },
  gamStatLabelW: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
  gamStatNumD: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  gamStatLabelD: { fontSize: 10, fontWeight: '600', color: COLORS.textMuted },

  levelCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 16,
  },
  levelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TG.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  levelBadgeText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  xpText: { fontSize: 13, fontWeight: '700', color: COLORS.textMuted },
  progressBg: { height: 10, backgroundColor: TG.bgSecondary, borderRadius: 5, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 5 },

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

  // Achievements
  achievementsScroll: { gap: 10, paddingRight: 20 },
  achievementCard: {
    width: 100,
    height: 100,
    borderRadius: 28,
    backgroundColor: TG.bgSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  achievementCardActive: {
    backgroundColor: 'transparent',
  },
  achievementImg: { width: 100, height: 100, resizeMode: 'contain' },
  achievementImgLocked: { opacity: 0.6 },
  achievementTitle: { fontSize: 11, fontWeight: '700', color: COLORS.text, textAlign: 'center', lineHeight: 16 },
  achievementTitleLocked: { color: COLORS.textMuted },

  // Menus
  menuSection: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  menuItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuItemText: { flex: 1, fontSize: 16, fontWeight: '600', color: COLORS.text },

});