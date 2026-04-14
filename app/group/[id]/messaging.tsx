import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import {
    ChatAttachment,
    ChatMessage,
    deleteMessage,
    editMessage,
    useGroupChat,
} from '@/lib/chat';
import { fetchGroupById, Group } from '@/lib/groups';
import { useAuth } from '@/store/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    RecordingPresets,
    requestRecordingPermissionsAsync,
    setIsAudioActiveAsync,
    useAudioRecorder,
    useAudioRecorderState,
} from 'expo-audio';
import { File as ExpoFile, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
    ArrowLeft,
    CheckCheck,
    CornerUpLeft,
    Download,
    File,
    Image as ImageIcon,
    MessageSquare,
    Mic,
    Pencil,
    Play,
    Send,
    Trash2,
    Video,
    X
} from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

const SWIPE_THRESHOLD = -60;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const MEDIA_W = 220;
const MEDIA_H = 180;

// ─── Circular progress ───────────────────────────────────
function CircularProgress({ progress, size = 48 }: { progress: number; size?: number }) {
  const stroke = 3;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ * (1 - progress);
  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="rgba(255,255,255,0.3)"
        strokeWidth={stroke}
        fill="none"
      />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="#fff"
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={`${circ} ${circ}`}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
      />
    </Svg>
  );
}

const MEDIA_CACHE_PREFIX = 'media_dl_';

// ─── MediaThumb (image/video in bubble) ──────────────────
function MediaThumb({
  att,
  onView,
}: {
  att: ChatAttachment;
  onView: (att: ChatAttachment) => void;
}) {
  const isVideo = att.mimeType.startsWith('video/');
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [downloading, setDownloading] = useState(false);

  // Restore cached URI on mount
  useEffect(() => {
    AsyncStorage.getItem(MEDIA_CACHE_PREFIX + att.id).then((uri) => {
      if (uri) {
        // Verify file still exists
        const file = new ExpoFile(uri);
        if (file.exists) {
          setLocalUri(uri);
        } else {
          AsyncStorage.removeItem(MEDIA_CACHE_PREFIX + att.id);
        }
      }
    });
  }, [att.id]);

  // For video, create inline player once downloaded
  const player = useVideoPlayer(isVideo && localUri ? localUri : null, (p) => {
    p.loop = true;
    p.muted = true;
    if (localUri) p.play();
  });

  const startDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const ext = att.fileName.split('.').pop() || (isVideo ? 'mp4' : 'jpg');
      const destFile = new ExpoFile(Paths.cache, `${att.id}.${ext}`);

      // Use XMLHttpRequest for progress tracking
      const uri: string = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', att.url, true);
        xhr.responseType = 'blob';
        xhr.onprogress = (e) => {
          if (e.lengthComputable && e.total > 0) {
            setProgress(e.loaded / e.total);
          }
        };
        xhr.onload = async () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            const blob = xhr.response as Blob;
            const reader = new FileReader();
            reader.onloadend = async () => {
              const base64 = (reader.result as string).split(',')[1];
              await destFile.write(base64, { encoding: 'base64' });
              resolve(destFile.uri);
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
          } else {
            reject(new Error(`Download failed: ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send();
      });
      setLocalUri(uri);
      await AsyncStorage.setItem(MEDIA_CACHE_PREFIX + att.id, uri);
    } catch {
      /* ignore */
    } finally {
      setDownloading(false);
    }
  };

  const fileSizeLabel = att.fileSize
    ? att.fileSize > 1024 * 1024
      ? `${(att.fileSize / (1024 * 1024)).toFixed(1)} MB`
      : `${(att.fileSize / 1024).toFixed(0)} KB`
    : '';

  // ── Video with download / autoplay ──
  if (isVideo) {
    if (localUri) {
      return (
        <Pressable onPress={() => onView(att)} style={styles.mediaTouchable}>
          <VideoView
            player={player}
            style={styles.mediaThumb}
            nativeControls={false}
            contentFit="cover"
          />
          {/* play icon overlay */}
          <View style={styles.mediaPlayOverlay}>
            <Play size={32} color="#fff" fill="#fff" />
          </View>
        </Pressable>
      );
    }
    // Not downloaded yet → thumbnail placeholder
    return (
      <View style={[styles.mediaThumb, styles.mediaPlaceholder]}>
        <Video size={28} color="rgba(255,255,255,0.8)" />
        {fileSizeLabel ? <Text style={styles.mediaSizeLabel}>{fileSizeLabel}</Text> : null}
        <Pressable onPress={startDownload} style={styles.mediaDownloadBtn}>
          {downloading ? (
            <CircularProgress progress={progress} size={48} />
          ) : (
            <View style={styles.mediaDownloadCircle}>
              <Download size={22} color="#fff" />
            </View>
          )}
        </Pressable>
      </View>
    );
  }

  // ── Image with download / preview ──
  if (localUri) {
    return (
      <Pressable onPress={() => onView({ ...att, url: localUri })} style={styles.mediaTouchable}>
        <Image source={{ uri: localUri }} style={styles.mediaThumb} resizeMode="cover" />
      </Pressable>
    );
  }
  // Not downloaded
  return (
    <View style={styles.mediaTouchable}>
      <Image source={{ uri: att.url }} style={[styles.mediaThumb, { opacity: 0.45 }]} resizeMode="cover" blurRadius={8} />
      <Pressable onPress={startDownload} style={styles.mediaDownloadBtn}>
        {downloading ? (
          <CircularProgress progress={progress} size={48} />
        ) : (
          <View style={styles.mediaDownloadCircle}>
            <Download size={22} color="#fff" />
          </View>
        )}
      </Pressable>
    </View>
  );
}

// ─── Full-screen media viewer ────────────────────────────
function MediaViewer({
  att,
  visible,
  onClose,
}: {
  att: ChatAttachment | null;
  visible: boolean;
  onClose: () => void;
}) {
  const isVideo = att?.mimeType.startsWith('video/');
  const player = useVideoPlayer(isVideo && att ? att.url : null, (p) => {
    p.loop = false;
    if (att) p.play();
  });

  if (!att) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={mStyles.backdrop}>
        <Pressable style={mStyles.closeArea} onPress={onClose} />
        <SafeAreaView style={mStyles.safeWrap} edges={['top', 'bottom']}>
          {/* Close button */}
          <TouchableOpacity style={mStyles.closeBtn} onPress={onClose}>
            <X size={26} color="#fff" />
          </TouchableOpacity>

          {isVideo ? (
            <VideoView
              player={player}
              style={mStyles.fullMedia}
              nativeControls
              contentFit="contain"
            />
          ) : (
            <Image
              source={{ uri: att.url }}
              style={mStyles.fullMedia}
              resizeMode="contain"
            />
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const mStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#000',
  },
  closeArea: { ...StyleSheet.absoluteFillObject },
  safeWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 16,
    zIndex: 10,
    padding: 8,
  },
  fullMedia: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});

// ─── Helpers ──────────────────────────────────────────────
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
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
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

function formatRecordingTime(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function GroupMessagingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();

  const [group, setGroup] = useState<Group | null>(null);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingMsg, setEditingMsg] = useState<ChatMessage | null>(null);
  const [selectedMsg, setSelectedMsg] = useState<ChatMessage | null>(null);
  const [sending, setSending] = useState(false);
  const [viewerAtt, setViewerAtt] = useState<ChatAttachment | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 200);
  const inputRef = useRef<TextInput>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const {
    messages,
    typingUsers,
    hasMore,
    loadingMore,
    connected,
    loadMessages,
    sendText: sendChatText,
    sendFiles,
    sendTyping,
    markRead,
  } = useGroupChat(id!);

  // Load group info
  useEffect(() => {
    if (id) fetchGroupById(id).then(setGroup).catch(console.error);
  }, [id]);

  // Load initial messages
  useEffect(() => {
    loadMessages();
  }, []);

  // Mark read on new messages
  useEffect(() => {
    if (messages.length > 0) {
      markRead(messages[0].id);
    }
  }, [messages[0]?.id]);

  // Typing handler
  const handleTextChange = (val: string) => {
    setText(val);
    sendTyping(true);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => sendTyping(false), 2000);
  };

  // Send
  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed && !editingMsg) return;
    setSending(true);
    try {
      if (editingMsg) {
        await editMessage(id!, editingMsg.id, trimmed);
        setEditingMsg(null);
      } else {
        await sendChatText(trimmed, replyTo?.id);
        setReplyTo(null);
      }
      setText('');
      sendTyping(false);
    } catch (e: any) {
      toast.error('Error', e.message);
    } finally {
      setSending(false);
    }
  };

  // Pick images
  const handlePickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return;
    setSending(true);
    try {
      const files = result.assets.map((a) => ({
        uri: a.uri,
        name: `photo.${a.uri.split('.').pop() || 'jpg'}`,
        type: a.mimeType || `image/${a.uri.split('.').pop() || 'jpg'}`,
      }));
      await sendFiles(files, text.trim() || undefined);
      setText('');
    } catch (e: any) {
      toast.error('Error', e.message);
    } finally {
      setSending(false);
    }
  };

  // Pick document
  const handlePickDoc = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return;
    setSending(true);
    try {
      const files = result.assets.map((a: ImagePicker.ImagePickerAsset) => ({
        uri: a.uri,
        name: `file.${a.uri.split('.').pop() || 'bin'}`,
        type: a.mimeType || 'application/octet-stream',
      }));
      await sendFiles(files);
    } catch (e: any) {
      toast.error('Error', e.message);
    } finally {
      setSending(false);
    }
  };

  // Audio recording
  const handleStartRecording = async () => {
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        if (perm.canAskAgain === false) {
          toast.error('Permission blocked', 'Please enable microphone in system Settings.');
        } else {
          toast.error('Permission denied', 'Microphone access is required.');
        }
        return;
      }
      await setIsAudioActiveAsync(true);
      recorder.record();
      setIsRecording(true);
    } catch (e: any) {
      toast.error('Recording Error', e.message);
    }
  };

  const handleCancelRecording = async () => {
    try {
      await recorder.stop();
    } catch { /* ignore */ }
    setIsRecording(false);
  };

  const handleSendRecording = async () => {
    setSending(true);
    try {
      await recorder.stop();
      // uri may be on the recorder or the state; wait briefly for it
      let uri = recorder.uri;
      if (!uri) {
        uri = await new Promise<string>((resolve, reject) => {
          let attempts = 0;
          const check = setInterval(() => {
            attempts++;
            if (recorder.uri) {
              clearInterval(check);
              resolve(recorder.uri);
            } else if (attempts > 20) {
              clearInterval(check);
              reject(new Error('Recording URI not found'));
            }
          }, 50);
        });
      }
      // Copy to persistent storage
      const fileName = `voice_${Date.now()}.m4a`;
      const src = new ExpoFile(uri);
      const dest = new ExpoFile(Paths.cache, fileName);
      src.copy(dest);
      const files = [{
        uri: dest.uri,
        name: fileName,
        type: 'audio/m4a',
      }];
      await sendFiles(files);
      setReplyTo(null);
    } catch (e: any) {
      toast.error('Error', e.message);
    } finally {
      setSending(false);
      setIsRecording(false);
    }
  };

  // Message actions
  const handleDelete = async (msg: ChatMessage) => {
    try {
      await deleteMessage(id!, msg.id);
    } catch (e: any) {
      toast.error('Error', e.message);
    }
    setSelectedMsg(null);
  };

  const handleReply = (msg: ChatMessage) => {
    setReplyTo(msg);
    setSelectedMsg(null);
    inputRef.current?.focus();
  };

  const handleEdit = (msg: ChatMessage) => {
    setEditingMsg(msg);
    setText(msg.text || '');
    setSelectedMsg(null);
    inputRef.current?.focus();
  };

  // ─── Swipeable Bubble ──────────────────────────────────
  const SwipeableBubble = useCallback(
    ({ msg, isMine, showSender, showDate }: {
      msg: ChatMessage; isMine: boolean; showSender: boolean; showDate: boolean;
    }) => {
      const translateX = useSharedValue(0);
      const replyOpacity = useSharedValue(0);

      const onSwipeReply = useCallback(() => {
        handleReply(msg);
      }, [msg]);

      const pan = Gesture.Pan()
        .activeOffsetX([-15, 15])
        .failOffsetY([-10, 10])
        .onUpdate((e) => {
          if (e.translationX < 0) {
            translateX.value = Math.max(e.translationX, -80);
            replyOpacity.value = Math.min(Math.abs(e.translationX) / 60, 1);
          }
        })
        .onEnd(() => {
          if (translateX.value < SWIPE_THRESHOLD) {
            runOnJS(onSwipeReply)();
          }
          translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
          replyOpacity.value = withTiming(0, { duration: 200 });
        });

      const animRow = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
      }));

      const animReplyIcon = useAnimatedStyle(() => ({
        opacity: replyOpacity.value,
        transform: [
          { scale: 0.6 + replyOpacity.value * 0.4 },
        ],
      }));

      return (
        <>
          {showDate && (
            <View style={styles.dateLabel}>
              <Text style={styles.dateLabelText}>
                {formatDateLabel(msg.createdAt)}
              </Text>
            </View>
          )}
          <View style={[
            styles.swipeContainer,
            isMine ? styles.bubbleRowRight : styles.bubbleRowLeft,
          ]}>
            {/* Reply icon revealed behind */}
            <Animated.View style={[
              styles.swipeReplyIcon,
              isMine ? { right: -6 } : { right: -6 },
              animReplyIcon,
            ]}>
              <CornerUpLeft size={20} color={TG.accent} />
            </Animated.View>

            <GestureDetector gesture={pan}>
              <Animated.View style={[styles.bubbleRow, animRow]}>
                <Pressable
                  onPress={() => setSelectedMsg(msg)}
                  style={{ flexDirection: 'row' }}
                >
                  {!isMine && showSender && (
                    <View style={styles.senderAvatar}>
                      {msg.sender.avatarUrl ? (
                        <Image
                          source={{ uri: msg.sender.avatarUrl }}
                          style={styles.senderAvatarImg}
                        />
                      ) : (
                        <Text style={styles.senderAvatarText}>
                          {msg.sender.fullName.charAt(0).toUpperCase()}
                        </Text>
                      )}
                    </View>
                  )}
                  {!isMine && !showSender && <View style={{ width: 34 }} />}

                  <View
                    style={[
                      styles.bubble,
                      isMine ? styles.bubbleOut : styles.bubbleIn,
                    ]}
                  >
                    {!isMine && showSender && (
                      <Text style={styles.senderName}>{msg.sender.fullName}</Text>
                    )}

                    {/* Reply */}
                    {msg.replyTo && (
                      <View style={styles.replyBar}>
                        <Text style={styles.replyName} numberOfLines={1}>
                          {msg.replyTo.sender.fullName}
                        </Text>
                        <Text style={styles.replyText} numberOfLines={1}>
                          {msg.replyTo.text || `[${msg.replyTo.type}]`}
                        </Text>
                      </View>
                    )}

                    {/* Deleted */}
                    {msg.isDeleted ? (
                      <Text style={styles.deletedText}>Message deleted</Text>
                    ) : (
                      <>
                        {/* Attachments */}
                        {msg.attachments?.length > 0 && (
                          <View style={styles.attachments}>
                            {msg.attachments.map((att) => {
                              const ext = att.fileName?.split('.').pop()?.toLowerCase() || '';
                              const isMedia =
                                att.mimeType.startsWith('image/') ||
                                att.mimeType.startsWith('video/') ||
                                ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext) ||
                                ['mp4', 'mov', 'avi', 'mkv', 'webm', '3gp'].includes(ext);
                              const isImageExt = att.mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext);
                              if (isMedia) {
                                // Force correct mimeType for extension-detected media
                                const fixedAtt = { ...att };
                                if (!fixedAtt.mimeType.startsWith('image/') && !fixedAtt.mimeType.startsWith('video/')) {
                                  fixedAtt.mimeType = isImageExt ? `image/${ext === 'jpg' ? 'jpeg' : ext}` : `video/${ext}`;
                                }
                                return (
                                  <MediaThumb
                                    key={att.id}
                                    att={fixedAtt}
                                    onView={(a) => {
                                      setViewerAtt(a);
                                      setViewerOpen(true);
                                    }}
                                  />
                                );
                              }
                              const sizeLabel = att.fileSize
                                ? att.fileSize > 1024 * 1024
                                  ? `${(att.fileSize / (1024 * 1024)).toFixed(1)} MB`
                                  : `${(att.fileSize / 1024).toFixed(1)} KB`
                                : '';
                              return (
                                <View key={att.id} style={styles.attachFile}>
                                  <View style={styles.attachFileIcon}>
                                    <File size={20} color={TG.accent} />
                                  </View>
                                  <View style={{ flex: 1 }}>
                                    <Text style={styles.attachFileName} numberOfLines={1}>
                                      {att.fileName}
                                    </Text>
                                    {sizeLabel ? (
                                      <Text style={styles.attachFileSize}>{sizeLabel}</Text>
                                    ) : null}
                                  </View>
                                </View>
                              );
                            })}
                          </View>
                        )}

                        {/* Text */}
                        {msg.text && <Text style={styles.msgText}>{msg.text}</Text>}
                      </>
                    )}

                    {/* Time + edited */}
                    <View style={styles.timeRow}>
                      {msg.isEdited && (
                        <Text style={styles.editedLabel}>edited</Text>
                      )}
                      <Text style={styles.timeText}>{formatTime(msg.createdAt)}</Text>
                      {isMine && (
                        <CheckCheck size={14} color={TG.accent} style={{ marginLeft: 2 }} />
                      )}
                    </View>
                  </View>
                </Pressable>
              </Animated.View>
            </GestureDetector>
          </View>
        </>
      );
    },
    [user?.id],
  );

  // ─── Render item ────────────────────────────────────────
  const renderMessage = useCallback(
    ({ item: msg, index }: { item: ChatMessage; index: number }) => {
      const isMine = msg.senderId === user?.id;
      const nextMsg = messages[index + 1];
      const showDate =
        !nextMsg || !isSameDay(msg.createdAt, nextMsg.createdAt);
      const showSender =
        !isMine &&
        (!nextMsg ||
          nextMsg.senderId !== msg.senderId ||
          !isSameDay(msg.createdAt, nextMsg.createdAt));

      return (
        <SwipeableBubble
          msg={msg}
          isMine={isMine}
          showSender={showSender}
          showDate={showDate}
        />
      );
    },
    [messages, user?.id, SwipeableBubble],
  );

  // ─── Typing bar ─────────────────────────────────────────
  const typingArr = [...typingUsers.values()].filter(
    (u) => u !== user?.username,
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <ArrowLeft size={22} color={TG.textWhite} />
        </TouchableOpacity>
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={0.7}
          onPress={() => router.push(`/group/${id}/detail` as any)}
        >
          <Text style={styles.headerTitle} numberOfLines={1}>
            Messaging
          </Text>
          <Text style={styles.headerSub}>
            {typingArr.length > 0
              ? `${typingArr.join(', ')} typing...`
              : connected
                ? `${group?.member_count ?? ''} members`
                : 'connecting...'}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          inverted
          keyExtractor={(m) => m.id}
          renderItem={renderMessage}
          style={styles.messageList}
          contentContainerStyle={{ paddingVertical: 8, paddingHorizontal: 6 }}
          onEndReached={() => hasMore && !loadingMore && loadMessages()}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator
                style={{ paddingVertical: 16 }}
                color={TG.accent}
              />
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <MessageSquare size={40} color={TG.separator} />
              <Text style={styles.emptyChatText}>No messages yet</Text>
              <Text style={styles.emptyChatSub}>
                Say hello to the group!
              </Text>
            </View>
          }
        />

        {/* Reply / Edit banner */}
        {(replyTo || editingMsg) && (
          <View style={styles.replyBanner}>
            <View style={styles.replyBannerLine} />
            <View style={{ flex: 1 }}>
              <Text style={styles.replyBannerTitle}>
                {editingMsg ? 'Editing' : `Reply to ${replyTo?.sender.fullName}`}
              </Text>
              <Text style={styles.replyBannerText} numberOfLines={1}>
                {(editingMsg || replyTo)?.text || '[attachment]'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setReplyTo(null);
                setEditingMsg(null);
                setText('');
              }}
            >
              <X size={20} color={TG.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Input bar */}
        {isRecording ? (
          /* Recording bar */
          <View style={[styles.inputBar, styles.recordingBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
            <TouchableOpacity
              style={styles.inputIcon}
              onPress={handleCancelRecording}
              activeOpacity={0.7}
            >
              <Trash2 size={22} color={TG.red} />
            </TouchableOpacity>
            <View style={styles.recordingInfo}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingTime}>
                {formatRecordingTime(recorderState.durationMillis)}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.sendBtn}
              onPress={handleSendRecording}
              activeOpacity={0.7}
              disabled={sending}
            >
              {sending ? (
                <ActivityIndicator size={18} color={TG.textWhite} />
              ) : (
                <Send size={18} color={TG.textWhite} />
              )}
            </TouchableOpacity>
          </View>
        ) : (
        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <TouchableOpacity
            style={styles.inputIcon}
            onPress={handlePickImages}
            activeOpacity={0.7}
          >
            <ImageIcon size={22} color={TG.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.inputIcon}
            onPress={handlePickDoc}
            activeOpacity={0.7}
          >
            <Video size={22} color={TG.textSecondary} />
          </TouchableOpacity>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={text}
            onChangeText={handleTextChange}
            placeholder="Message"
            placeholderTextColor={TG.textHint}
            multiline
            maxLength={4000}
          />
          {text.trim() || editingMsg ? (
            <TouchableOpacity
              style={styles.sendBtn}
              onPress={handleSend}
              disabled={(!text.trim() && !editingMsg) || sending}
              activeOpacity={0.7}
            >
              {sending ? (
                <ActivityIndicator size={18} color={TG.textWhite} />
              ) : (
                <Send size={18} color={TG.textWhite} />
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.micBtn}
              onPress={handleStartRecording}
              activeOpacity={0.7}
            >
              <Mic size={22} color={TG.accent} />
            </TouchableOpacity>
          )}
        </View>
        )}
      </KeyboardAvoidingView>

      {/* Message action card */}
      {selectedMsg && (
        <Pressable
          style={styles.actionOverlay}
          onPress={() => setSelectedMsg(null)}
        >
          <View style={styles.actionCard}>
            {/* Preview snippet */}
            <View style={styles.actionPreview}>
              <View style={styles.actionPreviewLine} />
              <View style={{ flex: 1 }}>
                <Text style={styles.actionPreviewName} numberOfLines={1}>
                  {selectedMsg.sender.fullName}
                </Text>
                <Text style={styles.actionPreviewText} numberOfLines={2}>
                  {selectedMsg.isDeleted
                    ? 'Message deleted'
                    : selectedMsg.text || '[attachment]'}
                </Text>
              </View>
            </View>

            <View style={styles.actionDivider} />

            {/* Actions */}
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => handleReply(selectedMsg)}
              activeOpacity={0.7}
            >
              <CornerUpLeft size={20} color={TG.accent} />
              <Text style={styles.actionText}>Reply</Text>
            </TouchableOpacity>
            {selectedMsg.senderId === user?.id && !selectedMsg.isDeleted && (
              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => handleEdit(selectedMsg)}
                activeOpacity={0.7}
              >
                <Pencil size={20} color={TG.accent} />
                <Text style={styles.actionText}>Edit</Text>
              </TouchableOpacity>
            )}
            {(selectedMsg.senderId === user?.id ||
              group?.myRole === 'owner' ||
              group?.myRole === 'teacher') &&
              !selectedMsg.isDeleted && (
                <TouchableOpacity
                  style={styles.actionItem}
                  onPress={() => handleDelete(selectedMsg)}
                  activeOpacity={0.7}
                >
                  <Trash2 size={20} color={TG.red} />
                  <Text style={[styles.actionText, { color: TG.red }]}>
                    Delete
                  </Text>
                </TouchableOpacity>
              )}
          </View>
        </Pressable>
      )}

      {/* Media viewer */}
      <MediaViewer
        att={viewerAtt}
        visible={viewerOpen}
        onClose={() => {
          setViewerOpen(false);
          setViewerAtt(null);
        }}
      />
    </SafeAreaView>
    </GestureHandlerRootView>
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

  swipeContainer: { position: 'relative', maxWidth: '85%', marginBottom: 2 },
  swipeReplyIcon: {
    position: 'absolute',
    top: '50%',
    marginTop: -14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: TG.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bubbleRow: { flexDirection: 'row' },
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

  replyBar: {
    borderLeftWidth: 2,
    borderLeftColor: TG.accent,
    paddingLeft: 8,
    marginBottom: 4,
  },
  replyName: { fontSize: 12, fontWeight: '700', color: TG.accent },
  replyText: { fontSize: 12, color: TG.textSecondary },

  deletedText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: TG.textHint,
    paddingVertical: 2,
  },

  attachments: { marginBottom: 4, gap: 4 },
  mediaTouchable: {
    width: MEDIA_W,
    height: MEDIA_H,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  mediaThumb: {
    width: MEDIA_W,
    height: MEDIA_H,
    borderRadius: 10,
  },
  mediaPlaceholder: {
    backgroundColor: '#2a2a2e',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  mediaSizeLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  mediaDownloadBtn: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaDownloadCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaPlayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  attachFile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: TG.bgSecondary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  attachFileIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: TG.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachFileName: { fontSize: 14, fontWeight: '600', color: TG.accent },
  attachFileSize: { fontSize: 12, color: TG.textHint, marginTop: 1 },

  msgText: { fontSize: 15, color: TG.textPrimary, lineHeight: 21 },

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
    paddingTop: 80,
    gap: 8,
    // inverted list: content is from bottom, so this pushes up nicely
    transform: [{ scaleY: -1 }],
  },
  emptyChatText: { fontSize: 16, fontWeight: '600', color: TG.textSecondary },
  emptyChatSub: { fontSize: 14, color: TG.textHint },

  // Reply / edit banner
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TG.bg,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: TG.separator,
  },
  replyBannerLine: {
    width: 3,
    height: '100%',
    backgroundColor: TG.accent,
    borderRadius: 2,
  },
  replyBannerTitle: { fontSize: 13, fontWeight: '700', color: TG.accent },
  replyBannerText: { fontSize: 13, color: TG.textSecondary },

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
  inputIcon: { padding: 8 },
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
  micBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingBar: {
    alignItems: 'center',
  },
  recordingInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: TG.red,
  },
  recordingTime: {
    fontSize: 16,
    fontWeight: '600',
    color: TG.textPrimary,
  },

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
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: TG.bgSecondary,
  },
  actionPreviewLine: {
    width: 3,
    height: 32,
    borderRadius: 2,
    backgroundColor: TG.accent,
  },
  actionPreviewName: { fontSize: 13, fontWeight: '700', color: TG.accent },
  actionPreviewText: { fontSize: 13, color: TG.textSecondary, lineHeight: 18 },
  actionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: TG.separator,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  actionText: { fontSize: 16, fontWeight: '600', color: TG.textPrimary },
});
