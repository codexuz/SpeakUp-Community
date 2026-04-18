import { apiGetTelegramLink } from '@/lib/api';
import React, { createContext, useCallback, useContext, useState } from 'react';
import { useAuth } from './auth';

interface TelegramContextType {
  linked: boolean;
  deepLink: string | null;
  loading: boolean;
  checkLink: () => Promise<void>;
}

const TelegramContext = createContext<TelegramContextType>({
  linked: false,
  deepLink: null,
  loading: false,
  checkLink: async () => {},
});

export function TelegramProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [linked, setLinked] = useState(false);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const checkLink = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const data = await apiGetTelegramLink();
      setLinked(data.linked);
      setDeepLink(data.deepLink);
    } catch {
      // silently fail — will retry on next check
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  return (
    <TelegramContext.Provider value={{ linked, deepLink, loading, checkLink }}>
      {children}
    </TelegramContext.Provider>
  );
}

export function useTelegram() {
  return useContext(TelegramContext);
}
