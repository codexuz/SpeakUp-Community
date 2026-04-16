import { TG } from '@/constants/theme';
import { apiFetchCourses } from '@/lib/api';
import type { Course } from '@/lib/types';
import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowLeft, BookOpen, ChevronRight } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const LEVELS = ['All', 'A2', 'B1', 'B2', 'C1'];

export default function CoursesScreen() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState('All');

  const loadCourses = async () => {
    try {
      const level = selectedLevel === 'All' ? undefined : selectedLevel;
      const res = await apiFetchCourses(level);
      setCourses(res.data || []);
    } catch (e) {
      console.error('Failed to load courses', e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadCourses();
    }, [selectedLevel]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCourses();
    setRefreshing(false);
  }, [selectedLevel]);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'A2': return TG.scoreGreen;
      case 'B1': return TG.accent;
      case 'B2': return TG.scoreOrange;
      case 'C1': return TG.achievePurple;
      default: return TG.textSecondary;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={TG.headerBg} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={22} color={TG.textWhite} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Courses</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* ── Level Filter ──────────── */}
      <View style={styles.filterRow}>
        {LEVELS.map((level) => (
          <TouchableOpacity
            key={level}
            style={[
              styles.filterChip,
              selectedLevel === level && styles.filterChipActive,
              selectedLevel === level && level !== 'All' && { backgroundColor: getLevelColor(level) + '20' },
            ]}
            onPress={() => setSelectedLevel(level)}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedLevel === level && styles.filterChipTextActive,
                selectedLevel === level && level !== 'All' && { color: getLevelColor(level) },
              ]}
            >
              {level}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={TG.accent} />
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1, backgroundColor: TG.bgSecondary }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TG.accent} />}
        >
          {courses.length === 0 ? (
            <Text style={styles.emptyText}>No courses available for this level.</Text>
          ) : (
            courses.map((course) => (
              <TouchableOpacity
                key={course.id}
                style={styles.courseCard}
                activeOpacity={0.7}
                onPress={() => router.push(`/course/${course.id}` as any)}
              >
                <View style={styles.courseTop}>
                  <View style={[styles.courseIcon, { backgroundColor: getLevelColor(course.level) + '15' }]}>
                    <BookOpen size={24} color={getLevelColor(course.level)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.courseTitleRow}>
                      <Text style={styles.courseTitle} numberOfLines={1}>{course.title}</Text>
                      <ChevronRight size={18} color={TG.textHint} />
                    </View>
                    <View style={styles.courseMetaRow}>
                      <View style={[styles.levelPill, { backgroundColor: getLevelColor(course.level) + '20' }]}>
                        <Text style={[styles.levelPillText, { color: getLevelColor(course.level) }]}>{course.level}</Text>
                      </View>
                      <Text style={styles.courseLessonCount}>
                        {course.completedLessons}/{course.totalLessons} lessons
                      </Text>
                    </View>
                  </View>
                </View>
                {course.description ? (
                  <Text style={styles.courseDesc} numberOfLines={2}>{course.description}</Text>
                ) : null}
                <View style={styles.progressBarContainer}>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${course.progressPercent}%`,
                          backgroundColor: getLevelColor(course.level),
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressPercent}>{course.progressPercent}%</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
          <View style={{ height: 30 }} />
        </ScrollView>
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
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: TG.textWhite },

  filterRow: {
    flexDirection: 'row',
    backgroundColor: TG.bg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: TG.separator,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: TG.bgSecondary,
  },
  filterChipActive: { backgroundColor: TG.accentLight },
  filterChipText: { fontSize: 13, fontWeight: '600', color: TG.textSecondary },
  filterChipTextActive: { color: TG.accent },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: TG.bgSecondary },
  listContent: { padding: 14, gap: 12, paddingBottom: 100 },
  emptyText: { color: TG.textSecondary, textAlign: 'center', paddingVertical: 40, fontSize: 15 },

  // Course Card
  courseCard: {
    backgroundColor: TG.bg,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  courseTop: { flexDirection: 'row', gap: 14, marginBottom: 8 },
  courseIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  courseTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  courseTitle: { fontSize: 16, fontWeight: '700', color: TG.textPrimary, flex: 1, marginRight: 8 },
  courseMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  levelPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  levelPillText: { fontSize: 11, fontWeight: '700' },
  courseLessonCount: { fontSize: 12, color: TG.textSecondary },
  courseDesc: { fontSize: 13, color: TG.textSecondary, lineHeight: 19, marginBottom: 10 },

  progressBarContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: TG.bgSecondary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: { height: 6, borderRadius: 3 },
  progressPercent: { fontSize: 12, fontWeight: '700', color: TG.textSecondary, width: 35, textAlign: 'right' },
});
