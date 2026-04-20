import { useAlert } from '@/components/CustomAlert';
import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import { useCachedFetch } from '@/hooks/useCachedFetch';
import { apiFetchAllVerifications, apiReviewVerification } from '@/lib/api';
import { Check, Shield, X } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type FilterStatus = 'pending' | 'approved' | 'rejected' | 'all';

export default function AdminVerificationScreen() {
  const toast = useToast();
  const { alert } = useAlert();
  const [filter, setFilter] = useState<FilterStatus>('pending');

  const { data: requests, isLoading: loading, refresh } = useCachedFetch<any[]>({
    cacheKey: `admin_verifications_${filter}`,
    apiFn: async () => {
      const status = filter === 'all' ? undefined : filter;
      const data = await apiFetchAllVerifications(status);
      return data || [];
    },
    deps: [filter],
    staleTime: 30_000,
  });

  const handleReview = (item: any, status: 'approved' | 'rejected') => {
    const title = status === 'approved' ? 'Approve' : 'Reject';
    alert(title, `${title} verification for ${item.user?.fullName || 'this user'}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: title,
        style: status === 'rejected' ? 'destructive' : 'default',
        onPress: async () => {
          try {
            await apiReviewVerification(item.id, { status });
            refresh();
          } catch (e: any) {
            toast.error('Error', e.message);
          }
        },
      },
    ]);
  };

  const filters: { key: FilterStatus; label: string }[] = [
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'all', label: 'All' },
  ];

  const statusColor = (s: string) => {
    if (s === 'approved') return TG.green;
    if (s === 'rejected') return TG.red;
    return TG.orange;
  };

  const statusBg = (s: string) => {
    if (s === 'approved') return TG.greenLight;
    if (s === 'rejected') return TG.redLight;
    return TG.orangeLight;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Teacher Verification</Text>
      </View>

      <View style={styles.filterRow}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={TG.accent} />
        </View>
      ) : (
        <FlatList
          style={{ flex: 1, backgroundColor: TG.bgSecondary }}
          data={requests || []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(item.user?.fullName || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.user?.fullName || 'Unknown'}</Text>
                  <Text style={styles.username}>@{item.user?.username || '?'}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusBg(item.status) }]}>
                  <Text style={[styles.statusText, { color: statusColor(item.status) }]}>{item.status}</Text>
                </View>
              </View>

              {item.reason && (
                <Text style={styles.reason} numberOfLines={3}>{item.reason}</Text>
              )}

              {item.reviewNote && (
                <Text style={styles.reviewNote}>Note: {item.reviewNote}</Text>
              )}

              {item.status === 'pending' && (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: TG.greenLight }]}
                    onPress={() => handleReview(item, 'approved')}
                    activeOpacity={0.7}
                  >
                    <Check size={16} color={TG.green} />
                    <Text style={[styles.actionBtnText, { color: TG.green }]}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: TG.redLight }]}
                    onPress={() => handleReview(item, 'rejected')}
                    activeOpacity={0.7}
                  >
                    <X size={16} color={TG.red} />
                    <Text style={[styles.actionBtnText, { color: TG.red }]}>Reject</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Shield size={40} color={TG.separator} />
              <Text style={styles.emptyText}>No verification requests</Text>
            </View>
          }
        />
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: TG.bgSecondary },

  filterRow: {
    flexDirection: 'row',
    backgroundColor: TG.bg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: TG.bgSecondary,
  },
  filterChipActive: { backgroundColor: TG.accent },
  filterText: { fontSize: 13, fontWeight: '600', color: TG.textSecondary },
  filterTextActive: { color: TG.textWhite },

  sep: { height: 0.5, backgroundColor: TG.separatorLight },

  card: { backgroundColor: TG.bg, padding: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: TG.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: TG.accent },
  name: { fontSize: 15, fontWeight: '600', color: TG.textPrimary },
  username: { fontSize: 13, color: TG.textSecondary },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },

  reason: { fontSize: 14, color: TG.textPrimary, lineHeight: 20, marginBottom: 6 },
  reviewNote: { fontSize: 13, color: TG.textSecondary, fontStyle: 'italic', marginBottom: 8 },

  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  actionBtnText: { fontSize: 13, fontWeight: '600' },
  emptyText: { color: TG.textSecondary, fontSize: 15 },
});
