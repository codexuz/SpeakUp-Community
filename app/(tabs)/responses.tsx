import { apiDeleteResponse, apiFetchPendingResponses } from '@/lib/api';
import { deleteResponseLocal, getCachedQuestionById, getStudentResponses } from '@/lib/db';
import { useAuth } from '@/store/auth';
import { File } from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';
import { CheckCircle, Clock, Play, Square, Trash2 } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function ResponsesScreen() {
  const { user } = useAuth();
  const [responses, setResponses] = useState<any[]>([]);
  const [questionMap, setQuestionMap] = useState<Record<number, string>>({});
  const [playingId, setPlayingId] = useState<number | null>(null);

  const loadResponses = useCallback(async () => {
    if (user?.role === 'student') {
      const data = await getStudentResponses(user.id) as any[];
      setResponses(data);
      const map: Record<number, string> = {};
      for (const response of data) {
        if (!map[response.question_id]) {
          const question = await getCachedQuestionById(response.question_id);
          map[response.question_id] = question?.q_text || 'Unknown Question';
        }
      }
      setQuestionMap(map);
    } else if (user?.role === 'teacher') {
      try {
        const data = await apiFetchPendingResponses();
        setResponses(data);
      } catch (error) {
        console.error('Failed to load pending responses', error);
      }
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    void loadResponses();
  }, [loadResponses]);

  const handleDelete = async (id: number, uri: string) => {
    Alert.alert('Delete', 'Remove this recording?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', onPress: async () => {
        await deleteResponseLocal(id);
        if (uri) {
          try {
            const file = new File(uri);
            if (file.exists) file.delete();
          } catch {}
        }
        apiDeleteResponse(id).catch(() => {});
        loadResponses();
      }, style: 'destructive'}
    ]);
  };

  const handlePlay = async (uri: string, remoteUrl: string, id: number) => {
    if (playingId === id) {
      setPlayingId(null);
      return;
    }
    setPlayingId(id);
    
    let sourceUri = uri;
    const file = new File(uri);
    if (!file.exists && remoteUrl) {
      sourceUri = remoteUrl;
    }

    try {
      console.log('Playing', sourceUri);
    } catch (error) {
      console.error(error);
      setPlayingId(null);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0f172a', '#1e293b']} style={StyleSheet.absoluteFillObject} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{user?.role === 'teacher' ? 'Pending Submissions' : 'Your Responses'}</Text>
        
        {responses.map(res => {
          const qText = questionMap[res.question_id] || 'Unknown Question';
          const isPlaying = playingId === res.id;
          
          return (
            <View key={res.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.qText} numberOfLines={2}>{qText}</Text>
                <View style={styles.statusBadge}>
                    {res.is_synced ? (
                        <CheckCircle size={20} color="#10b981" />
                    ) : (
                        <Clock size={20} color="#f59e0b" />
                    )}
                </View>
              </View>
              
              <View style={styles.cardFooter}>
                <TouchableOpacity 
                  style={[styles.playBtn, isPlaying && styles.playBtnActive]} 
                  onPress={() => handlePlay(res.local_uri, res.remote_url, res.id)}
                  activeOpacity={0.8}
                >
                  {isPlaying ? (
                     <Square size={20} color="#fff" fill="#fff" />
                  ) : (
                     <Play size={20} color="#fff" fill="#fff" />
                  )}
                  <Text style={styles.playText}>{isPlaying ? 'STOPPING...' : 'PLAY AUDIO'}</Text>
                </TouchableOpacity>

                {user?.role === 'student' && (
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(res.id, res.local_uri)} activeOpacity={0.7}>
                    <Trash2 size={22} color="#ef4444" />
                  </TouchableOpacity>
                )}
              </View>

              {res.teacher_score !== null && res.teacher_score !== undefined && (
                <View style={styles.feedbackBox}>
                  <Text style={styles.scoreText}>SCORE: {res.teacher_score}</Text>
                  {res.teacher_feedback && <Text style={styles.feedbackText}>{res.teacher_feedback}</Text>}
                </View>
              )}
            </View>
          );
        })}
        {responses.length === 0 && (
          <View style={styles.emptyContainer}>
             <Clock size={48} color="#334155" style={{ marginBottom: 16 }} />
             <Text style={styles.emptyText}>No responses yet.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingTop: 40, paddingBottom: 100 },
  title: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 24 },
  
  card: { 
      backgroundColor: '#1e293b', 
      borderRadius: 20, 
      padding: 20, 
      marginBottom: 16, 
      borderWidth: 2, 
      borderColor: '#334155',
      borderBottomWidth: 5
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  qText: { fontSize: 18, color: '#f8fafc', fontWeight: '700', flex: 1, marginRight: 12, lineHeight: 26 },
  statusBadge: { backgroundColor: '#0f172a', padding: 6, borderRadius: 12 },
  
  cardFooter: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  
  playBtn: { 
      flex: 1, 
      backgroundColor: '#3b82f6', 
      flexDirection: 'row', 
      alignItems: 'center', 
      justifyContent: 'center', 
      gap: 8, 
      padding: 16, 
      borderRadius: 16,
      borderBottomWidth: 4,
      borderColor: '#2563eb'
  },
  playBtnActive: { 
      backgroundColor: '#ef4444', 
      borderColor: '#dc2626',
      borderBottomWidth: 2,
      transform: [{translateY: 2}]
  },
  playText: { color: '#fff', fontWeight: '800', letterSpacing: 0.5, fontSize: 15 },
  
  deleteBtn: { 
      padding: 14, 
      backgroundColor: 'rgba(239, 68, 68, 0.1)', 
      borderRadius: 16, 
      borderWidth: 2, 
      borderColor: 'rgba(239, 68, 68, 0.3)',
      borderBottomWidth: 4
  },
  
  feedbackBox: { 
      marginTop: 20, 
      padding: 16, 
      backgroundColor: 'rgba(16, 185, 129, 0.1)', 
      borderRadius: 16,
      borderWidth: 2,
      borderColor: 'rgba(16, 185, 129, 0.3)'
  },
  scoreText: { color: '#10b981', fontWeight: '800', marginBottom: 8, fontSize: 16, letterSpacing: 1 },
  feedbackText: { color: '#cbd5e1', fontSize: 16, lineHeight: 24, fontWeight: '500' },
  
  emptyContainer: { alignItems: 'center', marginTop: 80 },
  emptyText: { color: '#94a3b8', fontSize: 18, fontWeight: '600' }
});
