import { Asset } from "expo-asset";
import * as Crypto from "expo-crypto";
import * as FileSystem from "expo-file-system/legacy";
import * as SQLite from "expo-sqlite";

// ─── Database Instance ──────────────────────────────────────────

const DB_NAME = "speakup.db";
let _db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync(DB_NAME);
  await _db.execAsync("PRAGMA journal_mode = WAL;");
  await _db.execAsync("PRAGMA foreign_keys = ON;");
  await initializeDatabase(_db);
  return _db;
}

export async function closeDatabase(): Promise<void> {
  if (_db) {
    await _db.closeAsync();
    _db = null;
  }
}

// ─── UUID Helper ────────────────────────────────────────────────

export function generateUUID(): string {
  return Crypto.randomUUID();
}

// ─── Schema Initialization ──────────────────────────────────────

async function initializeDatabase(db: SQLite.SQLiteDatabase): Promise<void> {
  const version = await getKV(db, "schema_version");

  if (!version) {
    // First run – create all tables
    const schemaSQL = await loadSchemaSQL();
    await db.execAsync(schemaSQL);
    await setKV(db, "schema_version", "2");
  }

  // Migration: v1 → v2 (group_messages.id changed from INTEGER to TEXT)
  if (version === '1') {
    // Drop and recreate affected tables — messages are re-synced from server
    await db.execAsync(`DROP TABLE IF EXISTS group_message_attachments`);
    await db.execAsync(`DROP TABLE IF EXISTS group_message_read_cursors`);
    await db.execAsync(`DROP TABLE IF EXISTS group_messages`);
    const schemaSQL = await loadSchemaSQL();
    await db.execAsync(schemaSQL);
    await setKV(db, 'schema_version', '2');
  }

  // Future migrations go here:
  // if (version === '2') { await migrateV2ToV3(db); await setKV(db, 'schema_version', '3'); }
}

async function loadSchemaSQL(): Promise<string> {
  // The schema.sql is bundled as an asset.
  // In your app.json/metro config, add .sql to assetExts.
  // Alternatively, paste the SQL inline or import it.
  const asset = Asset.fromModule(require("./schema.sql"));
  await asset.downloadAsync();
  if (!asset.localUri) throw new Error("Failed to load schema.sql asset");
  return await FileSystem.readAsStringAsync(asset.localUri);
}

// ─── KV Store Helpers ───────────────────────────────────────────

async function getKV(
  db: SQLite.SQLiteDatabase,
  key: string
): Promise<string | null> {
  try {
    const row = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM kv_store WHERE key = ?",
      [key]
    );
    return row?.value ?? null;
  } catch {
    return null; // Table may not exist yet on first run
  }
}

async function setKV(
  db: SQLite.SQLiteDatabase,
  key: string,
  value: string
): Promise<void> {
  await db.runAsync(
    "INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)",
    [key, value]
  );
}

// ─── Sync Status Types ──────────────────────────────────────────

export type SyncStatus = "synced" | "pending" | "conflict";

// ─── Generic CRUD Helpers ───────────────────────────────────────

export async function insertRow<T extends Record<string, unknown>>(
  tableName: string,
  data: T
): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const row: Record<string, unknown> = {
    ...data,
    sync_status: "pending",
    updated_at: now,
    is_deleted: 0,
  };

  const keys = Object.keys(row);
  const placeholders = keys.map(() => "?").join(", ");
  const values = keys.map((k) => {
    const v = row[k];
    if (v === null || v === undefined) return null;
    if (typeof v === "object") return JSON.stringify(v);
    return v;
  });

  await db.runAsync(
    `INSERT INTO ${tableName} (${keys.join(", ")}) VALUES (${placeholders})`,
    values as SQLite.SQLiteBindParams
  );

  await enqueueSyncAction(db, tableName, String(data.id ?? ""), "create", row);
}

export async function updateRow(
  tableName: string,
  id: string | number,
  data: Record<string, unknown>
): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {
    ...data,
    sync_status: "pending",
    updated_at: now,
  };

  const setClauses = Object.keys(updates)
    .map((k) => `${k} = ?`)
    .join(", ");
  const values = Object.keys(updates).map((k) => {
    const v = updates[k];
    if (v === null || v === undefined) return null;
    if (typeof v === "object") return JSON.stringify(v);
    return v;
  });
  values.push(id);

  await db.runAsync(
    `UPDATE ${tableName} SET ${setClauses} WHERE id = ?`,
    values as SQLite.SQLiteBindParams
  );

  await enqueueSyncAction(db, tableName, String(id), "update", updates);
}

export async function softDeleteRow(
  tableName: string,
  id: string | number
): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE ${tableName} SET is_deleted = 1, sync_status = 'pending', updated_at = ? WHERE id = ?`,
    [now, id]
  );

  await enqueueSyncAction(db, tableName, String(id), "delete", { id });
}

export async function getRowById<T>(
  tableName: string,
  id: string | number
): Promise<T | null> {
  const db = await getDatabase();
  return (
    (await db.getFirstAsync<T>(
      `SELECT * FROM ${tableName} WHERE id = ? AND is_deleted = 0`,
      [id]
    )) ?? null
  );
}

export async function queryRows<T>(
  tableName: string,
  where?: string,
  params?: SQLite.SQLiteBindParams,
  orderBy?: string,
  limit?: number
): Promise<T[]> {
  const db = await getDatabase();
  let sql = `SELECT * FROM ${tableName} WHERE is_deleted = 0`;
  if (where) sql += ` AND ${where}`;
  if (orderBy) sql += ` ORDER BY ${orderBy}`;
  if (limit) sql += ` LIMIT ${limit}`;
  return await db.getAllAsync<T>(sql, params ?? []);
}

// ─── Sync Queue ─────────────────────────────────────────────────

async function enqueueSyncAction(
  db: SQLite.SQLiteDatabase,
  tableName: string,
  rowId: string,
  action: "create" | "update" | "delete",
  payload: Record<string, unknown>
): Promise<void> {
  await db.runAsync(
    `INSERT INTO sync_queue (table_name, row_id, action, payload) VALUES (?, ?, ?, ?)`,
    [tableName, rowId, action, JSON.stringify(payload)]
  );
}

export async function getPendingSyncItems(
  limit = 50
): Promise<SyncQueueItem[]> {
  const db = await getDatabase();
  return await db.getAllAsync<SyncQueueItem>(
    `SELECT * FROM sync_queue ORDER BY created_at ASC LIMIT ?`,
    [limit]
  );
}

export async function removeSyncItem(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [id]);
}

export async function markSyncItemRetry(
  id: number,
  error: string
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE sync_queue SET retries = retries + 1, last_error = ? WHERE id = ?`,
    [error, id]
  );
}

export interface SyncQueueItem {
  id: number;
  table_name: string;
  row_id: string;
  action: "create" | "update" | "delete";
  payload: string; // JSON
  created_at: string;
  retries: number;
  last_error: string | null;
}

// ─── Bulk Upsert (for pulling server data) ──────────────────────

export async function bulkUpsert<T extends Record<string, unknown>>(
  tableName: string,
  rows: T[],
  idField = "id"
): Promise<void> {
  if (rows.length === 0) return;
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    for (const row of rows) {
      const keys = Object.keys(row);
      const placeholders = keys.map(() => "?").join(", ");
      const updates = keys
        .filter((k) => k !== idField)
        .map((k) => `${k} = excluded.${k}`)
        .join(", ");

      const values = keys.map((k) => {
        const v = row[k];
        if (v === null || v === undefined) return null;
        if (typeof v === "object") return JSON.stringify(v);
        return v;
      });

      await db.runAsync(
        `INSERT INTO ${tableName} (${keys.join(", ")}) VALUES (${placeholders})
         ON CONFLICT(${idField}) DO UPDATE SET ${updates}, sync_status = 'synced', last_synced_at = datetime('now')`,
        values as SQLite.SQLiteBindParams
      );
    }
  });
}
