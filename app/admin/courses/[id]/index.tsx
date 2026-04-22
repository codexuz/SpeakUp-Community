import { useAlert } from '@/components/CustomAlert';
import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import {
  apiCreateCourseUnit,
  apiCreateLessonAdmin,
  apiDeleteCourseUnit,
  apiDeleteLessonAdmin,
  apiFetchCourse,
  apiUpdateCourse,
  apiUpdateCourseUnit,
} from '@/lib/api';
import { Course, CourseUnit, Lesson, LessonType } from '@/lib/types';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Edit3, Eye, EyeOff, Image as ImageIcon, Plus, Trash2, X } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CourseBuilderScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const toast = useToast();
  const { alert } = useAlert();

  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);

  // Unit Modal
  const [unitModalVisible, setUnitModalVisible] = useState(false);
  const [editUnitId, setEditUnitId] = useState<string | null>(null);
  const [unitTitle, setUnitTitle] = useState('');
  const [submittingUnit, setSubmittingUnit] = useState(false);

  // Lesson Modal
  const [lessonModalVisible, setLessonModalVisible] = useState(false);
  const [activeUnitId, setActiveUnitId] = useState<string | null>(null);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonType, setLessonType] = useState<LessonType>('practice');
  const [submittingLesson, setSubmittingLesson] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetchCourse(String(id));
      setCourse(data);
    } catch (e: any) {
      toast.error('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const togglePublish = async () => {
    if (!course) return;
    try {
      await apiUpdateCourse(course.id, { isPublished: !course.isPublished });
      setCourse({ ...course, isPublished: !course.isPublished });
      toast.success('Done', course.isPublished ? 'Course unpublished' : 'Course published');
    } catch (e: any) {
      toast.error('Error', e.message);
    }
  };

  // --- UNIT ACTIONS ---
  const openAddUnit = () => {
    setEditUnitId(null);
    setUnitTitle('');
    setUnitModalVisible(true);
  };
  const openEditUnit = (unit: CourseUnit) => {
    setEditUnitId(unit.id);
    setUnitTitle(unit.title);
    setUnitModalVisible(true);
  };
  const handleSaveUnit = async () => {
    if (!unitTitle.trim() || !course) return;
    setSubmittingUnit(true);
    try {
      if (editUnitId) {
        await apiUpdateCourseUnit(editUnitId, { title: unitTitle.trim() });
        toast.success('Done', 'Unit updated');
      } else {
        await apiCreateCourseUnit({ courseId: course.id, title: unitTitle.trim() });
        toast.success('Done', 'Unit added');
      }
      setUnitModalVisible(false);
      load();
    } catch (e: any) {
      toast.error('Error', e.message);
    } finally {
      setSubmittingUnit(false);
    }
  };
  const handleDeleteUnit = (unit: CourseUnit) => {
    alert('Delete Unit', `Delete "${unit.title}" and all its lessons?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiDeleteCourseUnit(unit.id);
            load();
          } catch (e: any) {
            toast.error('Error', e.message);
          }
        },
      },
    ], 'destructive');
  };

  // --- LESSON ACTIONS ---
  const openAddLesson = (unitId: string) => {
    setActiveUnitId(unitId);
    setLessonTitle('');
    setLessonType('practice');
    setLessonModalVisible(true);
  };
  const handleSaveLesson = async () => {
    if (!lessonTitle.trim() || !activeUnitId) return;
    setSubmittingLesson(true);
    try {
      await apiCreateLessonAdmin({ unitId: activeUnitId, title: lessonTitle.trim(), type: lessonType, xpReward: 10 });
      toast.success('Done', 'Lesson added');
      setLessonModalVisible(false);
      load();
    } catch (e: any) {
      toast.error('Error', e.message);
    } finally {
      setSubmittingLesson(false);
    }
  };
  const handleDeleteLesson = (lesson: Lesson) => {
    alert('Delete Lesson', `Delete "${lesson.title}" and all its exercises?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiDeleteLessonAdmin(lesson.id);
            load();
          } catch (e: any) {
            toast.error('Error', e.message);
          }
        },
      },
    ], 'destructive');
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: TG.headerBg }}>
        <SafeAreaView style={{backgroundColor: TG.bgSecondary, flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={TG.accent} />
        </SafeAreaView>
      </View>
    );
  }

  if (!course) {
    return (
      <SafeAreaView style={{backgroundColor: TG.bgSecondary, flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={styles.errorText}>Course not found</Text>
        <TouchableOpacity style={styles.backBtnModal} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const renderHeader = () => (
    <View style={styles.courseHeader}>
      {course.imageUrl ? (
        <Image source={{ uri: course.imageUrl }} style={styles.headerImage} />
      ) : (
        <View style={[styles.headerImage, styles.placeholderImage]}>
          <ImageIcon size={32} color={TG.textHint} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={2}>{course.title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <View style={styles.badge}><Text style={styles.badgeText}>{course.level}</Text></View>
          <Text style={styles.lessonsCount}>{course.totalLessons} total lessons</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ArrowLeft size={22} color={TG.textWhite} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Course Builder</Text>
        <View style={styles.topActions}>
          <TouchableOpacity onPress={() => router.push(`/admin/courses/${course.id}/edit` as any)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={styles.editBtn}>
            <Edit3 size={18} color={TG.textWhite} />
          </TouchableOpacity>
          <TouchableOpacity onPress={togglePublish} style={styles.publishBtn}>
            {course.isPublished ? <EyeOff size={16} color={TG.textWhite} /> : <Eye size={16} color={TG.textWhite} />}
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={styles.contentWrap}
        ListHeaderComponent={renderHeader}
        data={course.units || []}
        keyExtractor={(u) => String(u.id)}
        renderItem={({ item: unit }) => (
          <View style={styles.unitCard}>
            <View style={styles.unitHeader}>
              <Text style={styles.unitTitle}>{unit.title}</Text>
              <View style={styles.unitActions}>
                <TouchableOpacity onPress={() => openEditUnit(unit)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Edit3 size={16} color={TG.textHint} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteUnit(unit)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Trash2 size={16} color={TG.red} />
                </TouchableOpacity>
              </View>
            </View>

            {unit.lessons?.map((lesson) => (
              <TouchableOpacity
                key={lesson.id}
                style={styles.lessonItem}
                activeOpacity={0.7}
                onPress={() => router.push(`/admin/courses/lessons/${lesson.id}` as any)}
              >
                <View style={styles.lessonDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.lessonTitle}>{lesson.title}</Text>
                  {lesson.type && lesson.type !== 'practice' && (
                    <Text style={styles.lessonTypeBadge}>
                      {lesson.type === 'lecture' ? '📖 Lecture' : '📖🏋️ Mixed'}
                    </Text>
                  )}
                </View>
                <TouchableOpacity onPress={() => handleDeleteLesson(lesson)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <X size={16} color={TG.textHint} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={styles.addLessonBtn} onPress={() => openAddLesson(unit.id)} activeOpacity={0.7}>
              <Plus size={16} color={TG.accent} />
              <Text style={styles.addLessonText}>Add Lesson</Text>
            </TouchableOpacity>
          </View>
        )}
        ListFooterComponent={
          <TouchableOpacity style={styles.addUnitBtn} onPress={openAddUnit} activeOpacity={0.7}>
            <Plus size={20} color={TG.textWhite} />
            <Text style={styles.addUnitText}>Add New Unit</Text>
          </TouchableOpacity>
        }
      />

      {/* Unit Modal */}
      <Modal visible={unitModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editUnitId ? 'Edit Unit' : 'New Unit'}</Text>
            <TextInput
              style={styles.modalInput}
              value={unitTitle}
              onChangeText={setUnitTitle}
              placeholder="e.g. Unit 1: Greetings"
              placeholderTextColor={TG.textHint}
              autoFocus
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setUnitModalVisible(false)}>
                <Text style={styles.btnTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnSave} onPress={handleSaveUnit} disabled={submittingUnit || !unitTitle.trim()}>
                {submittingUnit ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnTextSave}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Lesson Modal */}
      <Modal visible={lessonModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Lesson</Text>
            <TextInput
              style={styles.modalInput}
              value={lessonTitle}
              onChangeText={setLessonTitle}
              placeholder="e.g. Introducing Yourself"
              placeholderTextColor={TG.textHint}
              autoFocus
            />
            <Text style={styles.lessonTypeLabel}>Lesson Type</Text>
            <View style={styles.lessonTypeRow}>
              {(['practice', 'lecture', 'mixed'] as LessonType[]).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.lessonTypeBtn, lessonType === t && styles.lessonTypeBtnActive]}
                  onPress={() => setLessonType(t)}
                >
                  <Text style={styles.lessonTypeIcon}>
                    {t === 'practice' ? '🏋️' : t === 'lecture' ? '📖' : '📖🏋️'}
                  </Text>
                  <Text style={[styles.lessonTypeBtnText, lessonType === t && styles.lessonTypeBtnTextActive]}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setLessonModalVisible(false)}>
                <Text style={styles.btnTextCancel}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnSave} onPress={handleSaveLesson} disabled={submittingLesson || !lessonTitle.trim()}>
                {submittingLesson ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnTextSave}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TG.headerBg },
  centered: { alignItems: 'center', justifyContent: 'center' },
  errorText: { color: TG.textSecondary, fontSize: 16, marginBottom: 16 },
  backBtnModal: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: TG.bg, borderRadius: 8 },
  backBtnText: { color: TG.textPrimary, fontWeight: '600' },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: TG.headerBg,
  },
  topTitle: { fontSize: 18, fontWeight: '700', color: TG.textWhite },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  editBtn: { padding: 4 },
  publishBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  publishText: { fontSize: 14, fontWeight: '600' },

  contentWrap: { padding: 16, paddingBottom: 40, backgroundColor: TG.bgSecondary, flexGrow: 1 },

  courseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: TG.bg,
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: TG.separator,
  },
  headerImage: { width: 64, height: 64, borderRadius: 12 },
  placeholderImage: { backgroundColor: TG.bgSecondary, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: TG.textPrimary },
  badge: { backgroundColor: TG.accentLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '800', color: TG.accent },
  lessonsCount: { fontSize: 13, color: TG.textSecondary },

  unitCard: { backgroundColor: TG.bg, borderRadius: 16, padding: 16, marginBottom: 16 },
  unitHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: TG.separatorLight, marginBottom: 12 },
  unitTitle: { fontSize: 16, fontWeight: '700', color: TG.textPrimary },
  unitActions: { flexDirection: 'row', gap: 16 },

  lessonItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  lessonDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: TG.separator },
  lessonTitle: { fontSize: 15, color: TG.textPrimary },
  lessonTypeBadge: { fontSize: 11, color: TG.textHint, marginTop: 2 },

  addLessonBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingVertical: 8 },
  addLessonText: { fontSize: 14, fontWeight: '600', color: TG.accent },

  addUnitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: TG.accent,
    padding: 14,
    borderRadius: 16,
    marginTop: 8,
  },
  addUnitText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // Modals
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: TG.bg, width: '100%', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: TG.textPrimary, marginBottom: 16 },
  modalInput: { backgroundColor: TG.bgSecondary, borderWidth: 1, borderColor: TG.separator, borderRadius: 10, padding: 14, fontSize: 16, color: TG.textPrimary, marginBottom: 16 },
  lessonTypeLabel: { fontSize: 13, fontWeight: '600', color: TG.textSecondary, marginBottom: 8 },
  lessonTypeRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  lessonTypeBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 6, borderRadius: 10, borderWidth: 1.5, borderColor: TG.separator, backgroundColor: TG.bgSecondary },
  lessonTypeBtnActive: { borderColor: TG.accent, backgroundColor: TG.accentLight },
  lessonTypeIcon: { fontSize: 18, marginBottom: 4 },
  lessonTypeBtnText: { fontSize: 12, fontWeight: '600', color: TG.textSecondary },
  lessonTypeBtnTextActive: { color: TG.accent, fontWeight: '700' },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalBtnCancel: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: TG.separatorLight, alignItems: 'center' },
  btnTextCancel: { color: TG.textSecondary, fontWeight: '600', fontSize: 16 },
  modalBtnSave: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: TG.accent, alignItems: 'center' },
  btnTextSave: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
