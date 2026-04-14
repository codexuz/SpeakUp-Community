import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

import { getStoredAuthToken } from '@/store/auth';

// ─── Constants ────────────────────────────────────────────
const BASE_URL = 'https://speakup.impulselc.uz';
const API = `${BASE_URL}/api`;

// ─── Types ────────────────────────────────────────────────
export type MessageType = 'text' | 'image' | 'video' | 'file' | 'system';

export interface ChatAttachment {
  id: string;
  messageId: string;
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

export interface ChatSender {
  id: string;
  fullName: string;
  username: string;
  avatarUrl: string | null;
}

export interface ChatMessage {
  id: string;
  groupId: string;
  senderId: string;
  type: MessageType;
  text: string | null;
  replyToId: string | null;
  isEdited: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  sender: ChatSender;
  attachments: ChatAttachment[];
  replyTo: {
    id: string;
    text: string | null;
    type: MessageType;
    sender: Pick<ChatSender, 'id' | 'fullName' | 'username'>;
  } | null;
}

export interface PaginatedMessages {
  data: ChatMessage[];
  nextCursor: string | null;
  hasMore: boolean;
}

// ─── REST helpers ─────────────────────────────────────────
async function authHeaders() {
  const token = await getStoredAuthToken();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export async function fetchMessages(
  groupId: string,
  cursor?: string | null,
  limit = 30,
): Promise<PaginatedMessages> {
  const h = await authHeaders();
  const qs = cursor
    ? `?limit=${limit}&cursor=${cursor}`
    : `?limit=${limit}`;
  const res = await fetch(`${API}/group-chat/${groupId}/messages${qs}`, {
    headers: h,
  });
  if (!res.ok) throw new Error('Failed to load messages');
  return res.json();
}

export async function sendTextMessage(
  groupId: string,
  text: string,
  replyToId?: string | null,
): Promise<ChatMessage> {
  const h = await authHeaders();
  const res = await fetch(`${API}/group-chat/${groupId}/messages`, {
    method: 'POST',
    headers: h,
    body: JSON.stringify({ text, replyToId: replyToId ?? null }),
  });
  if (!res.ok) throw new Error('Failed to send message');
  return res.json();
}

export async function sendFilesMessage(
  groupId: string,
  files: { uri: string; name: string; type: string }[],
  caption?: string,
): Promise<ChatMessage> {
  const token = await getStoredAuthToken();
  const formData = new FormData();
  if (caption) formData.append('text', caption);
  for (const file of files) {
    formData.append('files', file as any);
  }
  const res = await fetch(`${API}/group-chat/${groupId}/messages/attachment`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) throw new Error('Failed to send files');
  return res.json();
}

export async function editMessage(
  groupId: string,
  messageId: string,
  text: string,
): Promise<ChatMessage> {
  const h = await authHeaders();
  const res = await fetch(
    `${API}/group-chat/${groupId}/messages/${messageId}`,
    { method: 'PUT', headers: h, body: JSON.stringify({ text }) },
  );
  if (!res.ok) throw new Error('Failed to edit message');
  return res.json();
}

export async function deleteMessage(
  groupId: string,
  messageId: string,
): Promise<void> {
  const h = await authHeaders();
  const res = await fetch(
    `${API}/group-chat/${groupId}/messages/${messageId}`,
    { method: 'DELETE', headers: h },
  );
  if (!res.ok) throw new Error('Failed to delete message');
}

export async function searchMessages(
  groupId: string,
  query: string,
  limit = 20,
): Promise<ChatMessage[]> {
  const h = await authHeaders();
  const res = await fetch(
    `${API}/group-chat/${groupId}/messages/search?q=${encodeURIComponent(query)}&limit=${limit}`,
    { headers: h },
  );
  if (!res.ok) throw new Error('Search failed');
  return res.json();
}

// ─── Hook ─────────────────────────────────────────────────
export function useGroupChat(groupId: string) {
  const socketRef = useRef<Socket | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(
    new Map(),
  );
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const cursorRef = useRef<string | null>(null);
  const [connected, setConnected] = useState(false);

  // Socket connection
  useEffect(() => {
    let socket: Socket;
    let mounted = true;

    (async () => {
      const token = await getStoredAuthToken();
      if (!token || !mounted) return;

      socket = io(BASE_URL, {
        path: '/ws/chat',
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        if (mounted) setConnected(true);
      });

      socket.on('disconnect', () => {
        if (mounted) setConnected(false);
      });

      socket.on('new-message', (msg: ChatMessage) => {
        if (msg.groupId === groupId && mounted) {
          setMessages((prev) => [msg, ...prev]);
        }
      });

      socket.on('message-edited', (msg: ChatMessage) => {
        if (msg.groupId === groupId && mounted) {
          setMessages((prev) =>
            prev.map((m) => (m.id === msg.id ? msg : m)),
          );
        }
      });

      socket.on('message-deleted', (data: { groupId: string; messageId: string }) => {
        if (data.groupId === groupId && mounted) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === data.messageId
                ? { ...m, isDeleted: true, text: null }
                : m,
            ),
          );
        }
      });

      socket.on('user-typing', (data: { groupId: string; userId: string; username: string; isTyping: boolean }) => {
        if (data.groupId === groupId && mounted) {
          setTypingUsers((prev) => {
            const next = new Map(prev);
            if (data.isTyping) next.set(data.userId, data.username);
            else next.delete(data.userId);
            return next;
          });
        }
      });
    })();

    return () => {
      mounted = false;
      socket?.disconnect();
      socketRef.current = null;
    };
  }, [groupId]);

  // Load messages (initial + pagination)
  const loadMessages = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await fetchMessages(groupId, cursorRef.current);
      setMessages((prev) =>
        cursorRef.current ? [...prev, ...result.data] : result.data,
      );
      cursorRef.current = result.nextCursor;
      setHasMore(result.hasMore);
    } catch (e) {
      console.error('loadMessages error', e);
    } finally {
      setLoadingMore(false);
    }
  }, [groupId, loadingMore]);

  // Send text
  const sendText = useCallback(
    async (text: string, replyToId?: string) => {
      return sendTextMessage(groupId, text, replyToId);
    },
    [groupId],
  );

  // Send files
  const sendFiles = useCallback(
    async (
      files: { uri: string; name: string; type: string }[],
      caption?: string,
    ) => {
      return sendFilesMessage(groupId, files, caption);
    },
    [groupId],
  );

  // Typing indicator
  const sendTyping = useCallback(
    (isTyping: boolean) => {
      socketRef.current?.emit('typing', { groupId, isTyping });
    },
    [groupId],
  );

  // Mark read
  const markRead = useCallback(
    (lastMessageId: string) => {
      socketRef.current?.emit('mark-read', { groupId, lastMessageId });
    },
    [groupId],
  );

  return {
    messages,
    typingUsers,
    hasMore,
    loadingMore,
    connected,
    loadMessages,
    sendText,
    sendFiles,
    sendTyping,
    markRead,
  };
}
