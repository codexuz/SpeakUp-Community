import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import {
  getPendingSyncItems,
  removeSyncItem,
  markSyncItemRetry,
  bulkUpsert,
  SyncQueueItem,
  getDatabase,
} from "./database";

// ─── Configuration ──────────────────────────────────────────────

const MAX_RETRIES = 5;
const SYNC_INTERVAL_MS = 30_000; // 30 seconds when online

let syncIntervalId: ReturnType<typeof setInterval> | null = null;
let isSyncing = false;

// ─── Network Listener ───────────────────────────────────────────

export function startSyncService(apiBaseUrl: string, getToken: () => string | null): void {
  // Initial sync attempt
  attemptSync(apiBaseUrl, getToken);

  // Listen for connectivity changes
  NetInfo.addEventListener((state: NetInfoState) => {
    if (state.isConnected) {
      attemptSync(apiBaseUrl, getToken);
      if (!syncIntervalId) {
        syncIntervalId = setInterval(() => attemptSync(apiBaseUrl, getToken), SYNC_INTERVAL_MS);
      }
    } else {
      if (syncIntervalId) {
        clearInterval(syncIntervalId);
        syncIntervalId = null;
      }
    }
  });
}

export function stopSyncService(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }
}

// ─── Push Local Changes to Server ───────────────────────────────

async function attemptSync(apiBaseUrl: string, getToken: () => string | null): Promise<void> {
  if (isSyncing) return;
  isSyncing = true;

  try {
    await pushLocalChanges(apiBaseUrl, getToken);
    await pullServerChanges(apiBaseUrl, getToken);
  } catch (err) {
    console.warn("[Sync] sync cycle error:", err);
  } finally {
    isSyncing = false;
  }
}

async function pushLocalChanges(apiBaseUrl: string, getToken: () => string | null): Promise<void> {
  const items = await getPendingSyncItems(50);
  const token = getToken();
  if (!token || items.length === 0) return;

  for (const item of items) {
    if (item.retries >= MAX_RETRIES) {
      // Dead-letter: skip but keep for manual resolution
      continue;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/sync/push`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          table: item.table_name,
          rowId: item.row_id,
          action: item.action,
          payload: JSON.parse(item.payload),
        }),
      });

      if (response.ok) {
        await removeSyncItem(item.id);

        // Mark the local row as synced
        const db = await getDatabase();
        await db.runAsync(
          `UPDATE ${item.table_name} SET sync_status = 'synced', last_synced_at = datetime('now') WHERE id = ?`,
          [item.row_id]
        );
      } else if (response.status === 409) {
        // Conflict – mark for manual resolution
        const db = await getDatabase();
        await db.runAsync(
          `UPDATE ${item.table_name} SET sync_status = 'conflict' WHERE id = ?`,
          [item.row_id]
        );
        await removeSyncItem(item.id);
      } else {
        await markSyncItemRetry(item.id, `HTTP ${response.status}`);
      }
    } catch (err) {
      await markSyncItemRetry(item.id, String(err));
    }
  }
}

// ─── Pull Server Changes ────────────────────────────────────────

// Tables to pull from the server (read-only content + user-specific data)
const PULL_TABLES = [
  "users",
  "tests",
  "questions",
  "sample_answers",
  "courses",
  "course_units",
  "lessons",
  "lectures",
  "lecture_attachments",
  "exercises",
  "exercise_options",
  "exercise_match_pairs",
  "exercise_word_bank_items",
  "exercise_conversation_lines",
  "achievements",
  "challenges",
  "ads",
  "writing_tests",
  "writing_tasks",
  "groups",
  "group_members",
] as const;

async function pullServerChanges(apiBaseUrl: string, getToken: () => string | null): Promise<void> {
  const token = getToken();
  if (!token) return;

  const db = await getDatabase();

  for (const table of PULL_TABLES) {
    try {
      // Get last sync timestamp for this table
      const row = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM kv_store WHERE key = ?",
        [`last_pull_${table}`]
      );
      const since = row?.value ?? "1970-01-01T00:00:00.000Z";

      const response = await fetch(
        `${apiBaseUrl}/sync/pull?table=${table}&since=${encodeURIComponent(since)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) continue;

      const { data, serverTime } = (await response.json()) as {
        data: Record<string, unknown>[];
        serverTime: string;
      };

      if (data.length > 0) {
        await bulkUpsert(table, data);
      }

      // Update last pull timestamp
      await db.runAsync(
        "INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)",
        [`last_pull_${table}`, serverTime]
      );
    } catch (err) {
      console.warn(`[Sync] pull ${table} failed:`, err);
    }
  }
}

// ─── Conflict Resolution Helpers ────────────────────────────────

export async function getConflicts(tableName: string): Promise<Record<string, unknown>[]> {
  const db = await getDatabase();
  return await db.getAllAsync(
    `SELECT * FROM ${tableName} WHERE sync_status = 'conflict'`
  );
}

export async function resolveConflict(
  tableName: string,
  id: string | number,
  resolution: "keep_local" | "keep_server",
  serverData?: Record<string, unknown>
): Promise<void> {
  const db = await getDatabase();

  if (resolution === "keep_server" && serverData) {
    const keys = Object.keys(serverData);
    const setClauses = keys.map((k) => `${k} = ?`).join(", ");
    const values = keys.map((k) => {
      const v = serverData[k];
      if (v === null || v === undefined) return null;
      if (typeof v === "object") return JSON.stringify(v);
      return v;
    });

    await db.runAsync(
      `UPDATE ${tableName} SET ${setClauses}, sync_status = 'synced', last_synced_at = datetime('now') WHERE id = ?`,
      [...values, id]
    );
  } else {
    // keep_local → re-queue for push
    await db.runAsync(
      `UPDATE ${tableName} SET sync_status = 'pending' WHERE id = ?`,
      [id]
    );
  }
}
