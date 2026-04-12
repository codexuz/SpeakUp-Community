import {
    deleteGroup,
    fetchGroupById,
    fetchGroupMembers,
    fetchGroupSubmissions,
    gradeSubmission,
    Group,
    GroupMember,
    leaveGroup,
    regenerateReferralCode,
    removeStudentFromGroup,
} from '@/lib/groups';
import { useAuth } from '@/store/auth';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    ArrowLeft,
    Award,
    ClipboardCopy,
    Edit2,
    Hash,
    LogOut,
    MessageSquare,
    RefreshCw,
    Star,
    Trash2,
    UserMinus,
    Users,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Clipboard,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const isTeacher = user?.role === 'teacher';

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'members' | 'submissions'>('members');

  // Grading modal
  const [gradeModal, setGradeModal] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [grading, setGrading] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [g, m, s] = await Promise.all([
        fetchGroupById(id),
        fetchGroupMembers(id),
        isTeacher ? fetchGroupSubmissions(id) : Promise.resolve([]),
      ]);
      setGroup(g);
      setMembers(m);
      setSubmissions(s);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id, isTeacher]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = () => {
    Alert.alert('Delete Group', 'This will remove the group and all members. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteGroup(id!);
            router.back();
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  const handleRegenCode = async () => {
    try {
      const newCode = await regenerateReferralCode(id!);
      setGroup((prev) => (prev ? { ...prev, referral_code: newCode } : prev));
      Alert.alert('Done', `New referral code: ${newCode}`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleCopyCode = () => {
    if (group?.referral_code) {
      Clipboard.setString(group.referral_code);
      Alert.alert('Copied!', 'Referral code copied to clipboard.');
    }
  };

  const handleLeave = () => {
    Alert.alert('Leave Group', 'Are you sure you want to leave this group?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            await leaveGroup(id!, user!.id);
            router.back();
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  const handleRemoveMember = (member: GroupMember) => {
    Alert.alert('Remove Member', `Remove ${member.student?.fullName} from the group?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeStudentFromGroup(id!, member.student_id);
            loadData();
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  const openGradeModal = (sub: any) => {
    setSelectedSubmission(sub);
    setScore(sub.teacher_score?.toString() || '');
    setFeedback(sub.teacher_feedback || '');
    setGradeModal(true);
  };

  const handleGrade = async () => {
    if (!selectedSubmission || !score) return;
    const numScore = parseInt(score, 10);
    if (isNaN(numScore) || numScore < 0 || numScore > 9) {
      Alert.alert('Invalid', 'Score must be between 0 and 9');
      return;
    }
    setGrading(true);
    try {
      await gradeSubmission(selectedSubmission.id, numScore, feedback);
      setGradeModal(false);
      loadData();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setGrading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <LinearGradient colors={['#0f172a', '#1e293b']} style={StyleSheet.absoluteFillObject} />
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (!group) {
    return (
      <View style={styles.loaderContainer}>
        <LinearGradient colors={['#0f172a', '#1e293b']} style={StyleSheet.absoluteFillObject} />
        <Text style={{ color: '#94a3b8', fontSize: 18 }}>Group not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0f172a', '#1e293b']} style={StyleSheet.absoluteFillObject} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{group.name}</Text>
          <Text style={styles.headerSub}>{members.length} members</Text>
        </View>
        {isTeacher && (
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => router.push(`/group/create?editId=${id}&name=${encodeURIComponent(group.name)}&description=${encodeURIComponent(group.description || '')}` as any)}
              style={styles.headerIconBtn}
              activeOpacity={0.7}
            >
              <Edit2 size={20} color="#3b82f6" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDelete} style={styles.headerIconBtn} activeOpacity={0.7}>
              <Trash2 size={20} color="#ef4444" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Referral Code Section */}
      <View style={styles.codeSection}>
        <View style={styles.codeBox}>
          <Hash size={18} color="#8b5cf6" />
          <Text style={styles.codeLabel}>Referral Code</Text>
          <Text style={styles.codeValue}>{group.referral_code}</Text>
          <TouchableOpacity onPress={handleCopyCode} activeOpacity={0.7}>
            <ClipboardCopy size={20} color="#64748b" />
          </TouchableOpacity>
          {isTeacher && (
            <TouchableOpacity onPress={handleRegenCode} activeOpacity={0.7}>
              <RefreshCw size={20} color="#f59e0b" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'members' && styles.tabActive]}
          onPress={() => setActiveTab('members')}
          activeOpacity={0.8}
        >
          <Users size={18} color={activeTab === 'members' ? '#fff' : '#64748b'} />
          <Text style={[styles.tabText, activeTab === 'members' && styles.tabTextActive]}>Members</Text>
        </TouchableOpacity>
        {isTeacher && (
          <TouchableOpacity
            style={[styles.tab, activeTab === 'submissions' && styles.tabActive]}
            onPress={() => setActiveTab('submissions')}
            activeOpacity={0.8}
          >
            <Award size={18} color={activeTab === 'submissions' ? '#fff' : '#64748b'} />
            <Text style={[styles.tabText, activeTab === 'submissions' && styles.tabTextActive]}>Submissions</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {activeTab === 'members' ? (
          <>
            {members.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Users size={40} color="#334155" />
                <Text style={styles.emptyText}>No members yet</Text>
              </View>
            ) : (
              members.map((m) => (
                <View key={m.id} style={styles.memberCard}>
                  <View style={styles.memberAvatar}>
                    <Text style={styles.memberAvatarText}>
                      {(m.student?.fullName || '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberName}>{m.student?.fullName}</Text>
                    <Text style={styles.memberUsername}>@{m.student?.username}</Text>
                  </View>
                  {isTeacher && (
                    <TouchableOpacity onPress={() => handleRemoveMember(m)} style={styles.removeBtn} activeOpacity={0.7}>
                      <UserMinus size={18} color="#ef4444" />
                    </TouchableOpacity>
                  )}
                </View>
              ))
            )}
            {!isTeacher && (
              <TouchableOpacity style={styles.leaveBtn} activeOpacity={0.8} onPress={handleLeave}>
                <LogOut size={20} color="#ef4444" />
                <Text style={styles.leaveBtnText}>LEAVE GROUP</Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <>
            {submissions.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Award size={40} color="#334155" />
                <Text style={styles.emptyText}>No submissions yet</Text>
              </View>
            ) : (
              submissions.map((sub) => (
                <View key={sub.id} style={styles.subCard}>
                  <View style={styles.subHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.subStudent}>{sub.student?.fullName || 'Unknown'}</Text>
                      <Text style={styles.subQuestion} numberOfLines={2}>
                        {sub.question?.q_text || 'Unknown Question'}
                      </Text>
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
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      {/* Grade Modal */}
      <Modal visible={gradeModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Grade Submission</Text>
            {selectedSubmission && (
              <Text style={styles.modalSubtitle} numberOfLines={2}>
                {selectedSubmission.question?.q_text}
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
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
    gap: 12,
  },
  backBtn: { padding: 8, backgroundColor: '#1e293b', borderRadius: 12, borderWidth: 2, borderColor: '#334155' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerIconBtn: {
    padding: 10,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#334155',
  },

  codeSection: { paddingHorizontal: 20, marginBottom: 16 },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 14,
    borderWidth: 2,
    borderColor: '#334155',
  },
  codeLabel: { fontSize: 13, color: '#94a3b8', fontWeight: '600' },
  codeValue: { fontSize: 18, fontWeight: '800', color: '#8b5cf6', letterSpacing: 2, flex: 1, textAlign: 'right', marginRight: 4 },

  tabRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 8 },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#1e293b',
    borderWidth: 2,
    borderColor: '#334155',
  },
  tabActive: { backgroundColor: '#8b5cf6', borderColor: '#7c3aed', borderBottomWidth: 4 },
  tabText: { fontWeight: '700', fontSize: 14, color: '#64748b' },
  tabTextActive: { color: '#fff' },

  scrollContent: { padding: 20, paddingBottom: 100 },

  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#334155',
    borderBottomWidth: 4,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderWidth: 2,
    borderColor: 'rgba(139, 92, 246, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarText: { fontSize: 18, fontWeight: '800', color: '#8b5cf6' },
  memberName: { fontSize: 16, fontWeight: '700', color: '#f8fafc' },
  memberUsername: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  removeBtn: {
    padding: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },

  leaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderBottomWidth: 4,
  },
  leaveBtnText: { color: '#ef4444', fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },

  subCard: {
    backgroundColor: '#1e293b',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    borderWidth: 2,
    borderColor: '#334155',
    borderBottomWidth: 4,
  },
  subHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  subStudent: { fontSize: 16, fontWeight: '800', color: '#8b5cf6', marginBottom: 4 },
  subQuestion: { fontSize: 15, color: '#cbd5e1', fontWeight: '500', lineHeight: 22 },
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

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
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

  emptyContainer: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText: { color: '#94a3b8', fontSize: 16, fontWeight: '600' },
});
