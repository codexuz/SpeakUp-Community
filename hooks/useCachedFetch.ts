import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

type FetchStatus = 'idle' | 'loading' | 'success' | 'error';

interface UseCachedFetchOptions<T> {
  /** Unique key for this cache entry in AsyncStorage */
  cacheKey: string;
  /** The API call that fetches data from the server */
  apiFn: () => Promise<T>;
  /** Whether to run. Defaults to true. */
  enabled?: boolean;
  /** Refetch when these values change */
  deps?: any[];
  /** How long (ms) before cached data is considered stale. Default 60_000 (1 min). */
  staleTime?: number;
}

interface UseCachedFetchResult<T> {
  data: T | null;
  status: FetchStatus;
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  /** Pull-to-refresh handler */
  refresh: () => Promise<void>;
}

const CACHE_PREFIX = '@cache_';
const TIME_PREFIX = '@cache_time_';

/**
 * Server-first fetch hook with AsyncStorage caching for offline use.
 *
 * 1. Reads cached data from AsyncStorage (instant render)
 * 2. Fetches from API if online & data is stale
 * 3. Caches fresh API response in AsyncStorage
 * 4. On API failure, falls back to cached data
 */
export function useCachedFetch<T>(
  options: UseCachedFetchOptions<T>
): UseCachedFetchResult<T> {
  const {
    cacheKey,
    apiFn,
    enabled = true,
    deps = [],
    staleTime = 60_000,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<FetchStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const mountedRef = useRef(true);
  const fetchingRef = useRef(false);

  const dataKey = `${CACHE_PREFIX}${cacheKey}`;
  const timeKey = `${TIME_PREFIX}${cacheKey}`;

  // ── Read from AsyncStorage cache ─────────────────────────────

  const readCache = useCallback(async () => {
    try {
      const cached = await AsyncStorage.getItem(dataKey);
      if (cached && mountedRef.current) {
        setData(JSON.parse(cached));
      }
    } catch {
      // ignore read errors
    }
  }, [dataKey]);

  // ── Fetch from API & update cache ────────────────────────────

  const fetchRemote = useCallback(
    async (force = false) => {
      if (fetchingRef.current) return;

      // Check staleness
      if (!force) {
        try {
          const lastTime = await AsyncStorage.getItem(timeKey);
          if (lastTime) {
            const elapsed = Date.now() - new Date(lastTime).getTime();
            if (elapsed < staleTime) return;
          }
        } catch {
          /* continue */
        }
      }

      fetchingRef.current = true;
      if (!mountedRef.current) { fetchingRef.current = false; return; }
      setStatus('loading');

      try {
        const apiData = await apiFn();

        // Write to cache
        await AsyncStorage.setItem(dataKey, JSON.stringify(apiData));
        await AsyncStorage.setItem(timeKey, new Date().toISOString());

        if (mountedRef.current) {
          setData(apiData);
          setStatus('success');
          setError(null);
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(err as Error);
          // Only set error status if we have no cached data
          setStatus(data !== null ? 'success' : 'error');
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

  // ── Lifecycle: read cache instantly, then fetch in background ─

  useFocusEffect(
    useCallback(() => {
      mountedRef.current = true;
      if (!enabled) return;
      readCache();
      fetchRemote();
      return () => { mountedRef.current = false; };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, ...deps])
  );

  return {
    data,
    status,
    isLoading: status === 'loading' && data === null,
    isRefreshing,
    error,
    refresh,
  };
}
