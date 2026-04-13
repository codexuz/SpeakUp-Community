import { useAlert } from '@/components/CustomAlert';
import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import { apiPostReview } from '@/lib/api';
import {
  approveJoinRequest,
  deleteGroup,
  fetchGroupById,
  fetchGroupMembers,
  fetchGroupSubmissions,
  fetchJoinRequests,
  Group,
  GroupMember,
  JoinRequest,
  leaveGroup,
  regenerateReferralCode,
  rejectJoinRequest,
  removeMember,
} from '@/lib/groups';
import { useAuth } from '@/store/auth';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Award,
  Check,
  ClipboardCopy,
  Edit2,
  Hash,
  LogOut,
  RefreshCw,
  Star,
  Trash2,
  UserMinus,
  Users,
  X,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Clipboard,
  FlatList,
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

type Tab = 'members' | 'submissions' | 'requests';

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { alert } = useAlert();

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('members');
  const [subPage, setSubPage] = useState(1);
  const [hasMoreSubs, setHasMoreSubs] = useState(true);

  // Review modal
  const [reviewModal, setReviewModal] = useState(false);
  const [selectedSub, setSelectedSub] = useState<any>(null);
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const myRole = group?.myRole;
  const isOwnerOrTeacher = myRole === 'owner' || myRole === 'teacher';

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [g, m] = await Promise.all([
        fetchGroupById(id),
        fetchGroupMembers(id),
      ]);
      setGroup(g);
      setMembers(m);

      if (g?.myRole === 'owner' || g?.myRole === 'teacher') {
        const [sResult, jrs] = await Promise.all([
          fetchGroupSubmissions(id, 1),
          fetchJoinRequests(id),
        ]);
        setSubmissions(sResult?.data || []);
        setHasMoreSubs(1 < (sResult?.pagination?.totalPages ?? 1));
        setSubPage(1);
        setJoinRequests(jrs);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadMoreSubs = async () => {
    if (!hasMoreSubs || !id) return;
    const next = subPage + 1;
    try {
      const result = await fetchGroupSubmissions(id, next);
      setSubmissions(prev => [...prev, ...(result?.data || [])]);
      setHasMoreSubs(next < (result?.pagination?.totalPages ?? 1));
      setSubPage(next);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = () => {
    alert('Delete Group', 'This will permanently remove the group. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteGroup(id!);
            router.back();
          } catch (e: any) {
            toast.error('Error', e.message);
          }
        },
      },
    ], 'destructive');
  };

  const handleRegenCode = async () => {
    try {
      const newCode = await regenerateReferralCode(id!);
      setGroup(prev => (prev ? { ...prev, referralCode: newCode } : prev));
      toast.success('Done', `New referral code: ${newCode}`);
    } catch (e: any) {
      toast.error('Error', e.message);
    }
  };

  const handleCopyCode = () => {
    if (group?.referralCode) {
      Clipboard.setString(group.referralCode);
      toast.success('Copied!', 'Referral code copied to clipboard.');
    }
  };

  const handleLeave = () => {
    alert('Leave Group', 'Are you sure you want to leave this group?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            await leaveGroup(id!);
            router.back();
          } catch (e: any) {
            toast.error('Error', e.message);
          }
        },
      },
    ], 'warning');
  };

  const handleApprove = async (req: JoinRequest) => {
    try {
      await approveJoinRequest(id!, req.id);
      setJoinRequests(prev => prev.filter(r => r.id !== req.id));
      loadData();
    } catch (e: any) {
      toast.error('Error', e.message);
    }
  };

  const handleReject = async (req: JoinRequest) => {
    try {
      await rejectJoinRequest(id!, req.id);
      setJoinRequests(prev => prev.filter(r => r.id !== req.id));
    } catch (e: any) {
      toast.error('Error', e.message);
    }
  };

  const openReviewModal = (sub: any) => {
    setSelectedSub(sub);
    setScore(sub.scoreAvg?.toString() || '');
    setFeedback('');
    setReviewModal(true);
  };

  const handleReview = async () => {
    if (!selectedSub || !score) return;
    const numScore = parseInt(score, 10);
    if (isNaN(numScore) || numScore < 0 || numScore > 75) {
      toast.warning('Invalid', 'Score must be between 0 and 75');
      return;
    }
    setSubmitting(true);
    try {
      await apiPostReview(selectedSub.id, numScore, feedback);
      setReviewModal(false);
      loadData();
    } catch (e: any) {
      toast.error('Error', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const roleBadge = (role: string) => {
    const color = role === 'owner' ? TG.purple : role === 'teacher' ? TG.accent : TG.green;
    const bg = role === 'owner' ? TG.purpleLight : role === 'teacher' ? TG.accentLight : TG.greenLight;
    return (
      <View style={[styles.badge, { backgroundColor: bg }]}>
        <Text style={[styles.badgeText, { color }]}>{role}</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={TG.accent} />
      </SafeAreaView>
    );
  }

  if (!group) {
    return (
      <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: TG.textSecondary, fontSize: 16 }}>Group not found</Text>
      </SafeAreaView>
    );
  }

  const tabs: { key: Tab; label: string; icon: any; count?: number }[] = [
    { key: 'members', label: 'Members', icon: Users },
    ...(isOwnerOrTeacher
      ? [
          { key: 'submissions' as Tab, label: 'Submissions', icon: Award },
          { key: 'requests' as Tab, label: 'Requests', icon: Users, count: joinRequests.length },
        ]
      : []),
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft size={22} color={TG.textWhite} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{group.name}</Text>
          <Text style={styles.headerSub}>{members.length} members</Text>
        </View>
        {myRole === 'owner' && (
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => router.push(`/group/create?editId=${id}&name=${encodeURIComponent(group.name)}&description=${encodeURIComponent(group.description || '')}` as any)}
              style={styles.headerIconBtn}
              activeOpacity={0.7}
            >
              <Edit2 size={18} color={TG.textWhite} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDelete} style={styles.headerIconBtn} activeOpacity={0.7}>
              <Trash2 size={18} color={TG.red} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Referral Code Bar */}
      <View style={styles.codeBar}>
        <Hash size={16} color={TG.purple} />
        <Text style={styles.codeLabel}>Code</Text>
        <Text style={styles.codeValue}>{group.referralCode}</Text>
        <TouchableOpacity onPress={handleCopyCode} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ClipboardCopy size={18} color={TG.textSecondary} />
        </TouchableOpacity>
        {isOwnerOrTeacher && (
          <TouchableOpacity onPress={handleRegenCode} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <RefreshCw size={18} color={TG.orange} />
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {tabs.map(t => {
          const active = activeTab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setActiveTab(t.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {t.label}{t.count ? ` (${t.count})` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={styles.tabLine} />

      {/* Content */}
      {activeTab === 'members' && (
        <FlatList
          data={members}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={[styles.sep, { marginLeft: 68 }]} />}
          renderItem={({ item: m }) => (
            <View style={styles.memberRow}>
              <View style={styles.memberAvatar}>
                <Text style={styles.memberAvatarText}>
                  {(m.user?.fullName || '?').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <Text style={styles.memberName}>{m.user?.fullName}</Text>
                  {roleBadge(m.role)}
                </View>
                <Text style={styles.memberUsername}>@{m.user?.username}</Text>
              </View>
              {isOwnerOrTeacher && m.userId !== user?.id && m.role === 'student' && (
                <TouchableOpacity
                  onPress={() => {
                    alert('Remove', `Remove ${m.user?.fullName}?`, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Remove',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            await removeMember(id!, m.userId);
                            setMembers(prev => prev.filter(x => x.id !== m.id));
                          } catch (e: any) {
                            toast.error('Error', e.message);
                          }
                        },
                      },
                    ], 'destructive');
                  }}
                  style={styles.removeBtn}
                  activeOpacity={0.7}
                >
                  <UserMinus size={16} color={TG.red} />
                </TouchableOpacity>
              )}
            </View>
          )}
          ListFooterComponent={
            !isOwnerOrTeacher ? (
              <TouchableOpacity style={styles.leaveBtn} activeOpacity={0.7} onPress={handleLeave}>
                <LogOut size={18} color={TG.red} />
                <Text style={styles.leaveBtnText}>Leave Group</Text>
              </TouchableOpacity>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Users size={40} color={TG.separator} />
              <Text style={styles.emptyText}>No members yet</Text>
            </View>
          }
        />
      )}

      {activeTab === 'submissions' && (
        <FlatList
          data={submissions}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMoreSubs}
          onEndReachedThreshold={0.3}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item: sub }) => (
            <View style={styles.subCard}>
              <View style={styles.subHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.subStudent}>{sub.user?.fullName || 'Unknown'}</Text>
                  <Text style={styles.subQuestion} numberOfLines={2}>
                    {sub.test?.title || 'Unknown Test'}
                  </Text>
                  <Text style={styles.subMeta}>{sub._count?.responses || 0} responses{sub.cefrLevel ? ` · ${sub.cefrLevel}` : ''}</Text>
                </View>
                {sub.scoreAvg != null ? (
                  <View style={styles.scoreBadge}>
                    <Star size={13} color={TG.orange} fill={TG.orange} />
                    <Text style={styles.scoreBadgeText}>{Number(sub.scoreAvg).toFixed(1)}</Text>
                  </View>
                ) : (
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingBadgeText}>NEW</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={styles.reviewBtn}
                activeOpacity={0.7}
                onPress={() => openReviewModal(sub)}
              >
                <Text style={styles.reviewBtnText}>Review</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Award size={40} color={TG.separator} />
              <Text style={styles.emptyText}>No submissions yet</Text>
            </View>
          }
        />
      )}

      {activeTab === 'requests' && (
        <FlatList
          data={joinRequests}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={[styles.sep, { marginLeft: 68 }]} />}
          renderItem={({ item: req }) => (
            <View style={styles.memberRow}>
              <View style={[styles.memberAvatar, { backgroundColor: TG.orangeLight }]}>
                <Text style={[styles.memberAvatarText, { color: TG.orange }]}>
                  {(req.user?.fullName || '?').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>{req.user?.fullName}</Text>
                <Text style={styles.memberUsername}>@{req.user?.username}</Text>
                {req.message && <Text style={styles.requestMsg} numberOfLines={2}>{req.message}</Text>}
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={[styles.actionCircle, { backgroundColor: TG.greenLight }]}
                  onPress={() => handleApprove(req)}
                  activeOpacity={0.7}
                >
                  <Check size={18} color={TG.green} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionCircle, { backgroundColor: TG.redLight }]}
                  onPress={() => handleReject(req)}
                  activeOpacity={0.7}
                >
                  <X size={18} color={TG.red} />
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Users size={40} color={TG.separator} />
              <Text style={styles.emptyText}>No pending requests</Text>
            </View>
          }
        />
      )}

      {/* Review Modal */}
      <Modal visible={reviewModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Review Submission</Text>
            {selectedSub && (
              <Text style={styles.modalSubtitle} numberOfLines={2}>
                {selectedSub.user?.fullName} - {selectedSub.test?.title}
              </Text>
            )}
            <Text style={styles.inputLabel}>Score (0-75)</Text>
            <TextInput
              style={styles.modalInput}
              value={score}
              onChangeText={setScore}
              keyboardType="number-pad"
              maxLength={2}
              placeholder="0-75"
              placeholderTextColor={TG.textHint}
            />
            <Text style={styles.inputLabel}>Feedback</Text>
            <TextInput
              style={[styles.modalInput, styles.textArea]}
              value={feedback}
              onChangeText={setFeedback}
              multiline
              numberOfLines={4}
              placeholder="Write feedback..."
              placeholderTextColor={TG.textHint}
              textAlignVertical="top"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                activeOpacity={0.7}
                onPress={() => setReviewModal(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, (!score || submitting) && { opacity: 0.5 }]}
                activeOpacity={0.7}
                onPress={handleReview}
                disabled={!score || submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={TG.textWhite} />
                ) : (
                  <Text style={styles.submitBtnText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TG.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TG.headerBg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: TG.textWhite },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  headerActions: { flexDirection: 'row', gap: 12 },
  headerIconBtn: { padding: 4 },

  codeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: TG.bgSecondary,
    borderBottomWidth: 0.5,
    borderBottomColor: TG.separator,
  },
  codeLabel: { fontSize: 13, color: TG.textSecondary, fontWeight: '500' },
  codeValue: { fontSize: 15, fontWeight: '700', color: TG.purple, letterSpacing: 2, flex: 1, textAlign: 'right', marginRight: 4 },

  tabRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 4, paddingTop: 8 },
  tab: { paddingVertical: 10, paddingHorizontal: 16 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: TG.accent },
  tabText: { fontSize: 14, fontWeight: '600', color: TG.textSecondary },
  tabTextActive: { color: TG.accent },
  tabLine: { height: 0.5, backgroundColor: TG.separator },

  listContent: { paddingBottom: 100 },
  sep: { height: 0.5, backgroundColor: TG.separator },

  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: TG.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarText: { fontSize: 18, fontWeight: '700', color: TG.accent },
  memberName: { fontSize: 15, fontWeight: '600', color: TG.textPrimary },
  memberUsername: { fontSize: 13, color: TG.textSecondary },
  requestMsg: { fontSize: 13, color: TG.textSecondary, marginTop: 2, fontStyle: 'italic' },
  removeBtn: {
    padding: 8,
    backgroundColor: TG.redLight,
    borderRadius: 20,
  },

  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },

  actionCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },

  leaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    margin: 16,
    paddingVertical: 14,
    backgroundColor: TG.redLight,
    borderRadius: 12,
  },
  leaveBtnText: { color: TG.red, fontWeight: '600', fontSize: 15 },

  subCard: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  subHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  subStudent: { fontSize: 15, fontWeight: '600', color: TG.accent, marginBottom: 2 },
  subQuestion: { fontSize: 14, color: TG.textSecondary, lineHeight: 20 },
  subMeta: { fontSize: 12, color: TG.textHint, marginTop: 2 },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: TG.orangeLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  scoreBadgeText: { fontSize: 14, fontWeight: '700', color: TG.orange },
  pendingBadge: {
    backgroundColor: TG.accentLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pendingBadgeText: { fontSize: 11, fontWeight: '700', color: TG.accent },
  reviewBtn: {
    alignSelf: 'flex-start',
    backgroundColor: TG.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  reviewBtnText: { color: TG.textWhite, fontWeight: '600', fontSize: 14 },

  emptyContainer: { alignItems: 'center', marginTop: 60, gap: 12 },
  emptyText: { color: TG.textSecondary, fontSize: 15 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: TG.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: TG.textPrimary, marginBottom: 4 },
  modalSubtitle: { fontSize: 14, color: TG.textSecondary, marginBottom: 20, lineHeight: 20 },
  inputLabel: { fontSize: 13, color: TG.textSecondary, fontWeight: '600', marginBottom: 6 },
  modalInput: {
    backgroundColor: TG.bgSecondary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: TG.textPrimary,
    borderWidth: 0.5,
    borderColor: TG.separator,
    marginBottom: 16,
  },
  textArea: { minHeight: 100 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: TG.bgSecondary,
  },
  cancelBtnText: { color: TG.textSecondary, fontWeight: '600' },
  submitBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: TG.accent,
  },
  submitBtnText: { color: TG.textWhite, fontWeight: '600' },
});
