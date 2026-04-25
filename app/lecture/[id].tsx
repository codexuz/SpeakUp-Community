import { useToast } from '@/components/Toast';
import WaveformPlayer from '@/components/WaveformPlayer';
import { TG } from '@/constants/theme';
import { apiFetchLecture, apiUpdateLectureProgress } from '@/lib/api';
import type { Lecture, LectureAttachment } from '@/lib/types';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
    ArrowLeft,
    Check,
    CheckCircle,
    Download,
    FileText,
    Film,
    Mic,
    Paperclip,
} from 'lucide-react-native';
import React, { useCallback, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LectureViewerScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const toast = useToast();

  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [loading, setLoading] = useState(true);
  const [markingComplete, setMarkingComplete] = useState(false);

  // Text lecture scroll progress
  const scrollRef = useRef<ScrollView>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const lastSentProgress = useRef(0);

  const load = useCallback(async () => {
    try {
      const data = await apiFetchLecture(String(id));
      setLecture(data);
    } catch (e: any) {
      toast.error('Error', e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const sendProgress = useCallback(async (pct: number) => {
    if (!lecture) return;
    const rounded = Math.min(100, Math.round(pct));
    if (rounded <= lastSentProgress.current) return;
    lastSentProgress.current = rounded;
    try {
      await apiUpdateLectureProgress(lecture.id, { progressPct: rounded, completed: rounded >= 95 });
    } catch { /* silent */ }
  }, [lecture]);

  const handleScroll = useCallback((e: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const maxScroll = contentSize.height - layoutMeasurement.height;
    if (maxScroll <= 0) return;
    const pct = (contentOffset.y / maxScroll) * 100;
    setScrollProgress(pct);
    if (pct - lastSentProgress.current >= 10 || pct >= 95) {
      sendProgress(pct);
    }
  }, [sendProgress]);

  const handleMarkComplete = async () => {
    if (!lecture) return;
    setMarkingComplete(true);
    try {
      await apiUpdateLectureProgress(lecture.id, { progressPct: 100, completed: true });
      toast.success('Done', 'Lecture marked as complete');
      setLecture((prev) => prev ? { ...prev, userProgress: { ...prev.userProgress!, completed: true, progressPct: 100 } } : prev);
    } catch (e: any) {
      toast.error('Error', e.message);
    } finally {
      setMarkingComplete(false);
    }
  };

  const isCompleted = lecture?.userProgress?.completed;

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: TG.bgSecondary }}>
        <SafeAreaView style={{backgroundColor: TG.bgSecondary, flex: 1, alignItems: 'center', justifyContent: 'center'}}>
          <ActivityIndicator size="large" color={TG.accent} />
        </SafeAreaView>
      </View>
    );
  }

  if (!lecture) {
    return (
      <SafeAreaView style={{backgroundColor: TG.bgSecondary, flex: 1, alignItems: 'center', justifyContent: 'center'}}>
        <Text style={styles.errorText}>Lecture not found</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const hasVideo = !!(lecture.videoUrl || (lecture.contentType === 'video' && lecture.mediaUrl));
  const hasAudio = !!(lecture.audioUrl || (lecture.contentType === 'audio' && lecture.mediaUrl));
  const hasText = !!lecture.textBody;
  const videoSrc = lecture.videoUrl || lecture.mediaUrl;
  const audioSrc = lecture.audioUrl || lecture.mediaUrl;

  const renderContentIcon = () => {
    switch (lecture.contentType) {
      case 'text': return <FileText size={16} color={TG.accent} />;
      case 'audio': return <Mic size={16} color="#E17055" />;
      case 'video': return <Film size={16} color="#6C5CE7" />;
    }
  };

  const renderMixedContent = () => (
    <ScrollView
      ref={scrollRef}
      style={styles.scrollBody}
      contentContainerStyle={styles.scrollContent}
      onScroll={hasText ? handleScroll : undefined}
      scrollEventThrottle={200}
    >
      {/* ── Video section ── */}
      {hasVideo && videoSrc && (
        <View style={styles.sectionWrap}>
          <View style={styles.sectionLabel}>
            <Film size={14} color="#6C5CE7" />
            <Text style={styles.sectionLabelText}>Video</Text>
          </View>
          <VideoLecturePlayer url={videoSrc} onProgress={(pct) => sendProgress(pct)} />
        </View>
      )}

      {/* ── Audio section ── */}
      {hasAudio && audioSrc && (
        <View style={styles.sectionWrap}>
          <View style={styles.sectionLabel}>
            <Mic size={14} color="#E17055" />
            <Text style={styles.sectionLabelText}>Audio</Text>
          </View>
          <View style={styles.audioCard}>
            <View style={styles.audioIconBig}>
              <Mic size={32} color="#E17055" />
            </View>
            <Text style={styles.audioTitle}>{lecture.title}</Text>
            {lecture.durationSec ? (
              <Text style={styles.audioDuration}>
                {Math.floor(lecture.durationSec / 60)}:{String(lecture.durationSec % 60).padStart(2, '0')}
              </Text>
            ) : null}
          </View>
          <View style={styles.playerWrap}>
            <WaveformPlayer uri={audioSrc} />
          </View>
        </View>
      )}

      {/* ── Text / Markdown section ── */}
      {hasText && (
        <View style={styles.sectionWrap}>
          {(hasVideo || hasAudio) && (
            <View style={styles.sectionLabel}>
              <FileText size={14} color={TG.accent} />
              <Text style={styles.sectionLabelText}>Reading Material</Text>
            </View>
          )}
          <Markdown style={markdownStyles}>
            {lecture.textBody!}
          </Markdown>
        </View>
      )}

      {/* ── Fallback when nothing is available ── */}
      {!hasVideo && !hasAudio && !hasText && (
        <Text style={styles.noMediaText}>No content available</Text>
      )}

      {renderAttachments()}
      {renderCompleteButton()}
      <View style={{ height: 40 }} />
    </ScrollView>
  );

  const renderAttachments = () => {
    if (!lecture.attachments?.length) return null;
    return (
      <View style={styles.attachSection}>
        <View style={styles.attachHeader}>
          <Paperclip size={14} color={TG.textSecondary} />
          <Text style={styles.attachTitle}>Attachments ({lecture.attachments.length})</Text>
        </View>
        {lecture.attachments.map((att) => (
          <AttachmentRow key={att.id} attachment={att} />
        ))}
      </View>
    );
  };

  const renderCompleteButton = () => {
    if (isCompleted) {
      return (
        <View style={styles.completedBanner}>
          <CheckCircle size={20} color={TG.green} />
          <Text style={styles.completedText}>Lecture completed</Text>
        </View>
      );
    }
    return (
      <TouchableOpacity
        style={styles.completeBtn}
        onPress={handleMarkComplete}
        disabled={markingComplete}
        activeOpacity={0.7}
      >
        {markingComplete ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Check size={18} color="#fff" />
            <Text style={styles.completeBtnText}>Mark as Complete</Text>
          </>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ArrowLeft size={22} color={TG.textWhite} />
        </TouchableOpacity>
        <View style={styles.topCenter}>
          <Text style={styles.topTitle} numberOfLines={1}>{lecture.title}</Text>
          <View style={styles.topMeta}>
            {renderContentIcon()}
            <Text style={styles.topMetaText}>
              {lecture.contentType.charAt(0).toUpperCase() + lecture.contentType.slice(1)} Lecture
            </Text>
            {isCompleted && <CheckCircle size={12} color={TG.green} />}
          </View>
        </View>
      </View>

      {renderMixedContent()}
    </SafeAreaView>
  );
}

// ─── Video sub-component ───────────────────────────────────────

function VideoLecturePlayer({ url, onProgress }: { url: string; onProgress: (pct: number) => void }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
  });

  return (
    <View style={styles.videoWrap}>
      <VideoView
        player={player}
        style={styles.videoView}
        nativeControls
        contentFit="contain"
      />
    </View>
  );
}

// ─── Attachment sub-component ──────────────────────────────────

function AttachmentRow({ attachment }: { attachment: LectureAttachment }) {
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const FileSystem = require('expo-file-system');
      const Sharing = require('expo-sharing');
      const fileUri = FileSystem.documentDirectory + attachment.fileName;
      const result = await FileSystem.downloadAsync(attachment.url, fileUri);
      if (result?.uri) {
        await Sharing.shareAsync(result.uri);
      }
    } catch (e: any) {
      toast.error('Download Failed', e.message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <TouchableOpacity style={styles.attachRow} onPress={handleDownload} disabled={downloading} activeOpacity={0.7}>
      <View style={styles.attachIcon}>
        <FileText size={16} color={TG.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.attachName} numberOfLines={1}>{attachment.fileName}</Text>
        {attachment.fileSize ? <Text style={styles.attachSize}>{formatFileSize(attachment.fileSize)}</Text> : null}
      </View>
      {downloading ? (
        <ActivityIndicator size="small" color={TG.accent} />
      ) : (
        <Download size={16} color={TG.accent} />
      )}
    </TouchableOpacity>
  );
}

// ─── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: TG.headerBg },
  centered: { alignItems: 'center', justifyContent: 'center' },
  errorText: { color: TG.textSecondary, fontSize: 16, marginBottom: 16 },
  backBtn: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: TG.bg, borderRadius: 8 },
  backBtnText: { color: TG.textPrimary, fontWeight: '600' },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: TG.headerBg,
    gap: 12,
  },
  topCenter: { flex: 1 },
  topTitle: { fontSize: 18, fontWeight: '700', color: TG.textWhite },
  topMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  topMetaText: { fontSize: 12, color: TG.textWhite + '99' },

  scrollBody: { flex: 1, backgroundColor: TG.bgSecondary },
  scrollContent: { padding: 16, paddingBottom: 40 },

  // Mixed content sections
  sectionWrap: { marginBottom: 16 },
  sectionLabel: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: TG.separator,
  },
  sectionLabelText: { fontSize: 13, fontWeight: '700', color: TG.textSecondary, textTransform: 'uppercase' as const, letterSpacing: 0.5 },

  // Audio
  audioCard: {
    alignItems: 'center',
    backgroundColor: TG.bg,
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  audioIconBig: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E17055' + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  audioTitle: { fontSize: 18, fontWeight: '700', color: TG.textPrimary, textAlign: 'center' },
  audioDuration: { fontSize: 14, color: TG.textSecondary, marginTop: 4 },
  playerWrap: {
    backgroundColor: TG.bg,
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  noMediaText: { fontSize: 14, color: TG.textHint, textAlign: 'center', paddingVertical: 24 },

  // Video
  videoWrap: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#000',
    marginBottom: 16,
  },
  videoView: { width: '100%', aspectRatio: 16 / 9 },

  // Attachments
  attachSection: { marginTop: 20 },
  attachHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  attachTitle: { fontSize: 14, fontWeight: '700', color: TG.textSecondary },
  attachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: TG.bg,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  attachIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: TG.accent + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachName: { fontSize: 14, fontWeight: '600', color: TG.textPrimary },
  attachSize: { fontSize: 12, color: TG.textHint, marginTop: 2 },

  // Complete
  completeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: TG.green,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 24,
  },
  completeBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: TG.green + '12',
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 24,
    borderWidth: 1,
    borderColor: TG.green + '30',
  },
  completedText: { fontSize: 15, fontWeight: '700', color: TG.green },
});

const markdownStyles = StyleSheet.create({
  body: { color: TG.textPrimary, fontSize: 16, lineHeight: 26 },
  heading1: { color: TG.textPrimary, fontSize: 24, fontWeight: '800', marginBottom: 12, marginTop: 20 },
  heading2: { color: TG.textPrimary, fontSize: 20, fontWeight: '700', marginBottom: 10, marginTop: 16 },
  heading3: { color: TG.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 8, marginTop: 14 },
  paragraph: { marginBottom: 12 },
  strong: { fontWeight: '700' },
  em: { fontStyle: 'italic' },
  code_inline: { backgroundColor: TG.bgSecondary, color: TG.accent, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, fontSize: 14 },
  code_block: { backgroundColor: TG.bg, padding: 12, borderRadius: 10, fontSize: 14, color: TG.textPrimary },
  blockquote: { borderLeftWidth: 3, borderLeftColor: TG.accent, paddingLeft: 12, marginVertical: 8, backgroundColor: TG.accent + '08' },
  bullet_list_icon: { color: TG.accent },
  ordered_list_icon: { color: TG.accent },
  list_item: { marginBottom: 4 },
  link: { color: TG.accent, textDecorationLine: 'underline' },
  hr: { backgroundColor: TG.separator, height: 1, marginVertical: 16 },
});
