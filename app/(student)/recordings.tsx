import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import { apiDeleteSession, apiFetchMySpeaking, TestSession } from '@/lib/api';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Check, ChevronRight, Mic, Star, Trash2, X } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function StudentRecordingsScreen() {
  const router = useRouter();
  const toast = useToast();
  const [responses, setResponses] = useState<TestSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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
      return () => { setSelectMode(false); setSelected(new Set()); };
    }, [loadResponses])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await apiFetchMySpeaking();
      setResponses(result.data || []);
    } catch (e) {
      console.error('Failed to refresh', e);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) setSelectMode(false);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === responses.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(responses.map((r) => r.id)));
    }
  };

  const confirmDelete = () => {
    if (selected.size === 0) return;
    Alert.alert(
      'Delete Recordings',
      `Are you sure you want to delete ${selected.size} recording${selected.size > 1 ? 's' : ''}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: handleDelete },
      ],
    );
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await Promise.all([...selected].map((id) => apiDeleteSession(id)));
      setResponses((prev) => prev.filter((r) => !selected.has(r.id)));
      toast.success('Deleted', `${selected.size} recording${selected.size > 1 ? 's' : ''} deleted`);
    } catch (e: any) {
      toast.error('Error', e.message || 'Failed to delete');
    } finally {
      setDeleting(false);
      exitSelectMode();
    }
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
    const isSelected = selected.has(item.id);

    return (
      <TouchableOpacity
        style={[styles.card, isSelected && styles.cardSelected]}
        activeOpacity={0.7}
        onPress={() => {
          if (selectMode) toggleSelect(item.id);
          else router.push(`/session/${item.id}` as any);
        }}
        onLongPress={() => {
          if (!selectMode) {
            setSelectMode(true);
            setSelected(new Set([item.id]));
          }
        }}
      >
        <View style={styles.cardHeader}>
          {selectMode && (
            <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
              {isSelected && <Check size={14} color={TG.textWhite} strokeWidth={3} />}
            </View>
          )}
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
          {!selectMode && <ChevronRight size={18} color={TG.textHint} />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        {selectMode ? (
          <>
            <TouchableOpacity onPress={exitSelectMode} style={styles.headerBtn} activeOpacity={0.7}>
              <X size={22} color={TG.textWhite} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{selected.size} selected</Text>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={selectAll} style={styles.headerBtn} activeOpacity={0.7}>
              <Text style={styles.headerActionText}>
                {selected.size === responses.length ? 'Deselect All' : 'Select All'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={confirmDelete}
              style={styles.headerBtn}
              activeOpacity={0.7}
              disabled={deleting || selected.size === 0}
            >
              {deleting ? (
                <ActivityIndicator size="small" color={TG.red} />
              ) : (
                <Trash2 size={20} color={selected.size > 0 ? TG.red : TG.textHint} />
              )}
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.headerTitle}>My Recordings</Text>
        )}
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
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[TG.accent]} tintColor={TG.accent} />
          }
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
  header: { backgroundColor: TG.headerBg, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: TG.textWhite },
  headerBtn: { padding: 4 },
  headerActionText: { fontSize: 14, fontWeight: '600', color: TG.textWhite },
  listContent: { paddingBottom: 100 },

  card: { backgroundColor: TG.bg, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: TG.separatorLight },
  cardSelected: { backgroundColor: TG.accentLight },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: TG.textHint,
    justifyContent: 'center', alignItems: 'center',
  },
  checkboxChecked: { backgroundColor: TG.accent, borderColor: TG.accent },
  testTitle: { fontSize: 15, fontWeight: '600', color: TG.textPrimary, marginBottom: 2 },
  meta: { fontSize: 12, color: TG.textHint },
  cefrBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  cefrText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  scorePill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: TG.orangeLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  scoreValue: { fontSize: 13, fontWeight: '700', color: TG.orange },

  emptyContainer: { alignItems: 'center', marginTop: 80, gap: 8 },
  emptyText: { color: TG.textSecondary, fontSize: 16, fontWeight: '600' },
  emptyHint: { color: TG.textHint, fontSize: 14 },
});
