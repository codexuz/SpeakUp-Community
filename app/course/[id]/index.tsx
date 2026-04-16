import { TG } from '@/constants/theme';
import { apiFetchCourse } from '@/lib/api';
import type { Course, CourseUnit } from '@/lib/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, BookOpen, Check, ChevronRight, Lock } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCourse = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await apiFetchCourse(id);
      setCourse(data);
    } catch (e) {
      console.error('Failed to load course', e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadCourse();
  }, [loadCourse]);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'A2': return TG.scoreGreen;
      case 'B1': return TG.accent;
      case 'B2': return TG.scoreOrange;
      case 'C1': return TG.achievePurple;
      default: return TG.textSecondary;
    }
  };

  const isLessonUnlocked = (unit: CourseUnit, lessonIndex: number): boolean => {
    if (lessonIndex === 0) return true;
    const prevLesson = unit.lessons[lessonIndex - 1];
    return prevLesson?.completed ?? false;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={TG.headerBg} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft size={22} color={TG.textWhite} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Course</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={TG.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!course) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={TG.headerBg} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft size={22} color={TG.textWhite} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Course</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.emptyText}>Course not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const color = getLevelColor(course.level);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={TG.headerBg} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={22} color={TG.textWhite} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{course.title}</Text>
        <View style={[styles.levelPill, { backgroundColor: color + '20' }]}>
          <Text style={[styles.levelPillText, { color }]}>{course.level}</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: TG.bgSecondary }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Course Progress ────────── */}
        <View style={styles.progressCard}>
          <View style={styles.progressInfo}>
            <Text style={styles.progressTitle}>Progress</Text>
            <Text style={styles.progressSub}>
              {course.completedLessons} of {course.totalLessons} lessons completed
            </Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${course.progressPercent}%`, backgroundColor: color }]} />
          </View>
          <Text style={[styles.progressPercent, { color }]}>{course.progressPercent}%</Text>
        </View>

        {/* ── Units & Lessons ────────── */}
        {course.units?.map((unit, unitIndex) => (
          <View key={unit.id} style={styles.unitCard}>
            <View style={styles.unitHeader}>
              <View style={[styles.unitBadge, { backgroundColor: color + '15' }]}>
                <BookOpen size={16} color={color} />
              </View>
              <Text style={styles.unitTitle}>{unit.title}</Text>
            </View>
            {unit.lessons?.map((lesson, lessonIndex) => {
              const unlocked = isLessonUnlocked(unit, lessonIndex);
              return (
                <TouchableOpacity
                  key={lesson.id}
                  style={[styles.lessonRow, !unlocked && styles.lessonLocked]}
                  activeOpacity={unlocked ? 0.7 : 1}
                  onPress={() => {
                    if (unlocked) {
                      router.push(`/lesson/${lesson.id}` as any);
                    }
                  }}
                >
                  <View style={styles.lessonStatusIcon}>
                    {lesson.completed ? (
                      <View style={[styles.checkCircle, { backgroundColor: TG.scoreGreen }]}>
                        <Check size={14} color="#fff" />
                      </View>
                    ) : unlocked ? (
                      <View style={[styles.checkCircle, { backgroundColor: color, opacity: 0.3 }]}>
                        <BookOpen size={14} color="#fff" />
                      </View>
                    ) : (
                      <View style={[styles.checkCircle, { backgroundColor: TG.bgSecondary }]}>
                        <Lock size={14} color={TG.textHint} />
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.lessonTitle, !unlocked && styles.lessonTitleLocked]}>
                      {lesson.title}
                    </Text>
                    {lesson.completed && lesson.score != null && (
                      <Text style={styles.lessonScore}>Score: {lesson.score} · +{lesson.xpEarned} XP</Text>
                    )}
                    {!lesson.completed && unlocked && (
                      <Text style={[styles.lessonScore, { color }]}>+{lesson.xpReward} XP</Text>
                    )}
                  </View>
                  {unlocked && !lesson.completed && <ChevronRight size={18} color={TG.textHint} />}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
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
    gap: 12,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: TG.textWhite, flex: 1 },
  levelPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  levelPillText: { fontSize: 12, fontWeight: '700' },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: TG.bgSecondary },
  emptyText: { fontSize: 15, color: TG.textSecondary },
  scrollContent: { paddingBottom: 100 },

  // Progress
  progressCard: {
    backgroundColor: TG.bg,
    margin: 14,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  progressInfo: { marginBottom: 10 },
  progressTitle: { fontSize: 16, fontWeight: '700', color: TG.textPrimary },
  progressSub: { fontSize: 13, color: TG.textSecondary, marginTop: 2 },
  progressBarBg: { height: 8, backgroundColor: TG.bgSecondary, borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: 8, borderRadius: 4 },
  progressPercent: { fontSize: 13, fontWeight: '700', marginTop: 6, textAlign: 'right' },

  // Unit
  unitCard: {
    backgroundColor: TG.bg,
    marginHorizontal: 14,
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  unitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: TG.separatorLight,
  },
  unitBadge: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  unitTitle: { fontSize: 15, fontWeight: '700', color: TG.textPrimary, flex: 1 },

  // Lesson
  lessonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: TG.separatorLight,
  },
  lessonLocked: { opacity: 0.5 },
  lessonStatusIcon: {},
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lessonTitle: { fontSize: 14, fontWeight: '600', color: TG.textPrimary },
  lessonTitleLocked: { color: TG.textHint },
  lessonScore: { fontSize: 12, color: TG.textSecondary, marginTop: 2 },
});
