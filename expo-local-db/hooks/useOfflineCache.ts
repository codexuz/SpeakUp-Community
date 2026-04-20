import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { getDatabase } from "../database";
import { isOnline } from "./useNetwork";

type FetchStatus = "idle" | "loading" | "success" | "error";

interface UseOfflineCacheOptions<T> {
  /** Unique key for this cache entry */
  cacheKey: string;
  /** The API call that fetches fresh data */
  apiFn: () => Promise<T>;
  /** Whether to run. Defaults to true. */
  enabled?: boolean;
  /** Refetch when these values change */
  deps?: any[];
  /** How long (ms) before cached data is considered stale. Default 60_000. */
  staleTime?: number;
}

interface UseOfflineCacheResult<T> {
  data: T | null;
  status: FetchStatus;
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * JSON-based offline cache hook.
 *
 * Stores the full API response as a JSON blob in SQLite's kv_store.
 * Ideal for endpoints returning complex nested objects that don't map
 * well to flat SQLite tables (e.g. community feed, user profiles).
 *
 * 1. **Instant** — reads cached JSON from kv_store
 * 2. **Background fetch** — if online & stale, fetches from API
 * 3. **Cache update** — writes JSON back to kv_store
 * 4. **Offline** — silently skips network, UI stays populated from cache
 */
export function useOfflineCache<T>(
  options: UseOfflineCacheOptions<T>
): UseOfflineCacheResult<T> {
  const {
    cacheKey,
    apiFn,
    enabled = true,
    deps = [],
    staleTime = 60_000,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<FetchStatus>("idle");
  const [error, setError] = useState<Error | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const mountedRef = useRef(true);
  const fetchingRef = useRef(false);

  const dataKey = `cache_data_${cacheKey}`;
  const timeKey = `cache_time_${cacheKey}`;

  // ── Read from cache ──────────────────────────────────────────

  const readCache = useCallback(async () => {
    try {
      const db = await getDatabase();
      const row = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM kv_store WHERE key = ?",
        [dataKey]
      );
      if (row?.value && mountedRef.current) {
        setData(JSON.parse(row.value));
      }
    } catch {
      // kv_store may not exist yet
    }
  }, [dataKey]);

  // ── Fetch from API & update cache ────────────────────────────

  const fetchRemote = useCallback(
    async (force = false) => {
      if (fetchingRef.current) return;
      if (!isOnline()) return;

      if (!force) {
        try {
          const db = await getDatabase();
          const row = await db.getFirstAsync<{ value: string }>(
            "SELECT value FROM kv_store WHERE key = ?",
            [timeKey]
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

        // Write to cache
        const db = await getDatabase();
        const json = JSON.stringify(apiData);
        await db.runAsync(
          "INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)",
          [dataKey, json]
        );
        await db.runAsync(
          "INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)",
          [timeKey, new Date().toISOString()]
        );

        if (mountedRef.current) {
          setData(apiData);
          setStatus("success");
          setError(null);
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(err as Error);
          setStatus(data !== null ? "success" : "error");
        }
      } finally {
        fetchingRef.current = false;
      }
    },
    [apiFn, dataKey, timeKey, staleTime, data]
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

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      readCache();
      fetchRemote();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, ...deps])
  );

  return {
    data,
    status,
    isLoading: status === "loading" && data === null,
    isRefreshing,
    error,
    refresh,
  };
}
