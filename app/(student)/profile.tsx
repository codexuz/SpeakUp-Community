import { useAlert } from '@/components/CustomAlert';
import { TG } from '@/constants/theme';
import { apiFetchAchievements, apiFetchProgress, apiFetchReputation, apiGetUserProfile, apiLogout } from '@/lib/api';
import type { Achievement, UserProgress, UserReputation } from '@/lib/types';
import { useAuth } from '@/store/auth';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Award, ChevronRight, Edit2, Flame, Heart, LogOut, MapPin, Monitor, Phone, Shield, Star, User as UserIcon, Zap } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { alert } = useAlert();
  const [stats, setStats] = useState({ followers: 0, following: 0 });
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [reputation, setReputation] = useState<UserReputation | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      apiGetUserProfile(user.id)
        .then((p) => setStats(p.stats))
        .catch(() => {});
      apiFetchProgress()
        .then((res) => setProgress(res))
        .catch(() => {});
      apiFetchReputation(user.id)
        .then((res) => setReputation(res))
        .catch(() => {});
      apiFetchAchievements()
        .then((res) => setAchievements(res.data || []))
        .catch(() => {});
    }, [user?.id]),
  );

  const handleLogout = async () => {
    alert('Log Out', 'Are you sure you want to log out?', [
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
    ], 'warning');
  };


  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity onPress={() => router.push('/profile/edit' as any)} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Edit2 size={18} color={TG.textWhite} />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1, backgroundColor: TG.bgSecondary }} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.profileSection}>
          <Image
            source={{ uri: user?.avatarUrl || 'https://i.ibb.co/68vS1zZ/default-avatar.png' }}
            style={styles.avatar}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user?.fullName}</Text>
            <Text style={styles.username}>@{user?.username}</Text>
          </View>
          <View style={[styles.roleBadge, user?.role === 'teacher' && styles.teacherBadge]}>
            <Text style={[styles.roleText, user?.role === 'teacher' && styles.teacherText]}>{user?.role}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <TouchableOpacity
            style={styles.statCard}
            activeOpacity={0.7}
            onPress={() => router.push(`/followers/${user?.id}` as any)}
          >
            <Text style={styles.statNum}>{stats.followers}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.statCard}
            activeOpacity={0.7}
            onPress={() => router.push(`/followings/${user?.id}` as any)}
          >
            <Text style={styles.statNum}>{stats.following}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <View style={styles.infoRow}>
            <MapPin size={18} color={TG.textSecondary} />
            <Text style={styles.infoLabel}>Region</Text>
            <Text style={styles.infoValue}>{user?.region || 'Not set'}</Text>
          </View>
          <View style={styles.infoRow}>
            <UserIcon size={18} color={TG.textSecondary} />
            <Text style={styles.infoLabel}>Gender</Text>
            <Text style={styles.infoValue}>{user?.gender || 'Not set'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Phone size={18} color={TG.textSecondary} />
            <Text style={styles.infoLabel}>Phone</Text>
            <Text style={styles.infoValue}>{user?.phone || 'Not set'}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* ── Gamification Stats ──────── */}
        {progress && (
          <View style={styles.gamificationSection}>
            <Text style={styles.sectionTitle}>Progress</Text>
            <View style={styles.gamStatsRow}>
              <View style={styles.gamStatCard}>
                <Flame size={20} color={TG.streakOrange} />
                <Text style={styles.gamStatNum}>{progress.currentStreak}</Text>
                <Text style={styles.gamStatLabel}>Day Streak</Text>
              </View>
              <View style={styles.gamStatCard}>
                <Zap size={20} color={TG.gold} />
                <Text style={styles.gamStatNum}>{progress.xp}</Text>
                <Text style={styles.gamStatLabel}>Total XP</Text>
              </View>
              <View style={styles.gamStatCard}>
                <Star size={20} color={TG.accent} />
                <Text style={styles.gamStatNum}>Lv.{progress.level}</Text>
                <Text style={styles.gamStatLabel}>Level</Text>
              </View>
              <View style={styles.gamStatCard}>
                <Text style={{ fontSize: 18 }}>🪙</Text>
                <Text style={styles.gamStatNum}>{progress.coins}</Text>
                <Text style={styles.gamStatLabel}>Coins</Text>
              </View>
            </View>
            <View style={styles.xpBarWrap}>
              <View style={styles.xpBarBg}>
                <View style={[styles.xpBarFill, { width: `${progress.xpPercent}%` }]} />
              </View>
              <Text style={styles.xpBarLabel}>{progress.xpInCurrentLevel}/{progress.xpForNextLevel} XP</Text>
            </View>
          </View>
        )}

        {/* ── Reputation ─────────────── */}
        {reputation && (
          <>
            <View style={styles.divider} />
            <View style={styles.reputationSection}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>Reputation</Text>
                {reputation.mentorLabel ? (
                  <View style={styles.mentorBadge}>
                    <Shield size={12} color={TG.mentorTeal} />
                    <Text style={styles.mentorLabel}>{reputation.mentorLabel}</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.repRow}>
                <View style={styles.repItem}>
                  <Heart size={16} color={TG.red} />
                  <Text style={styles.repNum}>{reputation.helpfulVotes}</Text>
                  <Text style={styles.repLabel}>Helpful</Text>
                </View>
                <View style={styles.repItem}>
                  <Star size={16} color={TG.gold} />
                  <Text style={styles.repNum}>{reputation.reviewsGiven}</Text>
                  <Text style={styles.repLabel}>Reviews</Text>
                </View>
                <View style={styles.repItem}>
                  <Award size={16} color={TG.accent} />
                  <Text style={styles.repNum}>{reputation.clarityScore.toFixed(1)}</Text>
                  <Text style={styles.repLabel}>Clarity</Text>
                </View>
              </View>
            </View>
          </>
        )}

        {/* ── Achievements ───────────── */}
        {achievements.length > 0 && (
          <>
            <View style={styles.divider} />
            <View style={styles.achievementsSection}>
              <Text style={styles.sectionTitle}>Achievements</Text>
              <View style={styles.achieveGrid}>
                {achievements.slice(0, 8).map((a) => (
                  <View key={a.id} style={[styles.achieveCard, !a.unlocked && styles.achieveCardLocked]}>
                    <Text style={styles.achieveEmoji}>🏆</Text>
                    <Text style={[styles.achieveTitle, !a.unlocked && styles.achieveTitleLocked]} numberOfLines={1}>
                      {a.title}
                    </Text>
                    <Text style={styles.achieveCategory}>{a.category}</Text>
                  </View>
                ))}
              </View>
              {achievements.length > 8 && (
                <TouchableOpacity style={styles.showAllBtn}>
                  <Text style={styles.showAllText}>View all {achievements.length} achievements</Text>
                  <ChevronRight size={16} color={TG.accent} />
                </TouchableOpacity>
              )}
            </View>
          </>
        )}

        <View style={styles.divider} />

        <TouchableOpacity style={styles.menuRow} activeOpacity={0.7} onPress={() => router.push('/sessions' as any)}>
          <Monitor size={18} color={TG.textSecondary} />
          <Text style={styles.menuText}>Active Sessions</Text>
          <ChevronRight size={18} color={TG.textHint} style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>

        <View style={{ height: 24 }} />

        <TouchableOpacity style={styles.logoutRow} onPress={handleLogout} activeOpacity={0.7}>
          <LogOut size={18} color={TG.red} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TG.headerBg },
  header: {
    backgroundColor: TG.headerBg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: TG.textWhite },

  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TG.bg,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: TG.bgSecondary,
  },
  name: { fontSize: 18, fontWeight: '700', color: TG.textPrimary, marginBottom: 2 },
  username: { fontSize: 14, color: TG.textSecondary },
  roleBadge: {
    backgroundColor: TG.accentLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  roleText: { fontSize: 12, fontWeight: '600', color: TG.accent, textTransform: 'capitalize' },
  teacherBadge: { backgroundColor: TG.greenLight },
  teacherText: { color: TG.green },

  statsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: TG.bg,
  },
  statCard: {
    flex: 1,
    backgroundColor: TG.bgSecondary,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  statNum: { fontSize: 18, fontWeight: '700', color: TG.textPrimary },
  statLabel: { fontSize: 12, color: TG.textSecondary, marginTop: 2 },

  divider: { height: 8, backgroundColor: TG.bgSecondary },

  section: { backgroundColor: TG.bg },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: TG.separatorLight,
  },
  infoLabel: { fontSize: 15, color: TG.textPrimary, flex: 1 },
  infoValue: { fontSize: 15, color: TG.textSecondary },

  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: TG.bg,
    gap: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: TG.separatorLight,
  },
  menuText: { fontSize: 15, color: TG.textPrimary },

  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: TG.bg,
    gap: 12,
  },
  logoutText: { fontSize: 15, color: TG.red, fontWeight: '500' },

  // ── Gamification ──
  sectionTitle: { fontSize: 16, fontWeight: '700', color: TG.textPrimary, marginBottom: 12 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  gamificationSection: { backgroundColor: TG.bg, padding: 16 },
  gamStatsRow: { flexDirection: 'row', gap: 8 },
  gamStatCard: {
    flex: 1,
    backgroundColor: TG.bgSecondary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 4,
  },
  gamStatNum: { fontSize: 16, fontWeight: '700', color: TG.textPrimary },
  gamStatLabel: { fontSize: 10, color: TG.textHint },
  xpBarWrap: { marginTop: 12 },
  xpBarBg: { height: 6, backgroundColor: TG.bgSecondary, borderRadius: 3, overflow: 'hidden' },
  xpBarFill: { height: 6, borderRadius: 3, backgroundColor: TG.gold },
  xpBarLabel: { fontSize: 11, color: TG.textHint, textAlign: 'right', marginTop: 4 },

  // ── Reputation ──
  reputationSection: { backgroundColor: TG.bg, padding: 16 },
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
  repRow: { flexDirection: 'row', gap: 10 },
  repItem: {
    flex: 1,
    backgroundColor: TG.bgSecondary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 4,
  },
  repNum: { fontSize: 16, fontWeight: '700', color: TG.textPrimary },
  repLabel: { fontSize: 11, color: TG.textHint },

  // ── Achievements ──
  achievementsSection: { backgroundColor: TG.bg, padding: 16 },
  achieveGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  achieveCard: {
    width: '23%',
    backgroundColor: TG.bgSecondary,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 4,
  },
  achieveCardLocked: { opacity: 0.35 },
  achieveEmoji: { fontSize: 22 },
  achieveTitle: { fontSize: 10, fontWeight: '600', color: TG.textPrimary, textAlign: 'center', paddingHorizontal: 4 },
  achieveTitleLocked: { color: TG.textHint },
  achieveCategory: { fontSize: 9, color: TG.textHint, textTransform: 'capitalize' },
  showAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 4,
  },
  showAllText: { fontSize: 13, fontWeight: '600', color: TG.accent },
});