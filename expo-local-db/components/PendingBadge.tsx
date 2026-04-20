/**
 * Small badge showing the number of pending sync items.
 * Like Telegram's unsent message indicators.
 */

import { TG } from "@/constants/theme";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { getDatabase } from "../database";

interface PendingBadgeProps {
  /** If provided, only count pending items for this table */
  table?: string;
  /** Badge size. Defaults to 'small'. */
  size?: "small" | "large";
}

export function PendingBadge({ table, size = "small" }: PendingBadgeProps) {
  const [count, setCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const db = await getDatabase();
          const sql = table
            ? `SELECT COUNT(*) as cnt FROM sync_queue WHERE table_name = ?`
            : `SELECT COUNT(*) as cnt FROM sync_queue`;
          const params = table ? [table] : [];
          const row = await db.getFirstAsync<{ cnt: number }>(sql, params);
          if (!cancelled) setCount(row?.cnt ?? 0);
        } catch {
          /* ignore */
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [table])
  );

  if (count === 0) return null;

  const isSmall = size === "small";
  const label = count > 99 ? "99+" : String(count);

  return (
    <View
      style={[
        styles.badge,
        isSmall ? styles.badgeSmall : styles.badgeLarge,
      ]}
    >
      <Text style={[styles.text, isSmall ? styles.textSmall : styles.textLarge]}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Inline sync status text — "Syncing..." / "2 pending"
 * For use in headers or status lines.
 */
export function SyncStatusText({ table }: { table?: string }) {
  const [count, setCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const db = await getDatabase();
          const sql = table
            ? `SELECT COUNT(*) as cnt FROM sync_queue WHERE table_name = ?`
            : `SELECT COUNT(*) as cnt FROM sync_queue`;
          const params = table ? [table] : [];
          const row = await db.getFirstAsync<{ cnt: number }>(sql, params);
          if (!cancelled) setCount(row?.cnt ?? 0);
        } catch {
          /* ignore */
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [table])
  );

  if (count === 0) return null;

  return (
    <Text style={styles.statusText}>
      {count} pending {count === 1 ? "change" : "changes"}
    </Text>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: TG.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeSmall: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
  },
  badgeLarge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 6,
  },
  text: {
    color: TG.textWhite,
    fontWeight: "700",
    textAlign: "center",
  },
  textSmall: {
    fontSize: 10,
  },
  textLarge: {
    fontSize: 12,
  },
  statusText: {
    fontSize: 12,
    color: TG.orange,
    fontWeight: "500",
  },
});
