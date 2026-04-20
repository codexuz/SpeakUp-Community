import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { useCallback, useEffect, useRef, useState } from "react";

export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string | null;
  lastChangedAt: number;
}

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
        resolversRef.current.forEach((resolve) => resolve());
        resolversRef.current = [];
      }
    });

    return () => unsubscribe();
  }, []);

  const waitForOnline = useCallback((): Promise<void> => {
    if (status.isConnected) return Promise.resolve();
    return new Promise<void>((resolve) => {
      resolversRef.current.push(resolve);
    });
  }, [status.isConnected]);

  return { ...status, waitForOnline };
}
