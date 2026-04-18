import { apiFetchCourse } from '@/lib/api';
import type { Course, Lesson } from '@/lib/types';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  BookOpen,
  Check,
  FileText,
  Lock,
  Mic,
  PenLine,
  Star,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type LessonState = 'completed' | 'current' | 'locked';

const UNIT_COLORS = [
  '#FF4B4B', // Red / Coral
  '#00CD9C', // Teal / Mint
  '#CE82FF', // Purple
  '#1CB0F6', // Blue
  '#FF9600', // Orange
  '#58CC02', // Green
];

const getDarkColor = (color: string) => {
  switch (color) {
    case '#FF4B4B': return '#CC3D3D';
    case '#00CD9C': return '#00A37A';
    case '#CE82FF': return '#A559CE';
    case '#1CB0F6': return '#1899D6';
    case '#FF9600': return '#CC7A00';
    case '#58CC02': return '#58A700';
    default: return '#CECECE';
  }
};

/* Completed-node colour — clear green so users know it's done */
const COMPLETED_COLOR = '#58CC02';
const COMPLETED_DARK = '#58A700';

/* Icons that cycle on current / locked nodes for variety */
const NODE_ICONS = [
  (sz: number) => <Star size={sz} color="#fff" fill="#fff" />,
  (sz: number) => <FileText size={sz} color="#fff" />,
  (sz: number) => <Mic size={sz} color="#fff" />,
  (sz: number) => <PenLine size={sz} color="#fff" />,
];

/* Zigzag offsets — wider amplitude like the reference */
const ZIGZAG = [0, 40, 70, 40, 0, -40, -70, -40];

/* ── Bounce animation for the current node ── */
function BouncingNode({ children }: { children: React.ReactNode }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: -8, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  return <Animated.View style={{ transform: [{ translateY: anim }] }}>{children}</Animated.View>;
}

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

  /* ── Loading / Empty ── */
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

  /* ── Process units & lessons ── */
  let globalCurrentFound = false;
  let globalLessonIdx = 0;

  const processedUnits = (course.units || []).map((unit, uIdx) => {
    const uColor = UNIT_COLORS[uIdx % UNIT_COLORS.length];
    const lessons = (unit.lessons || []).map((lesson) => {
      const idx = globalLessonIdx++;
      let state: LessonState = 'locked';
      if (lesson.completed) {
        state = 'completed';
      } else if (!globalCurrentFound) {
        state = 'current';
        globalCurrentFound = true;
      }
      return { lesson, state, globalIdx: idx };
    });
    const completedCount = lessons.filter((l) => l.state === 'completed').length;
    return { ...unit, uColor, lessons, completedCount };
  });

  /* ── Render a single lesson node ── */
  const renderNode = (
    item: { lesson: Lesson; state: LessonState; globalIdx: number },
    idxInUnit: number,
    uColor: string,
  ) => {
    const offset = ZIGZAG[idxInUnit % ZIGZAG.length];
    const isLocked = item.state === 'locked';
    const isCurrent = item.state === 'current';
    const isCompleted = item.state === 'completed';

    const bgColor = isCompleted ? COMPLETED_COLOR : isCurrent ? uColor : '#E5E5E5';
    const btmColor = isCompleted ? COMPLETED_DARK : isCurrent ? getDarkColor(uColor) : '#CECECE';

    const variedIcon = NODE_ICONS[item.globalIdx % NODE_ICONS.length];

    const node = (
      <TouchableOpacity
        activeOpacity={isLocked ? 1 : 0.8}
        onPress={() => { if (!isLocked) router.push(`/lesson/${item.lesson.id}` as any); }}
        style={styles.nodeTouchable}
      >
        <View style={[styles.nodeOuter, { backgroundColor: btmColor }]}>
          <View style={[styles.nodeInner, { backgroundColor: bgColor }]}>
            {isCompleted ? (
              <Check size={30} color="#fff" strokeWidth={3.5} />
            ) : isLocked ? (
              <Lock size={26} color="#BFBFBF" />
            ) : (
              variedIcon(30)
            )}
          </View>
        </View>
      </TouchableOpacity>
    );

    return (
      <View key={item.lesson.id} style={[styles.nodeWrapper, { transform: [{ translateX: offset }] }]}>
        {/* START! tooltip for current lesson */}
        {isCurrent && (
          <View style={[styles.tooltip, { borderColor: uColor }]}>
            <Text style={[styles.tooltipText, { color: uColor }]}>START!</Text>
          </View>
        )}
        {isCurrent ? <BouncingNode>{node}</BouncingNode> : node}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* ── Header (kept as-is) ── */}
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
        {processedUnits.length === 0 ? (
          <View style={styles.emptyLessons}>
            <BookOpen size={48} color="#E5E5E5" />
            <Text style={styles.emptyLessonsTitle}>No lessons yet</Text>
            <Text style={styles.emptyLessonsDesc}>Lessons for this course haven't been added yet. Check back soon!</Text>
          </View>
        ) : processedUnits.map((unit, uIdx) => {
          const totalInUnit = unit.lessons.length;
          return (
            <View key={`unit-${unit.id}`} style={styles.unitSection}>
              {/* ── Unit Banner ── */}
              <View style={[styles.unitBanner, { backgroundColor: unit.uColor }]}>
                <View style={styles.unitBannerLeft}>
                  <Text style={styles.unitBannerTitle}>Unit {uIdx + 1}</Text>
                  <Text style={styles.unitBannerDesc} numberOfLines={2}>{unit.title}</Text>
                </View>
              </View>

              {/* ── Zigzag Path ── */}
              <View style={styles.pathContainer}>
                {unit.lessons.map((item, lIdx) => (
                  <React.Fragment key={item.lesson.id}>
                    {renderNode(item, lIdx, unit.uColor)}
                  </React.Fragment>
                ))}
              </View>
            </View>
          );
        })}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ══════════════════════════════════════════════════════════════════
   STYLES
   ══════════════════════════════════════════════════════════════════ */
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },

  /* Header – unchanged */
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
  emptyLessons: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, paddingHorizontal: 40, gap: 12 },
  emptyLessonsTitle: { fontSize: 18, fontWeight: '800', color: '#4B4B4B' },
  emptyLessonsDesc: { fontSize: 14, color: '#AFAFAF', textAlign: 'center', lineHeight: 20 },

  scrollContent: { paddingBottom: 40 },

  /* ── Unit Banner ── */
  unitSection: { marginBottom: 8 },
  unitBanner: {
    marginHorizontal: 0,
    paddingHorizontal: 20,
    paddingVertical: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  unitBannerLeft: { flex: 1, paddingRight: 16 },
  unitBannerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 4,
  },
  unitBannerDesc: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 20,
  },
  /* ── Path Container ── */
  pathContainer: {
    paddingVertical: 28,
    alignItems: 'center',
  },

  /* ── Node Wrapper (zigzag offset applied via transform) ── */
  nodeWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },

  /* ── 3D Coin Node ── */
  nodeTouchable: { zIndex: 2 },
  nodeOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'flex-start',
    alignItems: 'center',
    // Outer acts as the dark "depth" visible at the bottom
  },
  nodeInner: {
    width: 72,
    height: 64,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* ── START! Tooltip ── */
  tooltip: {
    backgroundColor: '#fff',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 2,
    marginBottom: 8,
    zIndex: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  tooltipText: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  tooltipArrow: {
    position: 'absolute',
    bottom: -8,
    alignSelf: 'center',
    left: '50%',
    marginLeft: -7,
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },


});
