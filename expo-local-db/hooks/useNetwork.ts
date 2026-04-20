import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { useCallback, useEffect, useRef, useState } from "react";

export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string | null;
  /** Timestamp of last connectivity change */
  lastChangedAt: number;
}

/**
 * Telegram-style network hook.
 * Returns real-time connectivity status and a `waitForOnline()` promise
 * that resolves once a connection is re-established.
 */
export function useNetwork() {
  const [status, setStatus] = useState<NetworkStatus>({
    isConnected: true,
    isInternetReachable: null,
    type: null,
    lastChangedAt: Date.now(),
  });

  const resolversRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const connected = !!state.isConnected;
      setStatus({
        isConnected: connected,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
        lastChangedAt: Date.now(),
      });

      if (connected) {
        // Resolve all waiters
        resolversRef.current.forEach((resolve) => resolve());
        resolversRef.current = [];
      }
    });

    return () => unsubscribe();
  }, []);

  /** Returns a promise that resolves when the device comes back online */
  const waitForOnline = useCallback((): Promise<void> => {
    if (status.isConnected) return Promise.resolve();
    return new Promise<void>((resolve) => {
      resolversRef.current.push(resolve);
    });
  }, [status.isConnected]);

  return { ...status, waitForOnline };
}

// ─── Singleton for non-hook contexts ─────────────────────────

let _connected = true;

NetInfo.addEventListener((state) => {
  _connected = !!state.isConnected;
});

/** Check connectivity outside of React components */
export function isOnline(): boolean {
  return _connected;
}
