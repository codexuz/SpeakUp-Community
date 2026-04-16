import { useAlert } from '@/components/CustomAlert';
import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import { apiBuyStreakFreeze, apiFetchLeaderboard, apiFetchProgress } from '@/lib/api';
import type { UserProgress } from '@/lib/types';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, Crown, Flame, Shield, Snowflake, Trophy } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function StreakScreen() {
  const router = useRouter();
  const toast = useToast();
  const { alert } = useAlert();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [buying, setBuying] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [progRes, lbRes] = await Promise.allSettled([
        apiFetchProgress(),
        apiFetchLeaderboard('streak', 20),
      ]);

      if (progRes.status === 'fulfilled') setProgress(progRes.value);
      if (lbRes.status === 'fulfilled') setLeaderboard(lbRes.value.data || []);
    } catch (e) {
      console.log('Error loading streak data', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handeBuyFreeze = async () => {
    if (!progress) return;
    if (progress.coins < 50) {
      toast.warning('Not enough coins', 'You need 50 🪙 to buy a streak freeze.');
      return;
    }
    if (progress.streakFreezes >= 3) {
      toast.warning('Inventory Full', 'You can only hold a maximum of 3 streak freezes.');
      return;
    }

    alert(
      'Buy Streak Freeze?',
      'Protect your streak for one day of inactivity. Costs 50 coins.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Buy Freeze',
          onPress: async () => {
            setBuying(true);
            try {
              const res = await apiBuyStreakFreeze();
              if (res.success) {
                toast.success('Equipped!', '1x Streak freeze added to inventory.');
                setProgress((prev) =>
                  prev ? { ...prev, streakFreezes: res.streakFreezes, coins: res.coins } : null
                );
              }
            } catch (e: any) {
              toast.error('Error', e.message || 'Failed to purchase streak freeze.');
            } finally {
              setBuying(false);
            }
          },
        },
      ],
      'info'
    );
  };

  const renderLeaderboardItem = ({ item, index }: { item: any; index: number }) => {
    const isTop3 = index < 3;
    const isNumberOne = index === 0;
    const rankColor = index === 0 ? TG.gold : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : TG.textSecondary;

    return (
      <View style={[styles.lbItem, isTop3 && styles.lbItemTop3, isNumberOne && styles.lbItemTop1]}>
        <View style={styles.lbRankWrap}>
          {isTop3 ? (
            <Crown size={20} color={rankColor} fill={isNumberOne ? rankColor : 'transparent'} />
          ) : (
            <Text style={styles.lbRank}>{index + 1}</Text>
          )}
        </View>

        <View style={styles.lbAvatar}>
          {item.user?.avatarUrl ? (
            <Image source={{ uri: item.user.avatarUrl }} style={styles.lbAvatarImage} />
          ) : (
            <Text style={styles.lbAvatarText}>{(item.user?.fullName || '?').charAt(0)}</Text>
          )}
          {isTop3 && (
            <View style={[styles.lbTopBadge, { backgroundColor: rankColor }]}>
              <Text style={styles.lbTopBadgeText}>{index + 1}</Text>
            </View>
          )}
        </View>

        <View style={styles.lbInfo}>
          <Text style={[styles.lbName, isTop3 && { fontWeight: '800' }]} numberOfLines={1}>
            {item.user?.fullName}
          </Text>
          <Text style={styles.lbHandle} numberOfLines={1}>
            @{item.user?.username}
          </Text>
        </View>

        <View style={[styles.lbStreakBadge, isTop3 ? { backgroundColor: TG.streakOrange } : {}]}>
          <Flame size={16} color={isTop3 ? '#fff' : TG.streakOrange} fill={isTop3 ? '#fff' : TG.streakOrange} />
          <Text style={[styles.lbStreakText, isTop3 && { color: '#fff' }]}>{item.streak || 0}</Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView edges={['top']} style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={TG.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          style={styles.headerBtn}
        >
          <ArrowLeft size={22} color={TG.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Streak</Text>
        <View style={styles.headerCoinPill}>
           <Text style={styles.headerCoinIcon}>🪙</Text>
           <Text style={styles.headerCoinText}>{progress?.coins || 0}</Text>
        </View>
      </View>

      <FlatList
        data={leaderboard}
        keyExtractor={(item, idx) => item.userId || idx.toString()}
        renderItem={renderLeaderboardItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TG.accent} />}
        ListHeaderComponent={
          <View style={styles.headerContent}>

            {/* Premium Streak Hero */}
            <View style={styles.heroWrapper}>
              <LinearGradient
                colors={[TG.streakOrange, '#FF4500']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroCard}
              >
                <View style={styles.heroRingBg}>
                  <View style={styles.heroRingInner}>
                    <Flame size={64} color="#fff" fill="#fff" />
                  </View>
                </View>

                <Text style={styles.heroStreakVal}>{progress?.currentStreak || 0}</Text>
                <Text style={styles.heroStreakLabel}>Day Streak</Text>

                <View style={styles.heroGlassPill}>
                  <Flame size={14} color="#fff" />
                  <Text style={styles.heroGlassText}>
                    {progress?.currentStreak === 0 ? 'Start your streak today!' : 'Keep it burning!'}
                  </Text>
                </View>
              </LinearGradient>
            </View>

            {/* Streak Freezes Shop - Premium Layout */}
            <View style={styles.shopCard}>
              <LinearGradient 
                colors={['#E6F7FF', '#FFFFFF']} 
                start={{ x: 0, y: 0 }} 
                end={{ x: 0, y: 1 }} 
                style={[StyleSheet.absoluteFillObject, styles.absoluteFillRounded]}
               />
              <View style={styles.shopHeaderRow}>
                <View style={styles.shopIconWrap}>
                  <Snowflake size={26} color={TG.aiFeedback} fill="rgba(33, 150, 243, 0.2)" />
                </View>
                <View style={styles.shopInfo}>
                  <Text style={styles.shopTitle}>Streak Freeze</Text>
                  <Text style={styles.shopDesc}>
                    Miss a day? Don&apos;t lose your streak.
                  </Text>
                </View>
              </View>

              <View style={styles.shopDivider} />

              <View style={styles.shopFooterRow}>
                <View style={styles.shopInventoryBlock}>
                  <Text style={styles.inventoryLabel}>Inventory</Text>
                  <View style={styles.shopInventory}>
                    {Array.from({ length: 3 }).map((_, i) => (
                      <View 
                       key={i} 
                       style={[styles.inventorySlot, (progress?.streakFreezes || 0) > i && styles.inventorySlotActive]}
                      >
                       <Shield
                        size={14}
                        color={(progress?.streakFreezes || 0) > i ? TG.aiFeedback : TG.textHint}
                        fill={(progress?.streakFreezes || 0) > i ? TG.aiFeedback : 'transparent'}
                      />
                      </View>
                    ))}
                    <Text style={styles.shopCountText}>{progress?.streakFreezes || 0}/3</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[
                    styles.buyBtn,
                    ((progress?.coins || 0) < 50 || (progress?.streakFreezes || 0) >= 3 || buying) && styles.buyBtnDisabled,
                  ]}
                  activeOpacity={0.7}
                  onPress={handeBuyFreeze}
                  disabled={buying || (progress?.streakFreezes || 0) >= 3}
                >
                  {buying ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (progress?.streakFreezes || 0) >= 3 ? (
                    <Text style={styles.buyBtnText}>MAXED</Text>
                  ) : (
                    <>
                      <Text style={{ fontSize: 16 }}>🪙</Text>
                      <Text style={styles.buyBtnText}>50</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Leaderboard Title */}
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionTitleIconBox}>
                <Trophy size={18} color="#fff" fill="#fff" />
              </View>
              <Text style={styles.sectionTitle}>Global Streak Board</Text>
            </View>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TG.bgSecondary },
  absoluteFillRounded: { borderRadius: 24 },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
    backgroundColor: TG.bgSecondary,
  },
  headerBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: TG.bg, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: TG.textPrimary },
  headerCoinPill: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: TG.bg,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14,
  },
  headerCoinIcon: { fontSize: 14, marginRight: 4 },
  headerCoinText: { fontSize: 14, fontWeight: '800', color: TG.gold },

  listContent: { paddingHorizontal: 20, paddingBottom: 60, paddingTop: 10 },
  headerContent: { marginBottom: 20 },

  // Hero - Advanced
  heroWrapper: {
    marginBottom: 24,
  },
  heroCard: {
    alignItems: 'center',
    paddingVertical: 36,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  heroRingBg: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  heroRingInner: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroStreakVal: { fontSize: 56, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  heroStreakLabel: { fontSize: 18, fontWeight: '800', color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 20 },
  heroGlassPill: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, gap: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)'
  },
  heroGlassText: { fontSize: 13, fontWeight: '600', color: '#fff' },

  // Shop Card - High Fidelity
  shopCard: {
    backgroundColor: TG.bg,
    borderRadius: 24,
    padding: 20,
    marginBottom: 36,
    borderWidth: 1,
    borderColor: 'rgba(33, 150, 243, 0.15)',
    overflow: 'hidden',
  },
  shopHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  shopIconWrap: {
    width: 54, height: 54, borderRadius: 18,
    backgroundColor: TG.bg, alignItems: 'center', justifyContent: 'center',
    marginRight: 16,
  },
  shopInfo: { flex: 1 },
  shopTitle: { fontSize: 18, fontWeight: '800', color: TG.textPrimary, marginBottom: 4 },
  shopDesc: { fontSize: 13, color: TG.textSecondary, fontWeight: '500' },
  
  shopDivider: { height: 1, backgroundColor: 'rgba(33, 150, 243, 0.15)', marginVertical: 16 },

  shopFooterRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  shopInventoryBlock: { gap: 6 },
  inventoryLabel: { fontSize: 11, fontWeight: '700', color: TG.textHint, textTransform: 'uppercase', letterSpacing: 0.5 },
  shopInventory: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inventorySlot: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: TG.bgSecondary,
    borderWidth: 1, borderColor: TG.separator,
    alignItems: 'center', justifyContent: 'center',
  },
  inventorySlotActive: {
    backgroundColor: '#fff',
    borderColor: TG.aiFeedbackLight,
  },
  shopCountText: { fontSize: 13, fontWeight: '700', color: TG.textSecondary, marginLeft: 4 },
  
  buyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: TG.aiFeedback,
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16,
    gap: 6, minWidth: 100,
  },
  buyBtnDisabled: { backgroundColor: TG.separator, shadowOpacity: 0 },
  buyBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },

  // Leaderboard
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  sectionTitleIconBox: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: TG.gold, alignItems: 'center', justifyContent: 'center',
    shadowColor: TG.gold, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 2
  },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: TG.textPrimary },
  
  lbItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: TG.bg, padding: 12, borderRadius: 20, marginBottom: 12,
    borderWidth: 1, borderColor: 'transparent',
  },
  lbItemTop3: {
    backgroundColor: '#fff',
    borderColor: TG.goldLight,
    paddingVertical: 16,
  },
  lbItemTop1: {
    borderColor: TG.gold,
    backgroundColor: '#FFFCF2', // subtle gold tint
  },
  lbRankWrap: { width: 36, alignItems: 'center' },
  lbRank: { fontSize: 16, fontWeight: '800', color: TG.textSecondary },
  
  lbAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: TG.accentLight, alignItems: 'center', justifyContent: 'center', marginHorizontal: 12 },
  lbAvatarImage: { width: '100%', height: '100%', borderRadius: 24 },
  lbAvatarText: { fontSize: 18, fontWeight: '800', color: TG.accent },
  lbTopBadge: {
    position: 'absolute', bottom: -4, right: -4,
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff'
  },
  lbTopBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },

  lbInfo: { flex: 1, paddingRight: 10 },
  lbName: { fontSize: 16, fontWeight: '700', color: TG.textPrimary, marginBottom: 2 },
  lbHandle: { fontSize: 13, color: TG.textSecondary, fontWeight: '500' },
  
  lbStreakBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: TG.streakOrangeLight,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, gap: 6,
  },
  lbStreakText: { fontSize: 16, fontWeight: '800', color: TG.streakOrange },
});
