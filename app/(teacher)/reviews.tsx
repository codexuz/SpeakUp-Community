import { TG } from '@/constants/theme';
import { apiFetchPendingSpeaking, apiPostReview } from '@/lib/api';
import { useFocusEffect } from '@react-navigation/native';
import { Mic, Play, Square, Star } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function getCefrLabel(score: number): { level: string; color: string; bg: string } {
  if (score <= 37) return { level: 'A2', color: TG.red, bg: TG.redLight };
  if (score <= 50) return { level: 'B1', color: TG.orange, bg: TG.orangeLight };
  if (score <= 64) return { level: 'B2', color: TG.accent, bg: TG.accentLight };
  return { level: 'C1', color: TG.green, bg: TG.greenLight };
}

export default function TeacherReviewsScreen() {
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
      const result = await apiFetchPendingSpeaking();
      setResponses(result.data || []);
    } catch (e) {
      console.error('Failed to load pending reviews', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadResponses();
    }, [loadResponses])
  );

  const handlePlay = (item: any) => {
    if (playingId === item.id?.toString()) {
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
    if (isNaN(numScore) || numScore < 0 || numScore > 75) {
      Alert.alert('Invalid', 'Score must be between 0 and 75');
      return;
    }
    setSubmitting(true);
    try {
      await apiPostReview(selectedSub.id, numScore, feedback);
      setReviewModal(false);
      loadResponses();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const qText = item.question?.qText || 'Unknown Question';
    const isPlaying = playingId === item.id?.toString();

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          {item.student && (
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
              <Text style={styles.scoreValue}>{item.scoreAvg.toFixed(1)}/75</Text>
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

          <TouchableOpacity style={styles.reviewActionBtn} activeOpacity={0.7} onPress={() => openReviewModal(item)}>
            <Text style={styles.reviewActionText}>Review</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const scoreNum = parseInt(score, 10);
  const scorePreview = !isNaN(scoreNum) && scoreNum >= 0 && scoreNum <= 75 ? getCefrLabel(scoreNum) : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pending Reviews</Text>
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
              <Text style={styles.emptyText}>No pending submissions</Text>
            </View>
          }
        />
      )}

      <Modal visible={reviewModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Review</Text>

            <View style={styles.scoreRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Score (0-75)</Text>
                <TextInput
                  style={styles.input}
                  value={score}
                  onChangeText={setScore}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="0-75"
                  placeholderTextColor={TG.textHint}
                />
              </View>
              {scorePreview && (
                <View style={[styles.cefrBadge, { backgroundColor: scorePreview.bg }]}>
                  <Text style={[styles.cefrText, { color: scorePreview.color }]}>{scorePreview.level}</Text>
                </View>
              )}
            </View>

            <Text style={styles.cefrGuide}>A2: 0-37 · B1: 38-50 · B2: 51-64 · C1: 65-75</Text>

            <Text style={styles.inputLabel}>Feedback</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={feedback}
              onChangeText={setFeedback}
              multiline
              numberOfLines={4}
              placeholder="Write feedback..."
              placeholderTextColor={TG.textHint}
              textAlignVertical="top"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setReviewModal(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, (!score || submitting) && { opacity: 0.5 }]}
                onPress={handleReview}
                disabled={!score || submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
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

  emptyContainer: { alignItems: 'center', marginTop: 80, gap: 12 },
  emptyText: { color: TG.textSecondary, fontSize: 15 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: TG.bg, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: TG.textPrimary, marginBottom: 12 },

  scoreRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  cefrBadge: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, marginBottom: 12 },
  cefrText: { fontSize: 16, fontWeight: '700' },
  cefrGuide: { fontSize: 11, color: TG.textHint, marginBottom: 12 },

  inputLabel: { fontSize: 13, color: TG.textSecondary, fontWeight: '600', marginBottom: 6 },
  input: { backgroundColor: TG.bgSecondary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: TG.textPrimary, borderWidth: 0.5, borderColor: TG.separator, marginBottom: 12 },
  textArea: { minHeight: 80 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10, backgroundColor: TG.bgSecondary },
  cancelBtnText: { color: TG.textSecondary, fontWeight: '600' },
  submitBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10, backgroundColor: TG.accent },
  submitBtnText: { color: TG.textWhite, fontWeight: '600' },
});
