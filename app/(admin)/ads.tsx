import { useAlert } from '@/components/CustomAlert';
import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import { Ad, apiDeleteAd, apiFetchAllAds, apiUpdateAd } from '@/lib/api';
import { useFocusEffect, useRouter } from 'expo-router';
import {
    ChevronRight,
    Eye,
    EyeOff,
    Image as ImageIcon,
    Plus,
    Trash2,
} from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AdminAdsScreen() {
  const toast = useToast();
  const router = useRouter();
  const { alert } = useAlert();
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetchAllAds();
      setAds(data || []);
    } catch (e: any) {
      toast.error('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // ── Delete ──
  const handleDelete = (ad: Ad) => {
    alert(
      'Delete Ad',
      `Delete "${ad.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiDeleteAd(ad.id);
              setAds((prev) => prev.filter((a) => a.id !== ad.id));
              toast.success('Done', 'Ad deleted');
            } catch (e: any) {
              toast.error('Error', e.message);
            }
          },
        },
      ],
      'destructive',
    );
  };

  // ── Toggle active ──
  const handleToggleActive = async (ad: Ad) => {
    try {
      await apiUpdateAd(ad.id, { isActive: !ad.isActive });
      setAds((prev) => prev.map((a) => (a.id === ad.id ? { ...a, isActive: !a.isActive } : a)));
    } catch (e: any) {
      toast.error('Error', e.message);
    }
  };

  const renderItem = ({ item }: { item: Ad }) => (
    <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => router.push({ pathname: '/ads/[id]/edit', params: { id: String(item.id) } } as any)}>
      <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
      <View style={{ flex: 1 }}>
        <Text style={styles.adTitle} numberOfLines={1}>{item.title}</Text>
        {item.linkUrl ? (
          <Text style={styles.adLink} numberOfLines={1}>{item.linkUrl}</Text>
        ) : null}
        <View style={styles.statusRow}>
          {item.isActive ? (
            <View style={[styles.badge, { backgroundColor: TG.green + '20' }]}>
              <Eye size={12} color={TG.green} />
              <Text style={[styles.badgeText, { color: TG.green }]}>Active</Text>
            </View>
          ) : (
            <View style={[styles.badge, { backgroundColor: TG.textHint + '20' }]}>
              <EyeOff size={12} color={TG.textHint} />
              <Text style={[styles.badgeText, { color: TG.textHint }]}>Inactive</Text>
            </View>
          )}
        </View>
      </View>
      <TouchableOpacity
        onPress={() => handleToggleActive(item)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        activeOpacity={0.7}
        style={{ marginRight: 6 }}
      >
        {item.isActive ? <Eye size={18} color={TG.green} /> : <EyeOff size={18} color={TG.textHint} />}
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => handleDelete(item)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        activeOpacity={0.7}
      >
        <Trash2 size={18} color={TG.red} />
      </TouchableOpacity>
      <ChevronRight size={18} color={TG.textHint} style={{ marginLeft: 4 }} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Manage Ads</Text>
        <TouchableOpacity onPress={() => router.push('/ads/create' as any)} activeOpacity={0.7}>
          <Plus size={22} color={TG.textWhite} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={TG.accent} />
        </View>
      ) : (
        <FlatList
          data={ads}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.centered}>
              <ImageIcon size={40} color={TG.separator} />
              <Text style={styles.emptyText}>No ads yet</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/ads/create' as any)} activeOpacity={0.7}>
                <Text style={styles.emptyBtnText}>Create First Ad</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TG.bgSecondary },
  header: {
    backgroundColor: TG.headerBg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: TG.textWhite },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingTop: 80 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TG.bg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: TG.separatorLight,
    gap: 12,
  },
  thumb: {
    width: 56,
    height: 32,
    borderRadius: 6,
    backgroundColor: TG.bgSecondary,
  },
  adTitle: { fontSize: 15, fontWeight: '600', color: TG.textPrimary },
  adLink: { fontSize: 12, color: TG.accent, marginTop: 2 },
  statusRow: { flexDirection: 'row', marginTop: 4, gap: 6 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: { fontSize: 11, fontWeight: '600' },

  emptyText: { color: TG.textSecondary, fontSize: 15 },
  emptyBtn: { backgroundColor: TG.accent, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, marginTop: 8 },
  emptyBtnText: { color: TG.textWhite, fontWeight: '600', fontSize: 14 },
});
