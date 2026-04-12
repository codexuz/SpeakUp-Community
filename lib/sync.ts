import { File } from 'expo-file-system';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { apiSubmitSpeaking } from './api';
import { getUnsyncedResponses, markResponseSynced } from './db';

export const useSyncManager = () => {
  useEffect(() => {
    const checkAndSync = async () => {
      try {
        const unsynced = await getUnsyncedResponses() as any[];
        if (!unsynced || unsynced.length === 0) return;

        for (const record of unsynced) {
          const { id, local_uri, question_id } = record;
          
          if (!local_uri) continue;

          const file = new File(local_uri);
          if (!file.exists) {
            continue;
          }

          try {
            const result = await apiSubmitSpeaking(question_id, local_uri);
            const remoteUrl = result.remoteUrl || '';

            await markResponseSynced(id, remoteUrl);
          } catch (uploadErr) {
            console.warn(`Failed to sync response ${id}:`, uploadErr);
          }
        }
      } catch (e) {
         console.warn('Sync manager error:', e);
      }
    };

    checkAndSync();

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        checkAndSync();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);
};
