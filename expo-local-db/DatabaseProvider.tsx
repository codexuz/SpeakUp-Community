import React, { createContext, useContext, useEffect, useState } from "react";
import { getDatabase } from "./database";

interface DatabaseContextValue {
  isReady: boolean;
}

const DatabaseContext = createContext<DatabaseContextValue>({ isReady: false });

export function useDatabase() {
  return useContext(DatabaseContext);
}

/**
 * Wraps children in a gate that ensures the SQLite database
 * is fully initialised (tables created, migrations run) before
 * any `useOfflineFirst` / `useOfflineMutation` hook fires.
 */
export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await getDatabase(); // creates tables + runs migrations
      } catch (err) {
        console.error("[DB] init failed:", err);
      }
      if (!cancelled) setIsReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <DatabaseContext.Provider value={{ isReady }}>
      {children}
    </DatabaseContext.Provider>
  );
}
