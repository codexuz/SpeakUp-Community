import { useAlert } from '@/components/CustomAlert';
import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import {
  fetchGroupById,
  fetchGroupMembers,
  Group,
  GroupMember,
  removeMember,
} from '@/lib/groups';
import { useAuth } from '@/store/auth';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ClipboardCopy, Share2, Users } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Clipboard,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollOffset,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

const HEADER_HEIGHT = 240;

export default function GroupDetailInfoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { alert } = useAlert();

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [shareModalVisible, setShareModalVisible] = useState(false);

  const isOwnerOrTeacher =
    group?.myRole === 'owner' || group?.myRole === 'teacher';

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollOffset(scrollRef);

  const headerAnimStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          scrollOffset.value,
          [-HEADER_HEIGHT, 0, HEADER_HEIGHT],
          [-HEADER_HEIGHT / 2, 0, HEADER_HEIGHT * 0.75],
        ),
      },
      {
        scale: interpolate(
          scrollOffset.value,
          [-HEADER_HEIGHT, 0, HEADER_HEIGHT],
          [2, 1, 1],
        ),
      },
    ],
  }));

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
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCopyCode = () => {
    if (group?.referralCode) {
      Clipboard.setString(group.referralCode);
      toast.success('Copied!', 'Referral code copied to clipboard.');
    }
  };

  const handleRemoveMember = (m: GroupMember) => {
    alert('Remove Member', `Remove ${m.user?.fullName} from this group?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setRemovingId(m.id);
          try {
            await removeMember(id!, m.userId);
            setMembers((prev) => prev.filter((x) => x.id !== m.id));
          } catch (e: any) {
            toast.error('Error', e.message);
          } finally {
            setRemovingId(null);
          }
        },
      },
    ], 'destructive');
  };

  const roleBadge = (role: string) => {
    const color =
      role === 'owner' ? TG.purple : role === 'teacher' ? TG.accent : TG.green;
    const label =
      role === 'owner' ? 'Owner' : role === 'teacher' ? 'Teacher' : '';
    if (!label) return null;
    return <Text style={[styles.roleLabel, { color }]}>{label}</Text>;
  };

  if (loading) {
    return (
      <View style={styles.safeArea}>
        <Animated.ScrollView ref={scrollRef} style={{ flex: 1 }}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 200 }}>
            <ActivityIndicator size="large" color={TG.accent} />
          </View>
        </Animated.ScrollView>
      </View>
    );
  }

  if (!group) {
    return (
      <View style={styles.safeArea}>
        <Animated.ScrollView ref={scrollRef} style={{ flex: 1 }}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 200 }}>
            <Text style={{ color: TG.textSecondary, fontSize: 16 }}>Group not found</Text>
          </View>
        </Animated.ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.safeArea}>
      {/* Parallax scroll */}
      <Animated.ScrollView
        ref={scrollRef}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Parallax hero image */}
        <Animated.View style={[styles.heroWrap, headerAnimStyle]}>
          {group.avatarUrl ? (
            <Image source={{ uri: group.avatarUrl }} style={styles.heroImage} />
          ) : (
            <View style={styles.heroFallback}>
              <Users size={64} color={TG.accent} strokeWidth={1.2} />
            </View>
          )}
          <View style={styles.heroOverlay} />
        </Animated.View>

        {/* Info section */}
        <View style={styles.infoSection}>
          <Text style={styles.groupName}>{group.name}</Text>
          {group.description ? (
            <Text style={styles.groupDesc}>{group.description}</Text>
          ) : null}
        </View>

        {/* Members list */}
        <View style={styles.membersSection}>
          <Text style={styles.membersTitle}>Members</Text>
          <View style={styles.membersList}>
          {members.map((m, idx) => (
            <React.Fragment key={m.id}>
            <TouchableOpacity
              style={styles.memberRow}
              activeOpacity={0.7}
              onLongPress={() => {
                if (isOwnerOrTeacher && m.userId !== user?.id && m.role === 'student') {
                  handleRemoveMember(m);
                }
              }}
              delayLongPress={400}
              onPress={() => {
                if (m.user?.id) {
                  router.push(`/user/${m.user.id}` as any);
                }
              }}
            >
              <View style={styles.memberAvatar}>
                {m.user?.avatarUrl ? (
                  <Image source={{ uri: m.user.avatarUrl }} style={styles.memberAvatarImage} />
                ) : (
                  <Text style={styles.memberAvatarText}>
                    {(m.user?.fullName || '?').charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName} numberOfLines={1}>{m.user?.fullName}</Text>
                <Text style={styles.memberUsername}>@{m.user?.username}</Text>
              </View>
              {removingId === m.id && (
                <ActivityIndicator size="small" color={TG.red} />
              )}
              {removingId !== m.id && roleBadge(m.role)}
            </TouchableOpacity>
            {idx < members.length - 1 && <View style={styles.memberSep} />}
            </React.Fragment>
          ))}
          </View>
          {members.length === 0 && (
            <View style={styles.emptyContainer}>
              <Users size={40} color={TG.separator} />
              <Text style={styles.emptyText}>No members yet</Text>
            </View>
          )}
        </View>
      </Animated.ScrollView>

      {/* Floating back + share buttons */}
      <SafeAreaView style={styles.floatingHeader} edges={['top']}>
        <TouchableOpacity
          style={styles.floatingBackBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ArrowLeft size={22} color={TG.textWhite} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.floatingBackBtn}
          onPress={() => setShareModalVisible(true)}
          activeOpacity={0.7}
        >
          <Share2 size={20} color={TG.textWhite} />
        </TouchableOpacity>
      </SafeAreaView>

      {/* Share modal */}
      <Modal
        visible={shareModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setShareModalVisible(false)}
      >
        <Pressable
          style={styles.shareOverlay}
          onPress={() => setShareModalVisible(false)}
        >
          <View style={styles.shareCard}>
            <Text style={styles.shareTitle}>Share Code</Text>
            <Text style={styles.shareCode}>{group.referralCode}</Text>
            <TouchableOpacity
              style={styles.shareCopyBtn}
              activeOpacity={0.7}
              onPress={() => {
                handleCopyCode();
                setShareModalVisible(false);
              }}
            >
              <ClipboardCopy size={18} color="#fff" />
              <Text style={styles.shareCopyText}>Copy Code</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: TG.bg },

  /* Parallax hero */
  heroWrap: {
    height: HEADER_HEIGHT,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  heroFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: TG.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },

  /* Floating back */
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  floatingBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Info section */
  infoSection: {
    padding: 16,
    backgroundColor: TG.bg,
  },
  groupName: {
    fontSize: 22,
    fontWeight: '800',
    color: TG.textPrimary,
    marginBottom: 6,
  },
  groupDesc: {
    fontSize: 15,
    color: TG.textSecondary,
    lineHeight: 22,
    marginBottom: 8,
  },
  codeLabel: {
    fontSize: 12,
    color: TG.textHint,
    fontWeight: '600',
    marginBottom: 2,
  },
  codeValue: {
    fontSize: 18,
    fontWeight: '800',
    color: TG.accent,
    letterSpacing: 1,
  },

  /* Share modal */
  shareOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareCard: {
    backgroundColor: TG.bg,
    borderRadius: 18,
    paddingVertical: 28,
    paddingHorizontal: 32,
    alignItems: 'center',
    width: 260,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  shareTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: TG.textHint,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  shareCode: {
    fontSize: 28,
    fontWeight: '900',
    color: TG.accent,
    letterSpacing: 2,
  },
  shareCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: TG.accent,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 4,
  },
  shareCopyText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },

  /* Members */
  membersSection: {
    paddingTop: 8,
  },
  membersTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: TG.accent,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  membersList: {
    backgroundColor: TG.bg,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  memberAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: TG.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  memberAvatarText: { fontSize: 20, fontWeight: '700', color: TG.accent },
  memberName: { fontSize: 16, fontWeight: '600', color: TG.textPrimary },
  memberUsername: { fontSize: 14, color: TG.textSecondary, marginTop: 1 },
  memberSep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: TG.separatorLight,
    marginLeft: 80,
  },
  roleLabel: {
    fontSize: 13,
    fontWeight: '600',
  },

  emptyContainer: { alignItems: 'center', marginTop: 40, gap: 12 },
  emptyText: { color: TG.textSecondary, fontSize: 15 },
});
