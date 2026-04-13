import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import { apiFetchPendingSpeaking, TestSession } from '@/lib/api';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { ChevronRight, Mic, Star } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TeacherReviewsScreen() {
  const toast = useToast();
  const router = useRouter();
  const [sessions, setSessions] = useState<TestSession[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiFetchPendingSpeaking();
      setSessions(result.data || []);
    } catch (e: any) {
      toast.error('Error', e.message || 'Failed to load pending reviews');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSessions();
    }, [loadSessions])
  );

  const renderItem = ({ item }: { item: TestSession }) => {
    const testTitle = item.test?.title || 'Unknown Test';
    const responseCount = item._count?.responses || 0;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => router.push(`/review/${item.id}` as any)}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(item.user?.fullName || '?').charAt(0)}</Text>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.topRow}>
            <Text style={styles.studentName} numberOfLines={1}>{item.user?.fullName || 'Student'}</Text>
            <Text style={styles.dateText}>{new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
          </View>
          <Text style={styles.testTitle} numberOfLines={1}>{testTitle}</Text>
          <View style={styles.bottomRow}>
            {item.scoreAvg != null && (
              <>
                <Star size={11} color={TG.orange} fill={TG.orange} />
                <Text style={styles.scoreText}>{item.scoreAvg.toFixed(0)}</Text>
              </>
            )}
          </View>
        </View>
        <ChevronRight size={16} color={TG.textHint} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pending Reviews</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={TG.accent} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Mic size={48} color={TG.separator} />
              <Text style={styles.emptyText}>No pending submissions</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TG.bgSecondary },
  header: { backgroundColor: TG.headerBg, paddingHorizontal: 16, paddingVertical: 14 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: TG.textWhite },
  listContent: { paddingBottom: 100 },

  card: {
    backgroundColor: TG.bg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: TG.separatorLight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: TG.accentLight, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 15, fontWeight: '700', color: TG.accent },
  cardBody: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  studentName: { fontSize: 14, fontWeight: '600', color: TG.textPrimary, flex: 1, marginRight: 8 },
  dateText: { fontSize: 11, color: TG.textHint },
  testTitle: { fontSize: 13, color: TG.textSecondary, marginBottom: 4 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, color: TG.textHint, marginRight: 6 },
  scoreText: { fontSize: 11, fontWeight: '700', color: TG.orange },

  emptyContainer: { alignItems: 'center', marginTop: 80, gap: 12 },
  emptyText: { color: TG.textSecondary, fontSize: 15 },
});
