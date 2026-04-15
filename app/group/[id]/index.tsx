import AdBanner from '@/components/AdBanner';
import { useAlert } from '@/components/CustomAlert';
import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import {
  deleteGroup,
  fetchGroupById,
  fetchGroupMembers,
  fetchJoinRequests,
  Group,
  GroupMember,
  leaveGroup,
  regenerateReferralCode,
  uploadGroupAvatar
} from '@/lib/groups';
import { useAuth } from '@/store/auth';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Award,
  Camera,
  ChevronRight,
  ClipboardCopy,
  Edit2,
  LogOut,
  MessageCircle,
  MoreVertical,
  RefreshCw,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Clipboard,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface TopicItem {
  key: string;
  icon: React.ComponentType<any>;
  iconColor: string;
  iconBg: string;
  label: string;
  subtitle?: string;
  badge?: number;
  route: string;
}

export default function GroupTopicsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { alert } = useAlert();

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [requestCount, setRequestCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [referModalOpen, setReferModalOpen] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

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
        const jrs = await fetchJoinRequests(id);
        setRequestCount(jrs.length);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // ─── Handlers ─────────────────────────────────────────
  const handleDelete = () => {
    alert(
      'Delete Group',
      'This will permanently remove the group. Continue?',
      [
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
      ],
      'destructive',
    );
  };

  const handleLeave = () => {
    alert(
      'Leave Group',
      'Are you sure you want to leave this group?',
      [
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
      ],
      'warning',
    );
  };

  const handleRegenCode = async () => {
    try {
      const newCode = await regenerateReferralCode(id!);
      setGroup((prev) => (prev ? { ...prev, referralCode: newCode } : prev));
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

  const handlePickGroupAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setUploadingAvatar(true);
    try {
      const updated = await uploadGroupAvatar(id!, result.assets[0].uri);
      setGroup((prev) =>
        prev ? { ...prev, avatarUrl: updated.avatarUrl } : prev,
      );
      toast.success('Done', 'Group image updated');
    } catch (e: any) {
      toast.error('Error', e.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  // ─── Topic items ──────────────────────────────────────
  const topics: TopicItem[] = [
    {
      key: 'messaging',
      icon: MessageCircle,
      iconColor: TG.textWhite,
      iconBg: TG.accent,
      label: 'Messaging',
      subtitle: 'Group chat',
      route: `/group/${id}/messaging`,
    },
    ...(isOwnerOrTeacher
      ? [
          {
            key: 'submissions',
            icon: Award,
            iconColor: TG.textWhite,
            iconBg: TG.orange,
            label: 'Submissions',
            subtitle: 'Student responses',
            route: `/group/${id}/submissions`,
          },
          {
            key: 'requests',
            icon: Users,
            iconColor: TG.textWhite,
            iconBg: TG.purple,
            label: 'Join Requests',
            subtitle: 'Pending approvals',
            badge: requestCount || undefined,
            route: `/group/${id}/requests`,
          },
        ]
      : []),
  ];

  // ─── Render ───────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView
        style={[styles.safe, { justifyContent: 'center', alignItems: 'center', backgroundColor: TG.bg }]}
      >
        <ActivityIndicator size="large" color={TG.accent} />
      </SafeAreaView>
    );
  }

  if (!group) {
    return (
      <SafeAreaView
        style={[styles.safe, { justifyContent: 'center', alignItems: 'center', backgroundColor: TG.bg }]}
      >
        <Text style={{ color: TG.textSecondary, fontSize: 16 }}>
          Group not found
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <ArrowLeft size={22} color={TG.textWhite} />
        </TouchableOpacity>

        {/* Avatar */}
        {isOwnerOrTeacher ? (
          <TouchableOpacity
            style={styles.headerAvatarWrap}
            activeOpacity={0.75}
            onPress={handlePickGroupAvatar}
            disabled={uploadingAvatar}
          >
            {group.avatarUrl ? (
              <Image
                source={{ uri: group.avatarUrl }}
                style={styles.headerAvatarImg}
              />
            ) : (
              <View style={styles.headerAvatarFallback}>
                <Users size={20} color={TG.textWhite} strokeWidth={1.8} />
              </View>
            )}
            {uploadingAvatar && (
              <View style={styles.headerAvatarLoading}>
                <ActivityIndicator size={14} color={TG.textWhite} />
              </View>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.headerAvatarWrap}>
            {group.avatarUrl ? (
              <Image
                source={{ uri: group.avatarUrl }}
                style={styles.headerAvatarImg}
              />
            ) : (
              <View style={styles.headerAvatarFallback}>
                <Users size={20} color={TG.textWhite} strokeWidth={1.8} />
              </View>
            )}
          </View>
        )}

        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={0.7}
          onPress={() => router.push(`/group/${id}/detail` as any)}
        >
          <Text style={styles.headerTitle} numberOfLines={1}>
            {group.name}
          </Text>
          <Text style={styles.headerSub}>{members.length} members</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setMenuOpen(true)}
          style={styles.headerIconBtn}
          activeOpacity={0.7}
        >
          <MoreVertical size={20} color={TG.textWhite} />
        </TouchableOpacity>
      </View>

      {/* Topic list */}
      <ScrollView
        style={{ flex: 1, backgroundColor: TG.bg }}
        contentContainerStyle={styles.topicList}
        showsVerticalScrollIndicator={false}
      >
        {/* Section label */}
        <Text style={styles.sectionLabel}>Topics</Text>

        {topics.map((t) => {
          const Icon = t.icon;
          return (
            <TouchableOpacity
              key={t.key}
              style={styles.topicRow}
              activeOpacity={0.7}
              onPress={() => router.push(t.route as any)}
            >
              <View style={[styles.topicIcon, { backgroundColor: t.iconBg }]}>
                <Icon size={20} color={t.iconColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.topicLabel}>{t.label}</Text>
                {t.subtitle && (
                  <Text style={styles.topicSub}>{t.subtitle}</Text>
                )}
              </View>
              {t.badge && t.badge > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{t.badge}</Text>
                </View>
              ) : (
                <ChevronRight size={18} color={TG.textHint} />
              )}
            </TouchableOpacity>
          );
        })}

        {/* Ad banner for non-global groups */}
        {!group.isGlobal && <AdBanner />}
      </ScrollView>

      {/* Menu */}
      <Modal
        visible={menuOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable
          style={styles.menuBackdrop}
          onPress={() => setMenuOpen(false)}
        >
          <Pressable
            style={styles.menuPanel}
            onPress={(e) => e.stopPropagation()}
          >
            {isOwnerOrTeacher && (
              <>
                <TouchableOpacity
                  style={styles.menuItem}
                  activeOpacity={0.7}
                  onPress={() => {
                    setMenuOpen(false);
                    router.push(`/group/edit?id=${id}` as any);
                  }}
                >
                  <Edit2 size={18} color={TG.accent} />
                  <Text style={styles.menuItemText}>Edit Group</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.menuItem}
                  activeOpacity={0.7}
                  onPress={() => {
                    setMenuOpen(false);
                    handlePickGroupAvatar();
                  }}
                >
                  <Camera size={18} color={TG.purple} />
                  <Text style={styles.menuItemText}>Change Image</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.menuItem}
                  activeOpacity={0.7}
                  onPress={() => {
                    setMenuOpen(false);
                    setReferModalOpen(true);
                  }}
                >
                  <UserPlus size={18} color={TG.accent} />
                  <Text style={styles.menuItemText}>Invite Member</Text>
                </TouchableOpacity>
                {myRole === 'owner' && (
                  <TouchableOpacity
                    style={styles.menuItem}
                    activeOpacity={0.7}
                    onPress={() => {
                      setMenuOpen(false);
                      handleDelete();
                    }}
                  >
                    <Trash2 size={18} color={TG.red} />
                    <Text style={[styles.menuItemText, { color: TG.red }]}>
                      Delete Group
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}
            {!isOwnerOrTeacher && (
              <>
                <TouchableOpacity
                  style={styles.menuItem}
                  activeOpacity={0.7}
                  onPress={() => {
                    setMenuOpen(false);
                    setReferModalOpen(true);
                  }}
                >
                  <ClipboardCopy size={18} color={TG.accent} />
                  <Text style={styles.menuItemText}>Refer</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.menuItem}
                  activeOpacity={0.7}
                  onPress={() => {
                    setMenuOpen(false);
                    handleLeave();
                  }}
                >
                  <LogOut size={18} color={TG.red} />
                  <Text style={[styles.menuItemText, { color: TG.red }]}>
                    Leave Group
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Referral Modal */}
      <Modal
        visible={referModalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setReferModalOpen(false)}
      >
        <Pressable
          style={styles.referBackdrop}
          onPress={() => setReferModalOpen(false)}
        >
          <Pressable
            style={styles.referModal}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.referTitle}>Referral Code</Text>
            <Text style={styles.referSubtitle}>
              Share this code so others can request to join.
            </Text>
            <View style={styles.referCodeBox}>
              <Text style={styles.referCodeText}>{group.referralCode}</Text>
            </View>
            <TouchableOpacity
              style={styles.referCopyBtn}
              activeOpacity={0.75}
              onPress={handleCopyCode}
            >
              <ClipboardCopy size={16} color={TG.textWhite} />
              <Text style={styles.referCopyBtnText}>Copy Code</Text>
            </TouchableOpacity>
            {isOwnerOrTeacher && (
              <TouchableOpacity
                style={styles.referRegenBtn}
                activeOpacity={0.75}
                onPress={handleRegenCode}
              >
                <RefreshCw size={16} color={TG.orange} />
                <Text style={styles.referRegenBtnText}>Regenerate Code</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.referCloseBtn}
              activeOpacity={0.75}
              onPress={() => setReferModalOpen(false)}
            >
              <Text style={styles.referCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TG.headerBg },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TG.headerBg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  backBtn: { padding: 4 },
  headerAvatarWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    position: 'relative',
  },
  headerAvatarImg: { width: 42, height: 42, borderRadius: 21 },
  headerAvatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarLoading: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: TG.textWhite },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  headerIconBtn: { padding: 4 },

  /* Topic list */
  topicList: { paddingBottom: 40 },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: TG.accent,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 6,
  },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  topicIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topicLabel: { fontSize: 16, fontWeight: '600', color: TG.textPrimary },
  topicSub: { fontSize: 13, color: TG.textSecondary, marginTop: 1 },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: TG.accent,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { fontSize: 12, fontWeight: '700', color: TG.textWhite },

  /* Menu */
  menuBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.18)' },
  menuPanel: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 96 : 84,
    right: 14,
    backgroundColor: TG.bg,
    borderRadius: 14,
    minWidth: 170,
    paddingVertical: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.14,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
    }),
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  menuItemText: { fontSize: 14, color: TG.textPrimary, fontWeight: '600' },

  /* Refer modal */
  referBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.28)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  referModal: {
    backgroundColor: TG.bg,
    borderRadius: 18,
    padding: 18,
  },
  referTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TG.textPrimary,
    marginBottom: 6,
  },
  referSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: TG.textSecondary,
    marginBottom: 14,
  },
  referCodeBox: {
    backgroundColor: TG.bgSecondary,
    borderWidth: 1,
    borderColor: TG.separator,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  referCodeText: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: TG.accent,
  },
  referCopyBtn: {
    backgroundColor: TG.accent,
    borderRadius: 12,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  referCopyBtnText: { color: TG.textWhite, fontSize: 14, fontWeight: '700' },
  referRegenBtn: {
    marginTop: 10,
    backgroundColor: TG.orangeLight,
    borderRadius: 12,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  referRegenBtnText: { color: TG.orange, fontSize: 14, fontWeight: '700' },
  referCloseBtn: {
    marginTop: 10,
    backgroundColor: TG.bgSecondary,
    borderRadius: 12,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  referCloseBtnText: { color: TG.textSecondary, fontSize: 14, fontWeight: '600' },
});
