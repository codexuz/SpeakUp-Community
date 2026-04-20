import { useCallback, useRef, useState } from "react";
import { generateUUID, getDatabase, insertRow, softDeleteRow, updateRow } from "../database";
import { isOnline } from "./useNetwork";

type MutationStatus = "idle" | "pending" | "success" | "error";

interface UseOfflineMutationOptions<TInput, TResult> {
  /** SQLite table for local write */
  table: string;
  /** The API call. Skipped when offline; queued for sync instead. */
  apiFn?: (input: TInput) => Promise<TResult>;
  /**
   * Transform input to a SQLite row for local insert/update.
   * Must return at least `{ id }`.
   */
  mapToRow: (input: TInput) => Record<string, unknown>;
  /** 'create' | 'update' | 'delete'. Determines local DB operation. */
  action?: "create" | "update" | "delete";
  /** Called after successful local write (optimistic). */
  onLocalSuccess?: (row: Record<string, unknown>) => void;
  /** Called after successful API response. */
  onRemoteSuccess?: (result: TResult) => void;
  /** Called on error (API or local). */
  onError?: (error: Error) => void;
}

interface UseOfflineMutationResult<TInput> {
  mutate: (input: TInput) => Promise<void>;
  status: MutationStatus;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Telegram-style optimistic mutation hook.
 *
 * 1. Writes to SQLite immediately (with `sync_status = 'pending'`)
 * 2. Enqueues in `sync_queue` for background sync
 * 3. If online, also attempts API call immediately
 * 4. UI updates instantly — the sync layer handles server push later
 */
export function useOfflineMutation<TInput = any, TResult = any>(
  options: UseOfflineMutationOptions<TInput, TResult>
): UseOfflineMutationResult<TInput> {
  const {
    table,
    apiFn,
    mapToRow,
    action = "create",
    onLocalSuccess,
    onRemoteSuccess,
    onError,
  } = options;

  const [status, setStatus] = useState<MutationStatus>("idle");
  const [error, setError] = useState<Error | null>(null);
  const mutatingRef = useRef(false);

  const mutate = useCallback(
    async (input: TInput) => {
      if (mutatingRef.current) return;
      mutatingRef.current = true;
      setStatus("pending");
      setError(null);

      try {
        const row = mapToRow(input);

        // ── Step 1: Local optimistic write ────────────────────
        switch (action) {
          case "create": {
            if (!row.id) row.id = generateUUID();
            await insertRow(table, row);
            break;
          }
          case "update": {
            const id = row.id;
            if (!id) throw new Error("Row id required for update");
            const { id: _, ...rest } = row;
            await updateRow(table, id as string | number, rest);
            break;
          }
          case "delete": {
            const id = row.id;
            if (!id) throw new Error("Row id required for delete");
            await softDeleteRow(table, id as string | number);
            break;
          }
        }

        onLocalSuccess?.(row);

        // ── Step 2: Attempt API call if online ────────────────
        if (isOnline() && apiFn) {
          try {
            const result = await apiFn(input);

            // Mark as synced
            const db = await getDatabase();
            await db.runAsync(
              `UPDATE ${table} SET sync_status = 'synced', last_synced_at = datetime('now') WHERE id = ?`,
              [row.id as string | number]
            );

            // Remove from sync queue
            await db.runAsync(
              `DELETE FROM sync_queue WHERE table_name = ? AND row_id = ?`,
              [table, String(row.id)]
            );

            onRemoteSuccess?.(result);
          } catch {
            // API failed — that's fine, sync queue will retry
            console.log(`[OfflineMutation] API call failed for ${table}, queued for sync`);
          }
        }

        setStatus("success");
      } catch (err) {
        const error = err as Error;
        setError(error);
        setStatus("error");
        onError?.(error);
      } finally {
        mutatingRef.current = false;
      }
    },
    [table, apiFn, mapToRow, action, onLocalSuccess, onRemoteSuccess, onError]
  );

  return {
    mutate,
    status,
    isLoading: status === "pending",
    error,
  };
}
