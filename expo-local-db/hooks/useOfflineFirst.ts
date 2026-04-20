import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { bulkUpsert, getDatabase, queryRows } from "../database";
import { isOnline } from "./useNetwork";

type FetchStatus = "idle" | "loading" | "success" | "error";

interface UseOfflineFirstOptions<T> {
  /** SQLite table to read from / write cache to */
  table: string;
  /** WHERE clause for SQLite query (excluding `is_deleted = 0` which is automatic) */
  where?: string;
  /** Bind params for WHERE clause */
  params?: any[];
  /** ORDER BY clause */
  orderBy?: string;
  /** LIMIT */
  limit?: number;
  /** The API call that fetches fresh data from the server */
  apiFn: () => Promise<T[]>;
  /**
   * Transform API response rows to match SQLite column names.
   * Defaults to identity if not provided.
   */
  mapApiToRow?: (item: T) => Record<string, unknown>;
  /** Primary key field name for upsert. Defaults to 'id'. */
  idField?: string;
  /** Whether to fetch on component mount/focus. Defaults to true. */
  enabled?: boolean;
  /** Refetch when these values change */
  deps?: any[];
  /** Stale time in ms — skip network fetch if data was synced within this window. Defaults to 60_000 (1 min). */
  staleTime?: number;
  /** KV key for tracking last fetch time. Auto-generated from table if omitted. */
  kvKey?: string;
}

interface UseOfflineFirstResult<T> {
  data: T[];
  status: FetchStatus;
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  /** Pull-to-refresh handler */
  refresh: () => Promise<void>;
  /** How many rows are pending sync */
  pendingCount: number;
}

/**
 * Telegram-style offline-first data hook.
 *
 * 1. **Instant** — reads cached rows from SQLite (renders immediately)
 * 2. **Background fetch** — if online & data is stale, fetches from API
 * 3. **Cache update** — upserts API response into SQLite, triggers re-render
 * 4. **Offline** — silently skips network, UI stays populated from cache
 */
export function useOfflineFirst<T extends object>(
  options: UseOfflineFirstOptions<T>
): UseOfflineFirstResult<T> {
  const {
    table,
    where,
    params,
    orderBy,
    limit,
    apiFn,
    mapApiToRow,
    idField = "id",
    enabled = true,
    deps = [],
    staleTime = 60_000,
    kvKey,
  } = options;

  const [data, setData] = useState<T[]>([]);
  const [status, setStatus] = useState<FetchStatus>("idle");
  const [error, setError] = useState<Error | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const mountedRef = useRef(true);
  const fetchingRef = useRef(false);

  const cacheKey = kvKey ?? `offline_last_fetch_${table}`;

  // ── Read from local DB ───────────────────────────────────────

  const readLocal = useCallback(async () => {
    try {
      const rows = await queryRows<T>(table, where, params, orderBy, limit);
      if (mountedRef.current) setData(rows);

      // Count pending items for this table
      const db = await getDatabase();
      const result = await db.getFirstAsync<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM ${table} WHERE sync_status = 'pending' AND is_deleted = 0`
      );
      if (mountedRef.current) setPendingCount(result?.cnt ?? 0);
    } catch {
      // Table may not exist yet — ignore
    }
  }, [table, where, params, orderBy, limit]);

  // ── Fetch from API & update cache ────────────────────────────

  const fetchRemote = useCallback(
    async (force = false) => {
      if (fetchingRef.current) return;
      if (!isOnline()) return;

      // Check staleness
      if (!force) {
        try {
          const db = await getDatabase();
          const row = await db.getFirstAsync<{ value: string }>(
            "SELECT value FROM kv_store WHERE key = ?",
            [cacheKey]
          );
          if (row?.value) {
            const lastFetch = new Date(row.value).getTime();
            if (Date.now() - lastFetch < staleTime) return;
          }
        } catch {
          /* continue */
        }
      }

      fetchingRef.current = true;
      if (!mountedRef.current) return;
      setStatus("loading");

      try {
        const apiData = await apiFn();
        const rows = mapApiToRow
          ? apiData.map(mapApiToRow)
          : (apiData as Record<string, unknown>[]);

        if (rows.length > 0) {
          await bulkUpsert(table, rows, idField);
        }

        // Record fetch time
        const db = await getDatabase();
        await db.runAsync(
          "INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)",
          [cacheKey, new Date().toISOString()]
        );

        // Re-read from local DB (source of truth)
        await readLocal();
        if (mountedRef.current) {
          setStatus("success");
          setError(null);
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(err as Error);
          // Only set error status if we have no cached data
          setStatus(data.length > 0 ? "success" : "error");
        }
      } finally {
        fetchingRef.current = false;
      }
    },
    [apiFn, mapApiToRow, table, idField, readLocal, cacheKey, staleTime, data.length]
  );

  // ── Pull-to-refresh ──────────────────────────────────────────

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchRemote(true);
    setIsRefreshing(false);
  }, [fetchRemote]);

  // ── Lifecycle ────────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Load from cache instantly, then fetch in background
  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      readLocal();
      fetchRemote();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, ...deps])
  );

  return {
    data,
    status,
    isLoading: status === "loading" && data.length === 0,
    isRefreshing,
    error,
    refresh,
    pendingCount,
  };
}

// ─── Single-item variant ────────────────────────────────────────

interface UseOfflineItemOptions<T> {
  table: string;
  id: string | number;
  apiFn: () => Promise<T>;
  mapApiToRow?: (item: T) => Record<string, unknown>;
  idField?: string;
  enabled?: boolean;
  staleTime?: number;
}

interface UseOfflineItemResult<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Single-item offline-first hook.
 * Reads one row from SQLite cache, background-fetches if stale.
 */
export function useOfflineItem<T extends Record<string, unknown>>(
  options: UseOfflineItemOptions<T>
): UseOfflineItemResult<T> {
  const {
    table,
    id,
    apiFn,
    mapApiToRow,
    idField = "id",
    enabled = true,
    staleTime = 60_000,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  const loadLocal = useCallback(async () => {
    try {
      const rows = await queryRows<T>(table, `${idField} = ?`, [id], undefined, 1);
      if (mountedRef.current && rows.length > 0) {
        setData(rows[0]);
        setIsLoading(false);
      }
    } catch {
      /* ignore */
    }
  }, [table, id, idField]);

  const fetchRemote = useCallback(
    async (force = false) => {
      if (!isOnline()) {
        if (mountedRef.current) setIsLoading(false);
        return;
      }

      const kvKey = `offline_item_${table}_${id}`;
      if (!force) {
        try {
          const db = await getDatabase();
          const row = await db.getFirstAsync<{ value: string }>(
            "SELECT value FROM kv_store WHERE key = ?",
            [kvKey]
          );
          if (row?.value) {
            const last = new Date(row.value).getTime();
            if (Date.now() - last < staleTime) {
              if (mountedRef.current) setIsLoading(false);
              return;
            }
          }
        } catch {
          /* continue */
        }
      }

      try {
        const apiData = await apiFn();
        const row = mapApiToRow
          ? mapApiToRow(apiData)
          : (apiData as Record<string, unknown>);

        await bulkUpsert(table, [row], idField);

        const db = await getDatabase();
        await db.runAsync(
          "INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)",
          [kvKey, new Date().toISOString()]
        );

        await loadLocal();
        if (mountedRef.current) setError(null);
      } catch (err) {
        if (mountedRef.current) {
          setError(err as Error);
        }
      } finally {
        if (mountedRef.current) setIsLoading(false);
      }
    },
    [apiFn, mapApiToRow, table, id, idField, staleTime, loadLocal]
  );

  const refresh = useCallback(async () => {
    await fetchRemote(true);
  }, [fetchRemote]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      loadLocal();
      fetchRemote();
    }, [enabled, id])
  );

  return { data, isLoading, error, refresh };
}
