import { getStoredAuthToken } from '@/store/auth';

const API_URL = 'https://speakup.impulselc.uz/api';

export type SSEEventType =
  | 'new-speaking'
  | 'new-review'
  | 'new-comment'
  | 'audio-processed'
  | 'join-request'
  | 'join-approved'
  | 'join-rejected';

export interface SSEConnection {
  close: () => void;
}

export async function connectSSE(
  onEvent: (type: SSEEventType, data: any) => void,
  onError?: (error: any) => void,
): Promise<SSEConnection | null> {
  const token = await getStoredAuthToken();
  if (!token) return null;

  try {
    const EventSourceModule = require('react-native-sse');
    const EventSourceClass = EventSourceModule.default || EventSourceModule;

    const es = new EventSourceClass(`${API_URL}/speaking/events`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const eventTypes: SSEEventType[] = [
      'new-speaking',
      'new-review',
      'new-comment',
      'audio-processed',
      'join-request',
      'join-approved',
      'join-rejected',
    ];

    for (const type of eventTypes) {
      es.addEventListener(type, (e: any) => {
        try {
          const data = JSON.parse(e.data);
          onEvent(type, data);
        } catch {
          // ignore parse errors
        }
      });
    }

    es.addEventListener('error', (e: any) => {
      onError?.(e);
    });

    return {
      close: () => es.close(),
    };
  } catch (e) {
    console.warn('SSE not available (react-native-sse may not be installed):', e);
    return null;
  }
}
