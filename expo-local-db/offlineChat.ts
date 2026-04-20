/**
 * Offline-first group chat — Telegram-style.
 *
 * Messages are stored in local SQLite and displayed instantly.
 * New messages are written locally first (with a temp ID),
 * then sent to the server via WebSocket / REST.
 * If offline, messages queue up and send when connectivity returns.
 */

import {
    ChatMessage,
    ChatSender,
    MessageEntity,
    fetchMessages,
    markReadREST,
    sendFilesMessage,
    sendTextMessage,
} from "@/lib/chat";
import { useCallback, useEffect, useRef, useState } from "react";
import { generateUUID, getDatabase } from "../database";
import { isOnline } from "../hooks/useNetwork";

// ─── Local DB ↔ ChatMessage mapping ────────────────────────────

interface LocalMessage {
  id: string;
  group_id: string;
  sender_id: string;
  type: string;
  text: string | null;
  entities: string | null;
  reply_to_id: string | null;
  is_edited: number;
  is_deleted: number;
  created_at: string;
  updated_at: string;
  sync_status: string;
  // Joined from users table
  sender_name?: string;
  sender_username?: string;
  sender_avatar?: string;
}

function localToChat(row: LocalMessage): ChatMessage {
  return {
    id: row.id,
    groupId: row.group_id,
    senderId: row.sender_id,
    type: row.type as any,
    text: row.text,
    entities: row.entities ? JSON.parse(row.entities) : null,
    replyToId: row.reply_to_id,
    isEdited: row.is_edited === 1,
    isDeleted: row.is_deleted === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sender: {
      id: row.sender_id,
      fullName: row.sender_name ?? "",
      username: row.sender_username ?? "",
      avatarUrl: row.sender_avatar ?? null,
    },
    attachments: [],
    replyTo: null,
    // Extra flag for UI
    ...(row.sync_status === "pending" ? { _pending: true } : {}),
  } as ChatMessage & { _pending?: boolean };
}

function chatToLocal(msg: ChatMessage): Record<string, unknown> {
  return {
    id: msg.id,
    group_id: msg.groupId,
    sender_id: msg.senderId,
    type: msg.type,
    text: msg.text,
    entities: msg.entities ? JSON.stringify(msg.entities) : null,
    reply_to_id: msg.replyToId,
    is_edited: msg.isEdited ? 1 : 0,
    is_deleted: msg.isDeleted ? 1 : 0,
    created_at: msg.createdAt,
    updated_at: msg.updatedAt,
    sync_status: "synced",
  };
}

// ─── Load cached messages from SQLite ──────────────────────────

async function loadLocalMessages(
  groupId: string,
  limit: number = 50,
  beforeCreatedAt?: string
): Promise<ChatMessage[]> {
  const db = await getDatabase();
  let sql = `
    SELECT gm.*, 
           u.full_name as sender_name, 
           u.username as sender_username, 
           u.avatar_url as sender_avatar
    FROM group_messages gm
    LEFT JOIN users u ON u.id = gm.sender_id
    WHERE gm.group_id = ? AND gm.is_deleted = 0
  `;
  const params: any[] = [groupId];

  if (beforeCreatedAt) {
    sql += ` AND gm.created_at < ?`;
    params.push(beforeCreatedAt);
  }

  sql += ` ORDER BY gm.created_at DESC LIMIT ?`;
  params.push(limit);

  const rows = await db.getAllAsync<LocalMessage>(sql, params);
  return rows.map(localToChat);
}

/** Save server messages into local DB */
async function cacheMessages(messages: ChatMessage[]): Promise<void> {
  if (messages.length === 0) return;
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    for (const msg of messages) {
      const row = chatToLocal(msg);
      const keys = Object.keys(row);
      const placeholders = keys.map(() => "?").join(", ");
      const updates = keys
        .filter((k) => k !== "id")
        .map((k) => `${k} = excluded.${k}`)
        .join(", ");
      const values = keys.map((k) => row[k] ?? null);

      await db.runAsync(
        `INSERT INTO group_messages (${keys.join(", ")}) VALUES (${placeholders})
         ON CONFLICT(id) DO UPDATE SET ${updates}`,
        values
      );

      // Cache sender info
      if (msg.sender) {
        await db.runAsync(
          `INSERT INTO users (id, full_name, username, avatar_url, password, sync_status)
           VALUES (?, ?, ?, ?, '', 'synced')
           ON CONFLICT(id) DO UPDATE SET full_name = excluded.full_name, 
             username = excluded.username, avatar_url = excluded.avatar_url`,
          [msg.sender.id, msg.sender.fullName, msg.sender.username, msg.sender.avatarUrl]
        );
      }
    }
  });
}

// ─── Offline-first Chat Hook ────────────────────────────────────

interface UseOfflineChatOptions {
  groupId: string;
  currentUser: ChatSender;
}

export function useOfflineChat({ groupId, currentUser }: UseOfflineChatOptions) {
  const [messages, setMessages] = useState<(ChatMessage & { _pending?: boolean })[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── Load messages: local first, then server ──────────────────

  const loadMessages = useCallback(
    async (older = false) => {
      if (loadingMore) return;
      setLoadingMore(true);

      try {
        const beforeDate = older && messages.length > 0
          ? messages[messages.length - 1].createdAt
          : undefined;

        // Step 1: Instant render from local cache
        const cached = await loadLocalMessages(groupId, 30, beforeDate);
        if (mountedRef.current) {
          if (older) {
            setMessages((prev) => [...prev, ...cached]);
          } else {
            setMessages(cached);
          }
        }

        // Step 2: Background fetch from server (if online)
        if (isOnline()) {
          try {
            const cursor = older && messages.length > 0
              ? messages[messages.length - 1].id
              : null;
            const result = await fetchMessages(groupId, cursor, 30);

            // Cache server messages locally
            await cacheMessages(result.data);

            // Re-read from local DB (now merged with pending messages)
            const fresh = await loadLocalMessages(
              groupId,
              older ? (messages.length + 30) : 30,
              undefined
            );
            if (mountedRef.current) {
              setMessages(fresh);
              setHasMore(result.hasMore);
            }
          } catch {
            // Offline or server error — local data still showing
          }
        } else {
          // Offline — check if there might be more cached
          setHasMore(cached.length >= 30);
        }
      } finally {
        if (mountedRef.current) setLoadingMore(false);
      }
    },
    [groupId, messages, loadingMore]
  );

  // ── Send message: write locally first ─────────────────────────

  const sendText = useCallback(
    async (
      text: string,
      replyToId?: string,
      entities?: MessageEntity[]
    ): Promise<ChatMessage> => {
      const now = new Date().toISOString();
      const tempId = generateUUID();

      // Optimistic local message
      const localMsg: ChatMessage & { _pending: boolean } = {
        id: tempId,
        groupId,
        senderId: currentUser.id,
        type: "text",
        text,
        entities: entities ?? null,
        replyToId: replyToId ?? null,
        isEdited: false,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
        sender: currentUser,
        attachments: [],
        replyTo: null,
        _pending: true,
      };

      // Show immediately in UI
      setMessages((prev) => [localMsg, ...prev]);

      // Write to SQLite
      const db = await getDatabase();
      await db.runAsync(
        `INSERT INTO group_messages (id, group_id, sender_id, type, text, entities, reply_to_id, is_edited, is_deleted, created_at, updated_at, sync_status)
         VALUES (?, ?, ?, 'text', ?, ?, ?, 0, 0, ?, ?, 'pending')`,
        [tempId, groupId, currentUser.id, text, entities ? JSON.stringify(entities) : null, replyToId ?? null, now, now]
      );

      // Enqueue for sync
      await db.runAsync(
        `INSERT INTO sync_queue (table_name, row_id, action, payload) VALUES (?, ?, 'create', ?)`,
        [
          "group_messages",
          tempId,
          JSON.stringify({ groupId, text, replyToId, entities }),
        ]
      );

      // Try to send immediately if online
      if (isOnline()) {
        try {
          const serverMsg = await sendTextMessage(groupId, text, replyToId, entities);

          // Replace temp message with server version
          await db.runAsync(
            `UPDATE group_messages SET id = ?, sync_status = 'synced', last_synced_at = datetime('now') WHERE id = ?`,
            [serverMsg.id, tempId]
          );
          await db.runAsync(
            `DELETE FROM sync_queue WHERE row_id = ?`,
            [tempId]
          );

          if (mountedRef.current) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempId ? { ...localToChat(chatToLocal(serverMsg) as any), ...serverMsg, _pending: false } : m
              )
            );
          }

          return serverMsg;
        } catch {
          // Failed — message stays pending, sync queue will retry
        }
      }

      return localMsg;
    },
    [groupId, currentUser]
  );

  // ── Send files: similar pattern ───────────────────────────────

  const sendFiles = useCallback(
    async (
      files: { uri: string; name: string; type: string }[],
      caption?: string
    ): Promise<ChatMessage | null> => {
      // Files need to upload, so we queue them differently
      const now = new Date().toISOString();
      const tempId = generateUUID();

      const localMsg: ChatMessage & { _pending: boolean } = {
        id: tempId,
        groupId,
        senderId: currentUser.id,
        type: files[0]?.type?.startsWith("image/") ? "image" : "file",
        text: caption ?? null,
        entities: null,
        replyToId: null,
        isEdited: false,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
        sender: currentUser,
        attachments: files.map((f) => ({
          id: generateUUID(),
          messageId: tempId,
          url: f.uri,
          fileName: f.name,
          fileSize: 0,
          mimeType: f.type,
          createdAt: now,
        })),
        replyTo: null,
        _pending: true,
      };

      setMessages((prev) => [localMsg, ...prev]);

      if (isOnline()) {
        try {
          const serverMsg = await sendFilesMessage(groupId, files, caption);
          await cacheMessages([serverMsg]);

          if (mountedRef.current) {
            setMessages((prev) =>
              prev.map((m) => (m.id === tempId ? { ...serverMsg, _pending: false } : m))
            );
          }
          return serverMsg;
        } catch {
          // Queued — will need manual retry for file uploads
        }
      }

      return localMsg;
    },
    [groupId, currentUser]
  );

  // ── Mark read ─────────────────────────────────────────────────

  const markRead = useCallback(
    (lastMessageId: string) => {
      const db_op = async () => {
        const db = await getDatabase();
        await db.runAsync(
          `INSERT INTO group_message_read_cursors (group_id, user_id, last_read_msg_id, sync_status)
           VALUES (?, ?, ?, 'pending')
           ON CONFLICT(group_id, user_id) DO UPDATE SET last_read_msg_id = excluded.last_read_msg_id, sync_status = 'pending', updated_at = datetime('now')`,
          [groupId, currentUser.id, lastMessageId]
        );
      };
      db_op().catch(() => {});

      if (isOnline()) {
        markReadREST(groupId, lastMessageId).catch(() => {});
      }
    },
    [groupId, currentUser.id]
  );

  // ── Get unread count from local DB ────────────────────────────

  const getUnreadCount = useCallback(async (): Promise<number> => {
    const db = await getDatabase();
    const cursor = await db.getFirstAsync<{ last_read_msg_id: string }>(
      `SELECT last_read_msg_id FROM group_message_read_cursors WHERE group_id = ? AND user_id = ?`,
      [groupId, currentUser.id]
    );

    if (!cursor) {
      const row = await db.getFirstAsync<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM group_messages WHERE group_id = ? AND is_deleted = 0`,
        [groupId]
      );
      return row?.cnt ?? 0;
    }

    const row = await db.getFirstAsync<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM group_messages 
       WHERE group_id = ? AND is_deleted = 0 AND created_at > (SELECT created_at FROM group_messages WHERE id = ?)`,
      [groupId, cursor.last_read_msg_id]
    );
    return row?.cnt ?? 0;
  }, [groupId, currentUser.id]);

  return {
    messages,
    hasMore,
    loadingMore,
    loadMessages,
    sendText,
    sendFiles,
    markRead,
    getUnreadCount,
  };
}
