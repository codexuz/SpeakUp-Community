import { apiFetchCourse } from '@/lib/api';
import type { Course, Lesson } from '@/lib/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, BookOpen, Check, Crown, Star } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const SCREEN_WIDTH = Dimensions.get('window').width;

type LessonState = 'completed' | 'current' | 'locked';

const UNIT_COLORS = [
  '#58CC02', // Green
  '#1CB0F6', // Blue
  '#CE82FF', // Purple
  '#FF9600', // Orange
  '#FF4B4B', // Red
  '#00CD9C', // Mint
];

const getDarkColor = (color: string) => {
  switch(color) {
    case '#58CC02': return '#58A700';
    case '#1CB0F6': return '#1899D6';
    case '#CE82FF': return '#A559CE';
    case '#FF9600': return '#CC7A00';
    case '#FF4B4B': return '#EA2B2B';
    case '#00CD9C': return '#00A37A';
    default: return '#CECECE';
  }
};

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

  useEffect(() => { loadCourse(); }, [loadCourse]);

  if (loading || !course) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <ArrowLeft size={24} color="#AFAFAF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Course</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          {loading ? <ActivityIndicator size="large" color="#58CC02" /> : <Text style={styles.emptyText}>Course not found</Text>}
        </View>
      </SafeAreaView>
    );
  }

  let globalCurrentFound = false;
  const processedUnits = (course.units || []).map((unit, uIdx) => {
    const uColor = UNIT_COLORS[uIdx % UNIT_COLORS.length];
    return {
      ...unit,
      uColor,
      lessons: (unit.lessons || []).map((lesson) => {
        let state: LessonState = 'locked';
        if (lesson.completed) {
          state = 'completed';
        } else {
          if (!globalCurrentFound) {
            state = 'current';
            globalCurrentFound = true;
          }
        }
        return { lesson, state };
      })
    };
  });

  const renderLessonNode = (item: { lesson: Lesson, state: LessonState }, idxInUnit: number, uColor: string) => {
    const offsets = [0, 25, 45, 25, 0, -25, -45, -25];
    const offset = offsets[idxInUnit % offsets.length];

    const isLocked = item.state === 'locked';
    const isCurrent = item.state === 'current';
    const isCompleted = item.state === 'completed';

    const nodeColor = isCompleted ? uColor : isCurrent ? uColor : '#E5E5E5';
    const shadowColor = isCompleted ? getDarkColor(uColor) : isCurrent ? getDarkColor(uColor) : '#CECECE';

    return (
      <View key={item.lesson.id} style={[styles.nodeWrapper, { transform: [{ translateX: offset }] }]}>
        {isCurrent && (
          <View style={styles.startTooltip}>
            <Text style={[styles.startTooltipText, { color: uColor }]}>START</Text>
            <View style={styles.startTooltipTail} />
          </View>
        )}
        <TouchableOpacity
          style={styles.nodeTouchable}
          activeOpacity={isLocked ? 1 : 0.8}
          onPress={() => {
            if (!isLocked) router.push(`/lesson/${item.lesson.id}` as any);
          }}
        >
          <View style={[styles.nodeInner, { backgroundColor: nodeColor, borderBottomColor: shadowColor }]}>
            {isCompleted ? (
              <Check size={32} color="#fff" strokeWidth={4} />
            ) : isCurrent ? (
              <Star size={32} color="#fff" fill="#fff" />
            ) : (
              <Crown size={32} color="#CECECE" fill="#CECECE" />
            )}
          </View>
        </TouchableOpacity>
        <Text style={[
          styles.nodeLabel,
          isLocked && styles.nodeLabelLocked,
          isCurrent && { color: uColor, fontWeight: '800' }
        ]} numberOfLines={2}>
          {item.lesson.title}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={24} color="#AFAFAF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{course.title}</Text>
        <View style={[styles.levelPill, { backgroundColor: UNIT_COLORS[0] + '20' }]}>
          <Text style={[styles.levelPillText, { color: UNIT_COLORS[0] }]}>{course.level}</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: '#fff' }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {processedUnits.map((unit, uIdx) => (
          <View key={`unit-${unit.id}`} style={styles.unitSection}>
            {/* Unit Header Block */}
            <View style={[styles.unitHeader, { backgroundColor: unit.uColor }]}>
              <View style={styles.unitHeaderContent}>
                <Text style={styles.unitHeaderTitle}>Unit {uIdx + 1}</Text>
                <Text style={styles.unitHeaderDesc}>{unit.title}</Text>
              </View>
              <TouchableOpacity style={styles.unitGuideBtn} activeOpacity={0.8}>
                <BookOpen size={24} color={unit.uColor} />
                <Text style={[styles.unitGuideText, { color: unit.uColor }]}>Guide</Text>
              </TouchableOpacity>
            </View>

            {/* Path Nodes */}
            <View style={styles.unitPath}>
              {unit.lessons.map((item, lIdx) => renderLessonNode(item, lIdx, unit.uColor))}
            </View>
          </View>
        ))}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#E5E5E5',
    gap: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#4B4B4B', flex: 1, textAlign: 'center' },
  levelPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  levelPillText: { fontSize: 13, fontWeight: '800' },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  emptyText: { fontSize: 16, color: '#AFAFAF', fontWeight: '700' },
  scrollContent: { paddingBottom: 40 },

  // Unit Section
  unitSection: { marginBottom: 20 },
  unitHeader: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 4,
    borderBottomColor: 'rgba(0,0,0,0.15)',
  },
  unitHeaderContent: { flex: 1, paddingRight: 16 },
  unitHeaderTitle: { fontSize: 22, fontWeight: '900', color: '#fff', marginBottom: 4 },
  unitHeaderDesc: { fontSize: 16, fontWeight: '600', color: 'rgba(255,255,255,0.9)', lineHeight: 22 },
  unitGuideBtn: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
    borderBottomColor: '#E5E5E5',
  },
  unitGuideText: { fontSize: 13, fontWeight: '800', marginTop: 4, textTransform: 'uppercase' },

  // Path Nodes
  unitPath: {
    paddingVertical: 32,
    alignItems: 'center',
    width: '100%',
  },
  nodeWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    width: 120,
  },
  nodeTouchable: {
    zIndex: 2,
  },
  nodeInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 6,
  },
  nodeLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4B4B4B',
    marginTop: 12,
    textAlign: 'center',
    width: 140,
  },
  nodeLabelLocked: { color: '#AFAFAF' },

  // Tooltip
  startTooltip: {
    position: 'absolute',
    top: -46,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startTooltipText: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  startTooltipTail: {
    position: 'absolute',
    bottom: -8,
    width: 12,
    height: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: '#E5E5E5',
    transform: [{ rotate: '45deg' }],
  },
});
