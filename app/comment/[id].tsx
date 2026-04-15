import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import { apiCommentOnSession, apiDeleteComment, apiEditComment, apiFetchSessionComments } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, MessageCircle, Pencil, Send, Trash2, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

interface Comment {
  id: string;
  text: string;
  createdAt: string;
  isEdited?: boolean;
  isDeleted?: boolean;
  user: {
    id: string;
    fullName: string;
    username: string;
    avatarUrl: string | null;
  };
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000 && d.getDate() === now.getDate()) return 'Today';
  if (diff < 172800000) return 'Yesterday';
  return d.toLocaleDateString([], { day: 'numeric', month: 'long' });
}

function isSameDay(a: string, b: string) {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

export default function CommentsScreen() {
  const { id: sessionId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();

  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [editingComment, setEditingComment] = useState<Comment | null>(null);
  const [selectedComment, setSelectedComment] = useState<Comment | null>(null);

  const inputRef = useRef<TextInput>(null);
  const flatListRef = useRef<FlatList>(null);

  const loadComments = useCallback(
    async (p = 1, append = false) => {
      if (!sessionId) return;
      if (p === 1) setLoading(true);
      else setLoadingMore(true);
      try {
        const result = await apiFetchSessionComments(sessionId, p);
        const items: Comment[] = result.data || [];
        if (append) {
          setComments((prev) => [...prev, ...items]);
        } else {
          setComments(items);
        }
        setHasMore(p < (result.pagination?.totalPages ?? 1));
        setPage(p);
      } catch (e: any) {
        toast.error('Error', e.message || 'Failed to load comments');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [sessionId],
  );

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      loadComments(page + 1, true);
    }
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || !sessionId) return;
    setSending(true);
    try {
      if (editingComment) {
        await apiEditComment(editingComment.id, trimmed);
        setComments((prev) =>
          prev.map((c) => (c.id === editingComment.id ? { ...c, text: trimmed, isEdited: true } : c)),
        );
        setEditingComment(null);
      } else {
        const result = await apiCommentOnSession(sessionId, trimmed);
        const newComment: Comment = result.comment ?? result;
        setComments((prev) => [newComment, ...prev]);
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }
      setText('');
    } catch (e: any) {
      toast.error('Error', e.message || 'Failed to post comment');
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (comment: Comment) => {
    try {
      await apiDeleteComment(comment.id);
      setComments((prev) => prev.filter((c) => c.id !== comment.id));
    } catch (e: any) {
      toast.error('Error', e.message || 'Failed to delete comment');
    }
    setSelectedComment(null);
  };

  const handleEdit = (comment: Comment) => {
    setEditingComment(comment);
    setText(comment.text || '');
    setSelectedComment(null);
    inputRef.current?.focus();
  };

  const renderComment = useCallback(
    ({ item, index }: { item: Comment; index: number }) => {
      const isMine = item.user?.id === user?.id;
      const nextItem = comments[index + 1];
      const showDate = !nextItem || !isSameDay(item.createdAt, nextItem.createdAt);
      const showSender =
        !isMine &&
        (!nextItem ||
          nextItem.user?.id !== item.user?.id ||
          !isSameDay(item.createdAt, nextItem.createdAt));

      return (
        <>
          {showDate && (
            <View style={styles.dateLabel}>
              <Text style={styles.dateLabelText}>{formatDateLabel(item.createdAt)}</Text>
            </View>
          )}
          <View style={[styles.bubbleRow, isMine ? styles.bubbleRowRight : styles.bubbleRowLeft]}>
            <Pressable onPress={() => setSelectedComment(item)} style={{ flexDirection: 'row' }}>
              {!isMine && showSender && (
                <View style={styles.senderAvatar}>
                  {item.user?.avatarUrl ? (
                    <Image source={{ uri: item.user.avatarUrl }} style={styles.senderAvatarImg} />
                  ) : (
                    <Text style={styles.senderAvatarText}>
                      {(item.user?.fullName || '?').charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>
              )}
              {!isMine && !showSender && <View style={{ width: 34 }} />}

              <View style={[styles.bubble, isMine ? styles.bubbleOut : styles.bubbleIn]}>
                {!isMine && showSender && (
                  <Text style={styles.senderName}>{item.user?.fullName || 'Unknown'}</Text>
                )}

                {item.isDeleted ? (
                  <Text style={styles.deletedText}>Comment deleted</Text>
                ) : (
                  <Text style={styles.msgText}>{item.text}</Text>
                )}
                <View style={styles.timeRow}>
                  {item.isEdited && <Text style={styles.editedLabel}>edited</Text>}
                  <Text style={styles.timeText}>{formatTime(item.createdAt)}</Text>
                </View>
              </View>
            </Pressable>
          </View>
        </>
      );
    },
    [comments, user?.id],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={22} color={TG.textWhite} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Comments</Text>
          {comments.length > 0 && (
            <Text style={styles.headerSub}>
              {comments.length} comment{comments.length !== 1 ? 's' : ''}
            </Text>
          )}
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={TG.accent} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={comments}
            inverted
            keyExtractor={(item) => item.id}
            renderItem={renderComment}
            style={styles.messageList}
            contentContainerStyle={{ paddingVertical: 8, paddingHorizontal: 6, flexGrow: 1 }}
            onEndReached={loadMore}
            onEndReachedThreshold={0.3}
            ListFooterComponent={
              loadingMore ? (
                <ActivityIndicator style={{ paddingVertical: 16 }} color={TG.accent} />
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <MessageCircle size={40} color={TG.separator} />
                <Text style={styles.emptyChatText}>No comments yet</Text>
                <Text style={styles.emptyChatSub}>Be the first to comment!</Text>
              </View>
            }
          />
        )}

        {/* Edit banner */}
        {editingComment && (
          <View style={styles.editBanner}>
            <View style={styles.editBannerLine} />
            <View style={{ flex: 1 }}>
              <Text style={styles.editBannerTitle}>Editing</Text>
              <Text style={styles.editBannerText} numberOfLines={1}>
                {editingComment.text || ''}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setEditingComment(null);
                setText('');
              }}
            >
              <X size={20} color={TG.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Input bar */}
        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Write a comment..."
            placeholderTextColor={TG.textHint}
            multiline
            maxLength={2000}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.5 }]}
            onPress={handleSend}
            disabled={!text.trim() || sending}
            activeOpacity={0.7}
          >
            {sending ? (
              <ActivityIndicator size={18} color={TG.textWhite} />
            ) : (
              <Send size={18} color={TG.textWhite} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Action card overlay */}
      {selectedComment && (
        <Pressable style={styles.actionOverlay} onPress={() => setSelectedComment(null)}>
          <View style={styles.actionCard}>
            <View style={styles.actionPreview}>
              <View style={styles.actionPreviewLine} />
              <View style={{ flex: 1 }}>
                <Text style={styles.actionPreviewName} numberOfLines={1}>
                  {selectedComment.user.fullName}
                </Text>
                <Text style={styles.actionPreviewText} numberOfLines={2}>
                  {selectedComment.isDeleted ? 'Comment deleted' : selectedComment.text}
                </Text>
              </View>
            </View>
            <View style={styles.actionDivider} />
            {selectedComment.user?.id === user?.id && !selectedComment.isDeleted && (
              <TouchableOpacity style={styles.actionItem} onPress={() => handleEdit(selectedComment)} activeOpacity={0.7}>
                <Pencil size={20} color={TG.accent} />
                <Text style={styles.actionText}>Edit</Text>
              </TouchableOpacity>
            )}
            {selectedComment.user?.id === user?.id && !selectedComment.isDeleted && (
              <TouchableOpacity style={styles.actionItem} onPress={() => handleDelete(selectedComment)} activeOpacity={0.7}>
                <Trash2 size={20} color={TG.red} />
                <Text style={[styles.actionText, { color: TG.red }]}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TG.bgChat },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TG.headerBg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: TG.textWhite },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Messages
  messageList: { flex: 1, backgroundColor: TG.bgChat },

  dateLabel: { alignSelf: 'center', marginVertical: 8 },
  dateLabelText: {
    fontSize: 12,
    color: TG.textWhite,
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: 'hidden',
  },

  bubbleRow: { maxWidth: '85%', marginBottom: 2, flexDirection: 'row' },
  bubbleRowLeft: { alignSelf: 'flex-start' },
  bubbleRowRight: { alignSelf: 'flex-end' },

  senderAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: TG.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
    alignSelf: 'flex-end',
  },
  senderAvatarImg: { width: 34, height: 34, borderRadius: 17 },
  senderAvatarText: { fontSize: 13, fontWeight: '700', color: TG.accent },

  bubble: {
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 4,
    minWidth: 80,
  },
  bubbleOut: {
    backgroundColor: TG.bubbleOutgoing,
    borderBottomRightRadius: 4,
  },
  bubbleIn: {
    backgroundColor: TG.bubbleIncoming,
    borderBottomLeftRadius: 4,
  },

  senderName: {
    fontSize: 13,
    fontWeight: '700',
    color: TG.accent,
    marginBottom: 2,
  },

  msgText: { fontSize: 15, color: TG.textPrimary, lineHeight: 21 },

  deletedText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: TG.textHint,
    paddingVertical: 2,
  },

  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
    marginTop: 2,
  },
  timeText: { fontSize: 11, color: TG.textHint },
  editedLabel: { fontSize: 11, color: TG.textHint, fontStyle: 'italic' },

  // Empty
  emptyChat: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: 8,
  },
  emptyChatText: { fontSize: 16, fontWeight: '600', color: TG.textSecondary },
  emptyChatSub: { fontSize: 14, color: TG.textHint },

  // Input
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: TG.bg,
    paddingHorizontal: 8,
    paddingTop: 6,
    gap: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: TG.separator,
  },
  input: {
    flex: 1,
    backgroundColor: TG.bgSecondary,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15,
    color: TG.textPrimary,
    maxHeight: 120,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: TG.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Edit banner
  editBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TG.bg,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: TG.separator,
  },
  editBannerLine: {
    width: 3,
    height: '100%',
    backgroundColor: TG.accent,
    borderRadius: 2,
  },
  editBannerTitle: { fontSize: 13, fontWeight: '700', color: TG.accent },
  editBannerText: { fontSize: 13, color: TG.textSecondary },

  // Action card
  actionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionCard: {
    backgroundColor: TG.bg,
    borderRadius: 16,
    width: 220,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
      },
      android: { elevation: 12 },
    }),
  },
  actionPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  actionPreviewLine: {
    width: 3,
    height: 32,
    backgroundColor: TG.accent,
    borderRadius: 2,
  },
  actionPreviewName: { fontSize: 13, fontWeight: '700', color: TG.accent },
  actionPreviewText: { fontSize: 13, color: TG.textSecondary },
  actionDivider: { height: StyleSheet.hairlineWidth, backgroundColor: TG.separator },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  actionText: { fontSize: 15, color: TG.textPrimary },
});
