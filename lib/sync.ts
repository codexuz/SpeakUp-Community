import { File } from 'expo-file-system';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { apiSubmitResponse } from './api';
import { getUnsyncedResponses, markResponseSynced } from './db';

export const useSyncManager = () => {
  useEffect(() => {
    const checkAndSync = async () => {
      try {
        const unsynced = await getUnsyncedResponses() as any[];
        if (!unsynced || unsynced.length === 0) return;

        for (const record of unsynced) {
          const { id, local_uri, student_id, question_id } = record;
          
          if (!local_uri) continue;

          // 1. Check if file still exists
          const file = new File(local_uri);
          if (!file.exists) {
            continue;
          }

          try {
            // 2. Upload via API
            const result = await apiSubmitResponse(question_id, student_id, local_uri);
            const remoteUrl = result.remoteUrl || result.remote_url || '';

            // 3. Mark as synced locally
            await markResponseSynced(id, remoteUrl);
          } catch (uploadErr) {
            console.warn(`Failed to sync response ${id}:`, uploadErr);
          }
        }
      } catch (e) {
         console.warn('Sync manager error:', e);
      }
    };

    // Run once on mount
    checkAndSync();

    // Run smoothly every time App comes to foreground
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
