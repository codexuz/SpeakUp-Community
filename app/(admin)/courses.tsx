import { useAlert } from '@/components/CustomAlert';
import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import { useDatabase } from '@/expo-local-db/DatabaseProvider';
import { useOfflineCache } from '@/expo-local-db/hooks/useOfflineCache';
import { apiDeleteCourse, apiFetchAdminCourses } from '@/lib/api';
import { Course } from '@/lib/types';
import { useRouter } from 'expo-router';
import { BookOpen, ChevronRight, Plus, Trash2 } from 'lucide-react-native';
import React from 'react';
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

export default function AdminCoursesScreen() {
  const router = useRouter();
  const toast = useToast();
  const { alert } = useAlert();
  const { isReady } = useDatabase();

  // Offline-first: cache admin courses
  const { data: cachedResult, isLoading: loading, refresh } = useOfflineCache<{ data: Course[] }>({
    cacheKey: 'admin_courses',
    apiFn: () => apiFetchAdminCourses(),
    enabled: isReady,
    staleTime: 60_000,
  });

  const courses = cachedResult?.data || [];

  const handleDelete = (course: Course) => {
    alert(
      'Delete Course?',
      `Are you sure you want to delete "${course.title}"? This will permanently delete all its units, lessons, and exercises.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiDeleteCourse(course.id);
              toast.success('Deleted', 'Course has been deleted.');
              refresh();
            } catch (e: any) {
              toast.error('Error', e.message);
            }
          },
        },
      ],
      'destructive'
    );
  };

  const renderItem = ({ item }: { item: Course }) => {
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => router.push(`/admin/courses/${item.id}` as any)}
      >
        <View style={styles.cardInfo}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.courseImage} />
          ) : (
            <View style={[styles.courseImage, styles.placeholderImage]}>
              <BookOpen size={24} color={TG.accent} />
            </View>
          )}
          <View style={styles.cardText}>
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
              <View style={styles.levelBadge}>
                <Text style={styles.levelBadgeText}>{item.level}</Text>
              </View>
            </View>
            <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>{item.totalLessons || 0} Lessons</Text>
              <Text style={styles.metaText}> • </Text>
              <Text style={[styles.metaText, { color: item.isPublished ? TG.green : TG.textHint }]}>
                {item.isPublished ? 'Published' : 'Draft'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.actionBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={() => handleDelete(item)}
          >
            <Trash2 size={18} color={TG.red} />
          </TouchableOpacity>
          <ChevronRight size={20} color={TG.textHint} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Manage Courses</Text>
        <TouchableOpacity
          onPress={() => router.push('/admin/courses/create' as any)}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Plus size={24} color={TG.textWhite} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={TG.accent} />
        </View>
      ) : (
        <FlatList
          data={courses}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <BookOpen size={48} color={TG.separator} />
              <Text style={styles.emptyTitle}>No Courses Yet</Text>
              <Text style={styles.emptyDesc}>Create a course to start adding structured lessons.</Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => router.push('/admin/courses/create' as any)}
                activeOpacity={0.8}
              >
                <Plus size={18} color="#fff" />
                <Text style={styles.emptyBtnText}>Create Course</Text>
              </TouchableOpacity>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: TG.headerBg,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: TG.textWhite },
  
  listContent: { padding: 16, paddingBottom: 100, backgroundColor: TG.bgSecondary, flexGrow: 1 },
  
  card: {
    backgroundColor: TG.bg,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: TG.separator,
  },
  cardInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  courseImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: TG.bgSecondary,
  },
  placeholderImage: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TG.accentLight,
  },
  cardText: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  title: { fontSize: 16, fontWeight: '700', color: TG.textPrimary, flexShrink: 1 },
  levelBadge: { backgroundColor: TG.accentLight, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  levelBadgeText: { color: TG.accent, fontSize: 10, fontWeight: '800' },
  description: { fontSize: 13, color: TG.textSecondary, marginBottom: 6, lineHeight: 18 },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  metaText: { fontSize: 12, color: TG.textHint },
  
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginLeft: 12 },
  actionBtn: { padding: 6, backgroundColor: 'rgba(244, 67, 54, 0.1)', borderRadius: 8 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: TG.bgSecondary },
  
  emptyWrap: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: TG.textPrimary, marginBottom: 8, marginTop: 16 },
  emptyDesc: { fontSize: 14, color: TG.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: TG.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
