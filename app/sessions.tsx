import { useAlert } from '@/components/CustomAlert';
import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import { apiFetchSessions, apiRevokeAllSessions, apiRevokeSession, AuthSessionItem } from '@/lib/api';
import { useRouter } from 'expo-router';
import { ArrowLeft, Monitor, Smartphone, Trash2 } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

function DeviceIcon({ device }: { device: string }) {
  const lower = device.toLowerCase();
  if (lower.includes('web') || lower.includes('postman') || lower.includes('windows') || lower.includes('mac')) {
    return <Monitor size={28} color={TG.accent} />;
  }
  return <Smartphone size={28} color={TG.accent} />;
}

function SessionRow({
  session,
  onRevoke,
}: {
  session: AuthSessionItem;
  onRevoke: (id: string) => void;
}) {
  return (
    <View style={[styles.row, session.current && styles.currentRow]}>
      <DeviceIcon device={session.device} />
      <View style={styles.rowContent}>
        <View style={styles.rowTop}>
          <Text style={styles.device} numberOfLines={1}>
            {session.device}
          </Text>
          {session.current && (
            <View style={styles.currentBadge}>
              <Text style={styles.currentBadgeText}>This device</Text>
            </View>
          )}
        </View>
        <Text style={styles.meta}>
          {session.ip} · Active {formatDate(session.lastActiveAt)}
        </Text>
      </View>
      {!session.current && (
        <TouchableOpacity
          onPress={() => onRevoke(session.sessionId)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.6}>
          <Trash2 size={18} color={TG.red} />
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function SessionsScreen() {
  const router = useRouter();
  const toast = useToast();
  const { alert } = useAlert();
  const [sessions, setSessions] = useState<AuthSessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiFetchSessions();
      // sort: current first, then by lastActiveAt desc
      data.sessions.sort((a, b) => {
        if (a.current !== b.current) return a.current ? -1 : 1;
        return new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime();
      });
      setSessions(data.sessions);
    } catch {
      toast.error('Error', 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRevoke = useCallback(
    (sessionId: string) => {
      alert('Terminate Session', 'This will log out that device. Continue?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Terminate',
          style: 'destructive',
          onPress: async () => {
            try {
              setRevoking(sessionId);
              await apiRevokeSession(sessionId);
              setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
            } catch {
              toast.error('Error', 'Failed to revoke session');
            } finally {
              setRevoking(null);
            }
          },
        },
      ], 'destructive');
    },
    [],
  );

  const handleRevokeAll = useCallback(() => {
    alert(
      'Terminate All Other Sessions',
      'This will log out all other devices. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Terminate All',
          style: 'destructive',
          onPress: async () => {
            try {
              setRevoking('all');
              await apiRevokeAllSessions();
              setSessions((prev) => prev.filter((s) => s.current));
            } catch {
              toast.error('Error', 'Failed to revoke sessions');
            } finally {
              setRevoking(null);
            }
          },
        },
      ],
      'destructive',
    );
  }, []);

  const otherCount = sessions.filter((s) => !s.current).length;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <ArrowLeft size={22} color={TG.textWhite} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Active Sessions</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={TG.accent} />
        </View>
      ) : (
        <FlatList
          style={{ flex: 1, backgroundColor: TG.bgSecondary }}
          data={sessions}
          keyExtractor={(item) => item.sessionId}
          renderItem={({ item }) => (
            <SessionRow
              session={item}
              onRevoke={handleRevoke}
            />
          )}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <Text style={styles.sectionHint}>
              {sessions.length} active session{sessions.length !== 1 ? 's' : ''}
            </Text>
          }
          ListFooterComponent={
            otherCount > 0 ? (
              <TouchableOpacity
                style={styles.terminateAllBtn}
                onPress={handleRevokeAll}
                activeOpacity={0.7}
                disabled={revoking === 'all'}>
                {revoking === 'all' ? (
                  <ActivityIndicator size="small" color={TG.red} />
                ) : (
                  <Text style={styles.terminateAllText}>Terminate All Other Sessions</Text>
                )}
              </TouchableOpacity>
            ) : null
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: TG.textWhite, flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: TG.bgSecondary },
  list: { paddingBottom: 40 },
  sectionHint: {
    fontSize: 13,
    color: TG.textSecondary,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TG.bg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  currentRow: {
    backgroundColor: TG.accentLight,
  },
  rowContent: { flex: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  device: { fontSize: 15, fontWeight: '600', color: TG.textPrimary, flexShrink: 1 },
  currentBadge: {
    backgroundColor: TG.green,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  currentBadgeText: { fontSize: 11, fontWeight: '600', color: '#fff' },
  meta: { fontSize: 13, color: TG.textSecondary },
  separator: { height: 0.5, backgroundColor: TG.separatorLight, marginLeft: 58 },
  terminateAllBtn: {
    marginTop: 20,
    marginHorizontal: 16,
    backgroundColor: TG.redLight,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  terminateAllText: { fontSize: 15, fontWeight: '600', color: TG.red },
});
