import { useAlert } from '@/components/CustomAlert';
import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import {
    approveJoinRequest,
    fetchGroupById,
    fetchJoinRequests,
    Group,
    JoinRequest,
    rejectJoinRequest,
} from '@/lib/groups';
import { useAuth } from '@/store/auth';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    ArrowLeft,
    Check,
    Users,
    X,
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

export default function GroupRequestsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { alert } = useAlert();

  const [group, setGroup] = useState<Group | null>(null);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [g, jrs] = await Promise.all([
        fetchGroupById(id),
        fetchJoinRequests(id),
      ]);
      setGroup(g);
      setJoinRequests(jrs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleApprove = async (req: JoinRequest) => {
    try {
      await approveJoinRequest(id!, req.id);
      setJoinRequests((prev) => prev.filter((r) => r.id !== req.id));
    } catch (e: any) {
      toast.error('Error', e.message);
    }
  };

  const handleReject = async (req: JoinRequest) => {
    try {
      await rejectJoinRequest(id!, req.id);
      setJoinRequests((prev) => prev.filter((r) => r.id !== req.id));
    } catch (e: any) {
      toast.error('Error', e.message);
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
          <Text style={styles.headerTitle}>Join Requests</Text>
          <Text style={styles.headerSub}>
            {joinRequests.length} pending
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={TG.accent} />
        </View>
      ) : (
        <FlatList
          style={{ flex: 1, backgroundColor: TG.bg }}
          data={joinRequests}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: req }) => (
            <View style={styles.card}>
              <View style={styles.avatar}>
                {req.user?.avatarUrl ? (
                  <Image source={{ uri: req.user.avatarUrl }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarText}>
                    {(req.user?.fullName || '?').charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{req.user?.fullName}</Text>
                <Text style={styles.username}>@{req.user?.username}</Text>
                {req.message && (
                  <Text style={styles.reqMsg} numberOfLines={2}>
                    {req.message}
                  </Text>
                )}
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={[styles.actionCircle, { backgroundColor: TG.greenLight }]}
                  onPress={() => handleApprove(req)}
                  activeOpacity={0.7}
                >
                  <Check size={18} color={TG.green} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionCircle, { backgroundColor: TG.redLight }]}
                  onPress={() => handleReject(req)}
                  activeOpacity={0.7}
                >
                  <X size={18} color={TG.red} />
                </TouchableOpacity>
              </View>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Users size={40} color={TG.separator} />
              <Text style={styles.emptyText}>No pending requests</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TG.headerBg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: TG.bg },

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

  listContent: { paddingVertical: 6, paddingBottom: 40 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: TG.separator, marginLeft: 74 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: TG.orangeLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImg: { width: 48, height: 48, borderRadius: 24 },
  avatarText: { fontSize: 18, fontWeight: '700', color: TG.orange },
  name: { fontSize: 15, fontWeight: '600', color: TG.textPrimary },
  username: { fontSize: 13, color: TG.textSecondary },
  reqMsg: { fontSize: 13, color: TG.textSecondary, marginTop: 2, fontStyle: 'italic' },

  actionCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },

  emptyText: { color: TG.textSecondary, fontSize: 15 },
});
