/**
 * SpeakUp Community – Offline-First Module
 *
 * Drop-in Telegram-style offline support.
 * Import everything from here:
 *
 *   import { useOfflineFirst, useNetwork, OfflineIndicator } from '@/expo-local-db';
 */

// ─── Database core ──────────────────────────────────────────────
export {
    bulkUpsert, closeDatabase,
    generateUUID, getDatabase, getPendingSyncItems, getRowById, insertRow, markSyncItemRetry, queryRows, removeSyncItem, softDeleteRow, updateRow
} from "./database";
export type { SyncQueueItem, SyncStatus } from "./database";

// ─── Sync engine ────────────────────────────────────────────────
export { getConflicts, resolveConflict, startSyncService, stopSyncService } from "./syncService";

// ─── React hooks ────────────────────────────────────────────────
export { isOnline, useNetwork } from "./hooks/useNetwork";
export { useOfflineFirst, useOfflineItem } from "./hooks/useOfflineFirst";
export { useOfflineMutation } from "./hooks/useOfflineMutation";

// ─── Offline API presets ────────────────────────────────────────
export {
    offlineAchievements, offlineAds, offlineChallenges, offlineComment, offlineCommunityFeed, offlineCourses, offlineGroupDetail,
    offlineGroupMembers,
    offlineGroupSubmissions, offlineLeaderboard,
    offlineLikeSession, offlineMyGroups, offlineProgress, offlineReview, offlineTests, offlineUnlikeSession
} from "./offlineApi";

// ─── Offline chat ───────────────────────────────────────────────
export { useOfflineChat } from "./offlineChat";

// ─── Media cache ────────────────────────────────────────────────
export {
    clearCache, clearOldCache, getCachedPath, getCachedUri, getCacheSize, isCached, prefetchMedia
} from "./mediaCache";

// ─── UI components ──────────────────────────────────────────────
export { CachedImage } from "./components/CachedImage";
export { OfflineIndicator } from "./components/OfflineIndicator";
export { PendingBadge, SyncStatusText } from "./components/PendingBadge";

