/**
 * Offline-first API bridge — domain-specific queries that read from
 * local SQLite first and background-sync from the server API.
 *
 * Each function returns the args needed by `useOfflineFirst` or
 * `useOfflineMutation`, so screens can swap API calls with one-liners.
 */

import {
  apiCommentOnSession,
  apiFetchAchievements,
  apiFetchActiveAds,
  apiFetchChallenges,
  apiFetchCommunityFeed,
  apiFetchCourses,
  apiFetchGroupById,
  apiFetchGroupMembers,
  apiFetchGroupSubmissions,
  apiFetchLeaderboard,
  apiFetchMyGroups,
  apiFetchMySpeaking,
  apiFetchPendingSpeaking,
  apiFetchProgress,
  apiFetchTests,
  apiFetchWeeklySummary,
  apiLikeSession,
  apiPostReview,
  apiUnlikeSession
} from "@/lib/api";

// ─── Helper: camelCase → snake_case ─────────────────────────────

function toSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function mapKeys(obj: Record<string, any>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    const snakeKey = toSnake(key);
    if (val !== undefined) {
      result[snakeKey] =
        typeof val === "object" && val !== null && !Array.isArray(val)
          ? JSON.stringify(val)
          : Array.isArray(val)
            ? JSON.stringify(val)
            : typeof val === "boolean"
              ? val ? 1 : 0
              : val;
    }
  }
  return result;
}

// ─── Tests ──────────────────────────────────────────────────────

export function offlineTests(opts?: { testType?: "cefr" | "ielts"; isPublished?: boolean }) {
  return {
    table: "tests",
    where: opts?.isPublished !== undefined ? "is_published = ?" : undefined,
    params: opts?.isPublished !== undefined ? [opts.isPublished ? 1 : 0] : undefined,
    orderBy: "created_at DESC",
    apiFn: async () => {
      const res = await apiFetchTests({ ...opts, limit: 100 });
      return res.data;
    },
    mapApiToRow: (item: any) => mapKeys(item),
    staleTime: 5 * 60_000, // 5 min
  };
}

// ─── Community Feed ─────────────────────────────────────────────

export function offlineCommunityFeed(
  strategy: string = "latest",
  page: number = 1,
  examType?: "cefr" | "ielts"
) {
  return {
    table: "test_sessions",
    where: "visibility = ?",
    params: ["community"],
    orderBy: "created_at DESC",
    limit: page * 20,
    apiFn: async () => {
      const res = await apiFetchCommunityFeed(strategy, page, 20, examType);
      return res.data;
    },
    mapApiToRow: (item: any) => {
      const row = mapKeys(item);
      // Flatten nested user into user_id
      if (item.user?.id) row.user_id = item.user.id;
      if (item.test?.id) row.test_id = item.test.id;
      return row;
    },
    kvKey: `offline_community_${strategy}_${examType ?? "all"}`,
    staleTime: 30_000, // 30 sec — feed should be fresh
  };
}

// ─── Groups ─────────────────────────────────────────────────────

export function offlineMyGroups() {
  return {
    table: "groups",
    orderBy: "created_at DESC",
    apiFn: async () => {
      return await apiFetchMyGroups();
    },
    mapApiToRow: (item: any) => mapKeys(item),
    staleTime: 2 * 60_000,
  };
}

export function offlineGroupDetail(groupId: string) {
  return {
    table: "groups",
    id: groupId,
    apiFn: async () => {
      return await apiFetchGroupById(groupId);
    },
    mapApiToRow: (item: any) => mapKeys(item),
    staleTime: 60_000,
  };
}

export function offlineGroupMembers(groupId: string) {
  return {
    table: "group_members",
    where: "group_id = ?",
    params: [groupId],
    apiFn: async () => {
      return await apiFetchGroupMembers(groupId);
    },
    mapApiToRow: (item: any) => mapKeys(item),
    staleTime: 2 * 60_000,
  };
}

export function offlineGroupSubmissions(groupId: string, page: number = 1) {
  return {
    table: "test_sessions",
    where: "group_id = ?",
    params: [groupId],
    orderBy: "created_at DESC",
    limit: page * 20,
    apiFn: async () => {
      const res = await apiFetchGroupSubmissions(groupId, page, 20);
      return res.data;
    },
    mapApiToRow: (item: any) => mapKeys(item),
    kvKey: `offline_group_subs_${groupId}`,
    staleTime: 30_000,
  };
}

// ─── Courses ────────────────────────────────────────────────────

export function offlineCourses(level?: string) {
  return {
    table: "courses",
    where: level ? "level = ? AND is_published = 1" : "is_published = 1",
    params: level ? [level] : undefined,
    orderBy: '"order" ASC',
    apiFn: async () => {
      return await apiFetchCourses(level);
    },
    mapApiToRow: (item: any) => mapKeys(item),
    staleTime: 10 * 60_000, // 10 min — courses change rarely
  };
}

// ─── Challenges ─────────────────────────────────────────────────

export function offlineChallenges(type?: "daily" | "weekly" | "special") {
  return {
    table: "challenges",
    where: type ? "type = ? AND is_active = 1" : "is_active = 1",
    params: type ? [type] : undefined,
    orderBy: "ends_at ASC",
    apiFn: async () => {
      return await apiFetchChallenges(type);
    },
    mapApiToRow: (item: any) => mapKeys(item),
    staleTime: 5 * 60_000,
  };
}

// ─── Ads ────────────────────────────────────────────────────────

export function offlineAds() {
  return {
    table: "ads",
    where: "is_active = 1",
    orderBy: "created_at DESC",
    apiFn: async () => {
      return await apiFetchActiveAds();
    },
    mapApiToRow: (item: any) => mapKeys(item),
    staleTime: 10 * 60_000,
  };
}

// ─── Progress / Gamification ────────────────────────────────────

export function offlineProgress(userId: string) {
  return {
    table: "user_progress",
    where: "user_id = ?",
    params: [userId],
    apiFn: async () => {
      const data = await apiFetchProgress();
      return [data]; // Wrap in array for useOfflineFirst
    },
    mapApiToRow: (item: any) => mapKeys(item),
    staleTime: 60_000,
  };
}

export function offlineAchievements() {
  return {
    table: "achievements",
    orderBy: "category ASC",
    apiFn: async () => {
      return await apiFetchAchievements();
    },
    mapApiToRow: (item: any) => mapKeys(item),
    staleTime: 10 * 60_000,
  };
}

export function offlineLeaderboard(type: string = "weekly", limit: number = 20) {
  return {
    table: "user_progress",
    orderBy: type === "weekly" ? "weekly_xp DESC" : "xp DESC",
    limit,
    apiFn: async () => {
      const res = await apiFetchLeaderboard(type as any, limit);
      // Leaderboard returns {data, userRank, userProgress}
      return (res as any).data ?? [];
    },
    mapApiToRow: (item: any) => {
      if (item.user) {
        return { ...mapKeys(item), user_id: item.user.id };
      }
      return mapKeys(item);
    },
    kvKey: `offline_leaderboard_${type}`,
    staleTime: 2 * 60_000,
  };
}

// ─── My Speaking Recordings ─────────────────────────────────────

export function offlineMySpeaking(page: number = 1) {
  return {
    table: "test_sessions",
    where: "visibility IN ('private', 'community')",
    orderBy: "created_at DESC",
    limit: page * 20,
    apiFn: async () => {
      const res = await apiFetchMySpeaking(page, 20);
      return (res as any).data ?? res ?? [];
    },
    mapApiToRow: (item: any) => {
      const row = mapKeys(item);
      if (item.user?.id) row.user_id = item.user.id;
      if (item.test?.id) row.test_id = item.test.id;
      return row;
    },
    kvKey: `offline_my_speaking`,
    staleTime: 60_000,
  };
}

// ─── Pending Speaking (Teacher Reviews) ─────────────────────────

export function offlinePendingSpeaking(page: number = 1) {
  return {
    table: "test_sessions",
    where: "visibility = ?",
    params: ["community"],
    orderBy: "created_at DESC",
    limit: page * 20,
    apiFn: async () => {
      const res = await apiFetchPendingSpeaking(page, 20);
      return (res as any).data ?? res ?? [];
    },
    mapApiToRow: (item: any) => {
      const row = mapKeys(item);
      if (item.user?.id) row.user_id = item.user.id;
      if (item.test?.id) row.test_id = item.test.id;
      return row;
    },
    kvKey: `offline_pending_speaking`,
    staleTime: 30_000,
  };
}

// ─── Weekly Summary ─────────────────────────────────────────────

export function offlineWeeklySummary() {
  return {
    table: "kv_store",
    apiFn: async () => {
      const data = await apiFetchWeeklySummary();
      // Store as KV — it doesn't fit a regular table
      return [{ key: "weekly_summary", value: JSON.stringify(data) }];
    },
    where: "key = ?",
    params: ["weekly_summary"],
    idField: "key",
    staleTime: 5 * 60_000,
    kvKey: "offline_weekly_summary",
  };
}

// ─── Mutations ──────────────────────────────────────────────────

export function offlineLikeSession(sessionId: string) {
  return {
    table: "likes",
    action: "create" as const,
    apiFn: async (_input: { userId: string }) => {
      return await apiLikeSession(sessionId);
    },
    mapToRow: (input: { userId: string }) => ({
      session_id: sessionId,
      user_id: input.userId,
    }),
  };
}

export function offlineUnlikeSession(sessionId: string) {
  return {
    table: "likes",
    action: "delete" as const,
    apiFn: async (_input: { id: number }) => {
      return await apiUnlikeSession(sessionId);
    },
    mapToRow: (input: { id: number }) => ({
      id: input.id,
    }),
  };
}

export function offlineComment(sessionId: string) {
  return {
    table: "comments",
    action: "create" as const,
    apiFn: async (input: { userId: string; text: string; replyToId?: string }) => {
      return await apiCommentOnSession(sessionId, input.text, input.replyToId);
    },
    mapToRow: (input: { userId: string; text: string }) => ({
      session_id: sessionId,
      user_id: input.userId,
      text: input.text,
    }),
  };
}

export function offlineReview(sessionId: string) {
  return {
    table: "reviews",
    action: "create" as const,
    apiFn: async (input: { score: number; feedback: string }) => {
      return await apiPostReview(sessionId, input.score, input.feedback);
    },
    mapToRow: (input: { userId: string; score: number; feedback: string }) => ({
      session_id: sessionId,
      reviewer_id: input.userId,
      score: input.score,
      feedback: input.feedback,
    }),
  };
}
