import { useAlert } from '@/components/CustomAlert';
import { useToast } from '@/components/Toast';
import { TG } from '@/constants/theme';
import { apiDeleteSpeaking, apiFetchMySpeaking, apiFetchPendingSpeaking, apiPostReview } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { useFocusEffect } from '@react-navigation/native';
import { Mic, Play, Square, Star, Trash2 } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
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

export default function ResponsesScreen() {
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher';
  const toast = useToast();
  const { alert } = useAlert();
  const [responses, setResponses] = useState<any[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [reviewModal, setReviewModal] = useState(false);
  const [selectedSub, setSelectedSub] = useState<any>(null);
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadResponses = useCallback(async () => {
    setLoading(true);
    try {
      if (isTeacher) {
        const result = await apiFetchPendingSpeaking();
        setResponses(result.data || []);
      } else {
        const result = await apiFetchMySpeaking();
        setResponses(result.data || []);
      }
    } catch (e) {
      console.error('Failed to load responses', e);
    } finally {
      setLoading(false);
    }
  }, [isTeacher]);

  useFocusEffect(
    useCallback(() => {
      loadResponses();
    }, [loadResponses])
  );

  const handleDelete = async (item: any) => {
    alert('Delete', 'Remove this recording?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await apiDeleteSpeaking(item.id);
          } catch {}
          loadResponses();
        }
      }
    ], 'destructive');
  };

  const handlePlay = (item: any) => {
    if (playingId === (item.id?.toString())) {
      setPlayingId(null);
      return;
    }
    setPlayingId(item.id?.toString());
    const uri = item.remoteUrl;
    console.log('Playing', uri);
  };

  const openReviewModal = (sub: any) => {
    setSelectedSub(sub);
    setScore('');
    setFeedback('');
    setReviewModal(true);
  };

  const handleReview = async () => {
    if (!selectedSub || !score) return;
    const numScore = parseInt(score, 10);
    if (isNaN(numScore) || numScore < 0 || numScore > 9) {
      toast.warning('Invalid', 'Score must be between 0 and 9');
      return;
    }
    setSubmitting(true);
    try {
      await apiPostReview(selectedSub.id, numScore, feedback);
      setReviewModal(false);
      loadResponses();
    } catch (e: any) {
      toast.error('Error', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const qText = item.question?.qText || 'Unknown Question';
    const isPlaying = playingId === (item.id?.toString());

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          {isTeacher && item.student && (
            <View style={styles.studentInfo}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(item.student?.fullName || '?').charAt(0)}</Text>
              </View>
              <View>
                <Text style={styles.studentName}>{item.student.fullName}</Text>
                <Text style={styles.studentHandle}>@{item.student.username}</Text>
              </View>
            </View>
          )}
          {item.scoreAvg != null && (
            <View style={styles.scorePill}>
              <Star size={12} color={TG.orange} fill={TG.orange} />
              <Text style={styles.scoreValue}>{item.scoreAvg.toFixed(1)}</Text>
            </View>
          )}
        </View>

        <Text style={styles.questionText} numberOfLines={2}>{qText}</Text>

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.playBtn, isPlaying && styles.playBtnActive]}
            activeOpacity={0.7}
            onPress={() => handlePlay(item)}
          >
            {isPlaying ? <Square size={16} color={TG.textWhite} /> : <Play size={16} color={TG.textWhite} fill={TG.textWhite} />}
            <Text style={styles.playBtnText}>{isPlaying ? 'Stop' : 'Play'}</Text>
          </TouchableOpacity>

          {isTeacher && (
            <TouchableOpacity style={styles.reviewActionBtn} activeOpacity={0.7} onPress={() => openReviewModal(item)}>
              <Text style={styles.reviewActionText}>Review</Text>
            </TouchableOpacity>
          )}

          {!isTeacher && (
            <TouchableOpacity style={styles.deleteBtn} activeOpacity={0.7} onPress={() => handleDelete(item)}>
              <Trash2 size={18} color={TG.red} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{isTeacher ? 'Pending Reviews' : 'My Recordings'}</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={TG.accent} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={responses}
          keyExtractor={(item, i) => item.id?.toString() || i.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Mic size={48} color={TG.separator} />
              <Text style={styles.emptyText}>{isTeacher ? 'No pending submissions' : 'No recordings yet'}</Text>
            </View>
          }
        />
      )}

      <Modal visible={reviewModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Review</Text>
            <Text style={styles.inputLabel}>Score (0-9)</Text>
            <TextInput style={styles.input} value={score} onChangeText={setScore} keyboardType="number-pad" maxLength={1} placeholder="0-9" placeholderTextColor={TG.textHint} />
            <Text style={styles.inputLabel}>Feedback</Text>
            <TextInput style={[styles.input, styles.textArea]} value={feedback} onChangeText={setFeedback} multiline numberOfLines={4} placeholder="Write feedback..." placeholderTextColor={TG.textHint} textAlignVertical="top" />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setReviewModal(false)}><Text style={styles.cancelBtnText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.submitBtn, (!score || submitting) && { opacity: 0.5 }]} onPress={handleReview} disabled={!score || submitting}>
                {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.submitBtnText}>Submit</Text>}
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
  safeArea: { flex: 1, backgroundColor: TG.bgSecondary },
  header: { backgroundColor: TG.headerBg, paddingHorizontal: 16, paddingVertical: 14 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: TG.textWhite },
  listContent: { paddingBottom: 100 },

  card: { backgroundColor: TG.bg, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: TG.separatorLight },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  studentInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: TG.accentLight, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 14, fontWeight: '700', color: TG.accent },
  studentName: { fontSize: 15, fontWeight: '600', color: TG.textPrimary },
  studentHandle: { fontSize: 12, color: TG.textSecondary },
  scorePill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: TG.orangeLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginLeft: 'auto' },
  scoreValue: { fontSize: 13, fontWeight: '700', color: TG.orange },

  questionText: { fontSize: 15, color: TG.textPrimary, lineHeight: 21, marginBottom: 10 },

  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  playBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: TG.accent, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16 },
  playBtnActive: { backgroundColor: TG.red },
  playBtnText: { fontSize: 13, fontWeight: '600', color: TG.textWhite },
  reviewActionBtn: { backgroundColor: TG.green, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16 },
  reviewActionText: { fontSize: 13, fontWeight: '600', color: TG.textWhite },
  deleteBtn: { marginLeft: 'auto', padding: 8 },

  emptyContainer: { alignItems: 'center', marginTop: 80, gap: 12 },
  emptyText: { color: TG.textSecondary, fontSize: 15 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: TG.bg, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: TG.textPrimary, marginBottom: 12 },
  inputLabel: { fontSize: 13, color: TG.textSecondary, fontWeight: '600', marginBottom: 6 },
  input: { backgroundColor: TG.bgSecondary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: TG.textPrimary, borderWidth: 0.5, borderColor: TG.separator, marginBottom: 12 },
  textArea: { minHeight: 80 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10, backgroundColor: TG.bgSecondary },
  cancelBtnText: { color: TG.textSecondary, fontWeight: '600' },
  submitBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10, backgroundColor: TG.accent },
  submitBtnText: { color: TG.textWhite, fontWeight: '600' },
});