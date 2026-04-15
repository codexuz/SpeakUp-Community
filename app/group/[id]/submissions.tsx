import { useAlert } from '@/components/CustomAlert';
import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import { apiPostReview } from '@/lib/api';
import {
    fetchGroupById,
    fetchGroupSubmissions,
    Group,
} from '@/lib/groups';
import { useAuth } from '@/store/auth';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    ArrowLeft,
    Award,
    ChevronRight,
    Star,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function GroupSubmissionsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { alert } = useAlert();

  const [group, setGroup] = useState<Group | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [subPage, setSubPage] = useState(1);
  const [hasMoreSubs, setHasMoreSubs] = useState(true);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [g, sResult] = await Promise.all([
        fetchGroupById(id),
        fetchGroupSubmissions(id, 1),
      ]);
      setGroup(g);
      setSubmissions(sResult?.data || []);
      setHasMoreSubs(1 < (sResult?.pagination?.totalPages ?? 1));
      setSubPage(1);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadMoreSubs = async () => {
    if (!hasMoreSubs || !id) return;
    const next = subPage + 1;
    try {
      const result = await fetchGroupSubmissions(id, next);
      setSubmissions((prev) => [...prev, ...(result?.data || [])]);
      setHasMoreSubs(next < (result?.pagination?.totalPages ?? 1));
      setSubPage(next);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft size={22} color={TG.textWhite} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Submissions</Text>
          <Text style={styles.headerSub}>
            {submissions.length} total
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={TG.accent} />
        </View>
      ) : (
        <FlatList
          data={submissions}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMoreSubs}
          onEndReachedThreshold={0.3}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item: sub }) => (
            <TouchableOpacity
              style={styles.subCard}
              activeOpacity={0.7}
              onPress={() => router.push(`/review/${sub.id}` as any)}
            >
              <View style={styles.subHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{(sub.user?.fullName || '?').charAt(0)}</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <View style={styles.topRow}>
                    <Text style={styles.subStudent} numberOfLines={1}>
                      {sub.user?.fullName || 'Unknown'}
                    </Text>
                    <Text style={styles.dateText}>
                      {new Date(sub.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>

                  <Text style={styles.subQuestion} numberOfLines={2}>
                    {sub.test?.title || 'Unknown Test'}
                  </Text>
                  <Text style={styles.subMeta}>
                    {sub._count?.responses || 0} responses
                    {sub.cefrLevel ? ` · ${sub.cefrLevel}` : ''}
                  </Text>
                </View>

                <View style={styles.subActions}>
                  {sub.scoreAvg != null ? (
                    <View style={styles.scoreBadge}>
                      <Star size={13} color={TG.orange} fill={TG.orange} />
                      <Text style={styles.scoreBadgeText}>
                        {Number(sub.scoreAvg).toFixed(1)}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.pendingBadge}>
                      <Text style={styles.pendingBadgeText}>NEW</Text>
                    </View>
                  )}
                  <ChevronRight size={16} color={TG.textHint} style={{ marginTop: 8 }} />
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Award size={40} color={TG.separator} />
              <Text style={styles.emptyText}>No submissions yet</Text>
            </View>
          }
        />
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TG.bgSecondary },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TG.headerBg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: TG.textWhite },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },

  listContent: { padding: 12, paddingBottom: 40 },
  sep: { height: 10 },

  subCard: {
    backgroundColor: TG.bg,
    borderRadius: 14,
    padding: 14,
    borderWidth: 0.5,
    borderColor: TG.separatorLight,
  },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: TG.accentLight, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 15, fontWeight: '700', color: TG.accent },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  subStudent: {
    fontSize: 15,
    fontWeight: '600',
    color: TG.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  dateText: { fontSize: 11, color: TG.textHint },
  subQuestion: { fontSize: 13, color: TG.textSecondary, lineHeight: 18, marginTop: 2 },
  subMeta: { fontSize: 12, color: TG.textHint, marginTop: 6 },
  subActions: {
    alignItems: 'flex-end',
    gap: 4,
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: TG.orangeLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  scoreBadgeText: { fontSize: 14, fontWeight: '700', color: TG.orange },
  pendingBadge: {
    backgroundColor: TG.accentLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pendingBadgeText: { fontSize: 11, fontWeight: '700', color: TG.accent },
  emptyText: { color: TG.textSecondary, fontSize: 15 },
});
