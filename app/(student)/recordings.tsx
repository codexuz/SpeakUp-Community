import { TG } from '@/constants/theme';
import { apiDeleteSpeaking, apiFetchMySpeaking } from '@/lib/api';
import { useFocusEffect } from '@react-navigation/native';
import { Mic, Play, Square, Star, Trash2 } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function StudentRecordingsScreen() {
  const [responses, setResponses] = useState<any[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadResponses = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiFetchMySpeaking();
      setResponses(result.data || []);
    } catch (e) {
      console.error('Failed to load responses', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadResponses();
    }, [loadResponses])
  );

  const handleDelete = async (item: any) => {
    Alert.alert('Delete', 'Remove this recording?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await apiDeleteSpeaking(item.id);
          } catch {}
          loadResponses();
        }
      }
    ]);
  };

  const handlePlay = (item: any) => {
    if (playingId === (item.id?.toString())) {
      setPlayingId(null);
      return;
    }
    setPlayingId(item.id?.toString());
    const uri = item.remoteUrl;
    console.log('Playing', uri);
  };

  const cefrBadge = (level: string | null) => {
    if (!level) return null;
    const colorMap: Record<string, string> = { A2: TG.orange, B1: TG.accent, B2: TG.green, C1: TG.purple };
    const bgMap: Record<string, string> = { A2: TG.orangeLight, B1: TG.accentLight, B2: TG.greenLight, C1: TG.purpleLight };
    return (
      <View style={[styles.cefrBadge, { backgroundColor: bgMap[level] || TG.accentLight }]}>
        <Text style={[styles.cefrText, { color: colorMap[level] || TG.accent }]}>{level}</Text>
      </View>
    );
  };

  const renderItem = ({ item }: { item: any }) => {
    const testTitle = item.test?.title || 'Unknown Test';
    const responseCount = item._count?.responses || 0;
    const isPlaying = playingId === (item.id?.toString());

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.testTitle}>{testTitle}</Text>
            <Text style={styles.meta}>{responseCount} response{responseCount !== 1 ? 's' : ''} · {new Date(item.createdAt).toLocaleDateString()}</Text>
          </View>
          {cefrBadge(item.cefrLevel)}
          {item.scoreAvg != null && (
            <View style={styles.scorePill}>
              <Star size={12} color={TG.orange} fill={TG.orange} />
              <Text style={styles.scoreValue}>{item.scoreAvg.toFixed(0)}/75</Text>
            </View>
          )}
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.playBtn, isPlaying && styles.playBtnActive]}
            activeOpacity={0.7}
            onPress={() => handlePlay(item)}
          >
            {isPlaying ? <Square size={16} color={TG.textWhite} /> : <Play size={16} color={TG.textWhite} fill={TG.textWhite} />}
            <Text style={styles.playBtnText}>{isPlaying ? 'Stop' : 'Play'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} activeOpacity={0.7} onPress={() => handleDelete(item)}>
            <Trash2 size={18} color={TG.red} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Recordings</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={TG.accent} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={responses}
          keyExtractor={(item, i) => item.id?.toString() || i.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Mic size={48} color={TG.separator} />
              <Text style={styles.emptyText}>No recordings yet</Text>
              <Text style={styles.emptyHint}>Take a test to start recording</Text>
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

  card: { backgroundColor: TG.bg, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: TG.separatorLight },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  testTitle: { fontSize: 15, fontWeight: '600', color: TG.textPrimary, marginBottom: 2 },
  meta: { fontSize: 12, color: TG.textHint },
  cefrBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  cefrText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  scorePill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: TG.orangeLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  scoreValue: { fontSize: 13, fontWeight: '700', color: TG.orange },

  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  playBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: TG.accent, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16 },
  playBtnActive: { backgroundColor: TG.red },
  playBtnText: { fontSize: 13, fontWeight: '600', color: TG.textWhite },
  deleteBtn: { marginLeft: 'auto', padding: 8 },

  emptyContainer: { alignItems: 'center', marginTop: 80, gap: 8 },
  emptyText: { color: TG.textSecondary, fontSize: 16, fontWeight: '600' },
  emptyHint: { color: TG.textHint, fontSize: 14 },
});
