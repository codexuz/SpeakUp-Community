import { fetchCommunitySubmissions, gradeSubmission } from '@/lib/groups';
import { useAuth } from '@/store/auth';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Award, MessageSquare, RefreshCw, Star, User } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export default function CommunityScreen() {
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher';

  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'graded'>('all');

  // Grade modal
  const [gradeModal, setGradeModal] = useState(false);
  const [selectedSub, setSelectedSub] = useState<any>(null);
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [grading, setGrading] = useState(false);

  const loadSubmissions = async () => {
    setLoading(true);
    try {
      const data = await fetchCommunitySubmissions();
      setSubmissions(data);
    } catch (e) {
      console.error('Failed to load community', e);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadSubmissions();
    }, [])
  );

  const filtered = submissions.filter((s) => {
    if (filter === 'pending') return s.teacher_score === null || s.teacher_score === undefined;
    if (filter === 'graded') return s.teacher_score !== null && s.teacher_score !== undefined;
    return true;
  });

  // For students, show only their own
  const displayed = !isTeacher ? filtered.filter((s) => s.student_id === user?.id) : filtered;

  const openGradeModal = (sub: any) => {
    setSelectedSub(sub);
    setScore(sub.teacher_score?.toString() || '');
    setFeedback(sub.teacher_feedback || '');
    setGradeModal(true);
  };

  const handleGrade = async () => {
    if (!selectedSub || !score) return;
    const numScore = parseInt(score, 10);
    if (isNaN(numScore) || numScore < 0 || numScore > 9) {
      Alert.alert('Invalid', 'Score must be between 0 and 9');
      return;
    }
    setGrading(true);
    try {
      await gradeSubmission(selectedSub.id, numScore, feedback);
      setGradeModal(false);
      loadSubmissions();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setGrading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0f172a', '#1e293b']} style={StyleSheet.absoluteFillObject} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Community</Text>
          <TouchableOpacity onPress={loadSubmissions} style={styles.refreshBtn} activeOpacity={0.7}>
            <RefreshCw size={22} color="#3b82f6" />
          </TouchableOpacity>
        </View>

        <Text style={styles.subtitle}>
          {isTeacher ? 'All student submissions across the platform' : 'Your submissions and scores'}
        </Text>

        {/* Filter Tabs */}
        <View style={styles.filterRow}>
          {(['all', 'pending', 'graded'] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterTab, filter === f && styles.filterTabActive]}
              activeOpacity={0.8}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 60 }} />
        ) : displayed.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Award size={48} color="#334155" style={{ marginBottom: 16 }} />
            <Text style={styles.emptyText}>No submissions found</Text>
          </View>
        ) : (
          displayed.map((sub) => (
            <View key={sub.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.avatarCircle}>
                  <User size={20} color="#8b5cf6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.studentName}>{sub.student?.fullName || 'Unknown'}</Text>
                  <Text style={styles.studentHandle}>@{sub.student?.username || '?'}</Text>
                </View>
                {sub.teacher_score !== null && sub.teacher_score !== undefined ? (
                  <View style={styles.scoreBadge}>
                    <Star size={14} color="#f59e0b" fill="#f59e0b" />
                    <Text style={styles.scoreBadgeText}>{sub.teacher_score}</Text>
                  </View>
                ) : (
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingBadgeText}>PENDING</Text>
                  </View>
                )}
              </View>

              <Text style={styles.questionText} numberOfLines={2}>
                {sub.question?.q_text || 'Unknown Question'}
              </Text>

              {sub.teacher_feedback ? (
                <View style={styles.feedbackBox}>
                  <Text style={styles.feedbackLabel}>FEEDBACK</Text>
                  <Text style={styles.feedbackText}>{sub.teacher_feedback}</Text>
                </View>
              ) : null}

              {isTeacher && (
                <TouchableOpacity
                  style={styles.gradeBtn}
                  activeOpacity={0.8}
                  onPress={() => openGradeModal(sub)}
                >
                  <MessageSquare size={18} color="#fff" />
                  <Text style={styles.gradeBtnText}>
                    {sub.teacher_score !== null && sub.teacher_score !== undefined ? 'UPDATE GRADE' : 'GRADE'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* Grade Modal */}
      <Modal visible={gradeModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Grade Submission</Text>
            {selectedSub && (
              <Text style={styles.modalSubtitle} numberOfLines={2}>
                {selectedSub.student?.fullName} — {selectedSub.question?.q_text}
              </Text>
            )}
            <Text style={styles.inputLabel}>Score (0-9)</Text>
            <TextInput
              style={styles.input}
              value={score}
              onChangeText={setScore}
              keyboardType="number-pad"
              maxLength={1}
              placeholder="0-9"
              placeholderTextColor="#64748b"
            />
            <Text style={styles.inputLabel}>Feedback</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={feedback}
              onChangeText={setFeedback}
              multiline
              numberOfLines={4}
              placeholder="Write feedback for the student..."
              placeholderTextColor="#64748b"
              textAlignVertical="top"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                activeOpacity={0.8}
                onPress={() => setGradeModal(false)}
              >
                <Text style={styles.cancelBtnText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, (!score || grading) && { opacity: 0.5 }]}
                activeOpacity={0.8}
                onPress={handleGrade}
                disabled={!score || grading}
              >
                {grading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>SUBMIT</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingTop: 40, paddingBottom: 100 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title: { fontSize: 28, fontWeight: '800', color: '#fff' },
  subtitle: { fontSize: 14, color: '#94a3b8', fontWeight: '500', marginBottom: 20 },
  refreshBtn: {
    padding: 10,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },

  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#1e293b',
    borderWidth: 2,
    borderColor: '#334155',
  },
  filterTabActive: { backgroundColor: '#3b82f6', borderColor: '#2563eb', borderBottomWidth: 4 },
  filterText: { fontSize: 12, fontWeight: '800', color: '#64748b', letterSpacing: 1 },
  filterTextActive: { color: '#fff' },

  card: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 2,
    borderColor: '#334155',
    borderBottomWidth: 5,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderWidth: 2,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  studentName: { fontSize: 16, fontWeight: '700', color: '#f8fafc' },
  studentHandle: { fontSize: 12, color: '#64748b', fontWeight: '500' },

  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  scoreBadgeText: { fontSize: 16, fontWeight: '800', color: '#f59e0b' },
  pendingBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  pendingBadgeText: { fontSize: 11, fontWeight: '800', color: '#3b82f6', letterSpacing: 1 },

  questionText: { fontSize: 15, color: '#cbd5e1', fontWeight: '500', lineHeight: 22, marginBottom: 12 },

  feedbackBox: {
    padding: 14,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    marginBottom: 14,
  },
  feedbackLabel: { fontSize: 11, fontWeight: '800', color: '#10b981', letterSpacing: 1, marginBottom: 4 },
  feedbackText: { fontSize: 14, color: '#cbd5e1', lineHeight: 20 },

  gradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 14,
    borderBottomWidth: 4,
    borderColor: '#059669',
  },
  gradeBtnText: { color: '#fff', fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },

  emptyContainer: { alignItems: 'center', marginTop: 80 },
  emptyText: { color: '#94a3b8', fontSize: 16, fontWeight: '600' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderWidth: 2,
    borderColor: '#334155',
    borderBottomWidth: 0,
  },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 4 },
  modalSubtitle: { fontSize: 14, color: '#94a3b8', marginBottom: 20, lineHeight: 20 },
  inputLabel: { fontSize: 13, color: '#94a3b8', fontWeight: '700', marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#fff',
    borderWidth: 2,
    borderColor: '#334155',
    marginBottom: 16,
  },
  textArea: { minHeight: 100 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: '#0f172a',
    borderWidth: 2,
    borderColor: '#334155',
    borderBottomWidth: 4,
  },
  cancelBtnText: { color: '#94a3b8', fontWeight: '800', letterSpacing: 0.5 },
  submitBtn: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: '#10b981',
    borderBottomWidth: 4,
    borderColor: '#059669',
  },
  submitBtnText: { color: '#fff', fontWeight: '800', letterSpacing: 0.5 },
});
