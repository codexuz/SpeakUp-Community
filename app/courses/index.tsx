import { TG } from '@/constants/theme';
import { apiFetchCourses } from '@/lib/api';
import type { Course } from '@/lib/types';
import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowLeft, CheckCircle2 } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const LEVEL_COLORS: Record<string, { bg: string; dark: string }> = {
  'A1':           { bg: '#58CC02', dark: '#4CAD02' },
  'A2':           { bg: '#1CB0F6', dark: '#1899D6' },
  'B1':           { bg: '#FF9600', dark: '#E08600' },
  'B2':           { bg: '#CE82FF', dark: '#B56AE8' },
  'C1':           { bg: '#FF4B4B', dark: '#E04343' },
  'C2':           { bg: '#2B70C9', dark: '#2460B0' },
  'Beginner':     { bg: '#58CC02', dark: '#4CAD02' },
  'Elementary':   { bg: '#1CB0F6', dark: '#1899D6' },
  'Intermediate': { bg: '#FF9600', dark: '#E08600' },
  'Advanced':     { bg: '#CE82FF', dark: '#B56AE8' },
};

export default function CoursesScreen() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadCourses = async () => {
    try {
      const res = await apiFetchCourses();
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
    }, []),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCourses();
    setRefreshing(false);
  }, []);

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
            <Text style={styles.emptyText}>No courses available.</Text>
          ) : (
            <View style={styles.grid}>
              {courses.map((course) => {
                const pct = Math.min(course.progressPercent, 100);
                const isComplete = pct >= 100;
                const c = LEVEL_COLORS[course.level] || { bg: '#1E90FF', dark: '#1873CC' };

                return (
                  <TouchableOpacity
                    key={course.id}
                    activeOpacity={0.85}
                    onPress={() => router.push(`/course/${course.id}` as any)}
                    style={styles.courseCard}
                  >
                    <View style={[styles.courseCardInner, { backgroundColor: c.bg }]}>
                      <View style={[styles.courseCardDepth, { backgroundColor: c.dark }]} />
                      <View style={styles.courseContent}>
                        <View style={styles.courseTopRow}>
                          <View style={styles.courseLevelPill}>
                            <Text style={styles.courseLevelText}>{course.level}</Text>
                          </View>
                          {isComplete && <CheckCircle2 size={18} color="#fff" />}
                        </View>
                        <Text style={styles.courseTitle} numberOfLines={2}>{course.title}</Text>
                        <View style={styles.courseBottomRow}>
                          <Text style={styles.courseLessonsText}>
                            {course.completedLessons}/{course.totalLessons} lessons
                          </Text>
                          <View style={styles.courseProgressPill}>
                            <View style={styles.courseProgressBarBg}>
                              <View style={[styles.courseProgressBarFill, { width: `${Math.max(pct, 4)}%` as any }]} />
                            </View>
                          </View>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
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

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: TG.bgSecondary },
  listContent: { padding: 14, paddingBottom: 100 },
  emptyText: { color: TG.textSecondary, textAlign: 'center', paddingVertical: 40, fontSize: 15 },

  grid: {
    gap: 12,
  },
  courseCard: {
    width: '100%',
  },
  courseCardInner: {
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    paddingBottom: 6,
  },
  courseCardDepth: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 6,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  courseContent: {
    padding: 16,
    paddingBottom: 14,
  },
  courseTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  courseLevelPill: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  courseLevelText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  courseTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#fff',
    lineHeight: 21,
    marginBottom: 16,
    minHeight: 42,
  },
  courseBottomRow: {
    gap: 8,
  },
  courseLessonsText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
  },
  courseProgressPill: {
    marginTop: 2,
  },
  courseProgressBarBg: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  courseProgressBarFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#fff',
  },
});
