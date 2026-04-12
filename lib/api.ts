import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { getStoredAuthToken } from '@/store/auth';

function buildApiUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  const scheme = process.env.EXPO_PUBLIC_API_SCHEME || 'http';
  const host = process.env.EXPO_PUBLIC_API_HOST || 'localhost';
  const port = process.env.EXPO_PUBLIC_API_PORT ? `:${process.env.EXPO_PUBLIC_API_PORT}` : ':3000';

  return `${scheme}://${host}${port}/api`;
}

const API_URL = buildApiUrl();

function getUserAgent(): string {
  const name = Device.deviceName || Device.modelName || 'Unknown';
  const os = Platform.OS;
  const osVersion = Platform.Version;
  return `${name} (${os} ${osVersion})`;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_URL}${path}`;
  const token = await getStoredAuthToken();

  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': getUserAgent(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }

  return res.json();
}

// =============================================
// Auth
// =============================================

export async function apiLogin(username: string, password: string) {
  return request<any>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function apiRegister(payload: {
  username: string;
  fullName: string;
  password: string;
  gender?: string;
  region?: string;
  avatarUrl?: string;
}) {
  return request<any>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiUpdatePushToken(_userId: string, pushToken: string) {
  return request<any>('/auth/push-token', {
    method: 'PUT',
    body: JSON.stringify({ pushToken }),
  });
}

export async function apiLogout() {
  return request<any>('/auth/logout', { method: 'POST' });
}

export interface SessionItem {
  sessionId: string;
  userId: string;
  device: string;
  ip: string;
  createdAt: string;
  lastActiveAt: string;
  current: boolean;
}

export async function apiFetchSessions() {
  return request<{ sessions: SessionItem[] }>('/auth/sessions');
}

export async function apiRevokeSession(sessionId: string) {
  return request<{ success: boolean }>(`/auth/sessions/${sessionId}`, { method: 'DELETE' });
}

export async function apiRevokeAllSessions() {
  return request<{ revoked: number }>('/auth/sessions', { method: 'DELETE' });
}

// =============================================
// Tests
// =============================================

export async function apiFetchTests() {
  return request<any[]>('/tests');
}

export async function apiFetchQuestion(id: number) {
  return request<any>(`/tests/questions/${id}`);
}

// =============================================
// Speaking (replaces old /responses)
// =============================================

export async function apiSubmitSpeaking(
  questionId: number,
  audioUri: string,
  visibility: string = 'private',
  groupId?: string,
) {
  const url = `${API_URL}/speaking`;
  const token = await getStoredAuthToken();

  const formData = new FormData();
  formData.append('questionId', questionId.toString());
  formData.append('visibility', visibility);
  if (groupId) formData.append('groupId', groupId);
  formData.append('audio', {
    uri: audioUri,
    name: `response_${Date.now()}.m4a`,
    type: 'audio/m4a',
  } as any);

  const res = await fetch(url, {
    method: 'POST',
    body: formData,
    headers: {
      'User-Agent': getUserAgent(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Upload failed: ${res.status}`);
  }

  return res.json();
}

export async function apiFetchMySpeaking(page = 1, limit = 20) {
  return request<{ data: any[]; pagination: any }>(`/speaking/my?page=${page}&limit=${limit}`);
}

export async function apiFetchPendingSpeaking(page = 1, limit = 20) {
  return request<{ data: any[]; pagination: any }>(`/speaking/pending?page=${page}&limit=${limit}`);
}

export async function apiFetchSpeakingById(id: string) {
  return request<any>(`/speaking/${id}`);
}

export async function apiUpdateSpeaking(id: string, visibility: string) {
  return request<any>(`/speaking/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ visibility }),
  });
}

export async function apiDeleteSpeaking(id: string) {
  return request<any>(`/speaking/${id}`, { method: 'DELETE' });
}

// Likes
export async function apiLikeSpeaking(id: string) {
  return request<any>(`/speaking/${id}/like`, { method: 'POST' });
}

export async function apiUnlikeSpeaking(id: string) {
  return request<any>(`/speaking/${id}/like`, { method: 'DELETE' });
}

// Comments
export async function apiCommentOnSpeaking(id: string, text: string) {
  return request<any>(`/speaking/${id}/comment`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export async function apiFetchSpeakingComments(id: string, page = 1, limit = 20) {
  return request<{ data: any[]; pagination: any }>(`/speaking/${id}/comments?page=${page}&limit=${limit}`);
}

// =============================================
// Reviews
// =============================================

export async function apiPostReview(speakingId: string, score: number, feedback: string) {
  return request<any>(`/reviews/${speakingId}`, {
    method: 'POST',
    body: JSON.stringify({ score, feedback }),
  });
}

export async function apiFetchReviews(speakingId: string) {
  return request<any[]>(`/reviews/${speakingId}`);
}

export async function apiDeleteReview(speakingId: string) {
  return request<any>(`/reviews/${speakingId}`, { method: 'DELETE' });
}

// =============================================
// Community Feed
// =============================================

export async function apiFetchCommunityFeed(strategy: string = 'latest', page = 1, limit = 20) {
  return request<{ data: any[]; pagination: any; strategy: string }>(
    `/community/feed?strategy=${strategy}&page=${page}&limit=${limit}`,
  );
}

// =============================================
// Analytics (teacher only)
// =============================================

export async function apiFetchAnalyticsOverview() {
  return request<any>('/analytics/overview');
}

export async function apiFetchAnalyticsSubmissions(days = 30) {
  return request<any[]>(`/analytics/submissions?days=${days}`);
}

export async function apiFetchAnalyticsScores(days = 30) {
  return request<any[]>(`/analytics/scores?days=${days}`);
}

export async function apiFetchAnalyticsTeacherActivity(days = 30) {
  return request<any[]>(`/analytics/teacher-activity?days=${days}`);
}

// =============================================
// Groups
// =============================================

export async function apiFetchMyGroups() {
  return request<any[]>('/groups/my');
}

export async function apiFetchGroupById(groupId: string) {
  return request<any>(`/groups/${groupId}`);
}

export async function apiFetchGroupMembers(groupId: string) {
  return request<any[]>(`/groups/${groupId}/members`);
}

export async function apiFetchGroupSubmissions(groupId: string, page = 1, limit = 20) {
  return request<{ data: any[]; pagination: any }>(`/groups/${groupId}/submissions?page=${page}&limit=${limit}`);
}

export async function apiCreateGroup(name: string, description: string) {
  return request<any>('/groups', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });
}

export async function apiUpdateGroup(groupId: string, name: string, description: string) {
  return request<any>(`/groups/${groupId}`, {
    method: 'PUT',
    body: JSON.stringify({ name, description }),
  });
}

export async function apiDeleteGroup(groupId: string) {
  return request<any>(`/groups/${groupId}`, { method: 'DELETE' });
}

export async function apiRegenerateReferralCode(groupId: string) {
  return request<{ referralCode: string }>(`/groups/${groupId}/regenerate-code`, { method: 'POST' });
}

export async function apiJoinGroup(referralCode: string) {
  return request<any>('/groups/join', {
    method: 'POST',
    body: JSON.stringify({ referralCode }),
  });
}

export async function apiRequestJoinGroup(groupId: string, message?: string) {
  return request<any>(`/groups/${groupId}/request-join`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

export async function apiFetchJoinRequests(groupId: string) {
  return request<any[]>(`/groups/${groupId}/join-requests`);
}

export async function apiApproveJoinRequest(groupId: string, requestId: string, role: string = 'student') {
  return request<any>(`/groups/${groupId}/approve-join/${requestId}`, {
    method: 'POST',
    body: JSON.stringify({ role }),
  });
}

export async function apiRejectJoinRequest(groupId: string, requestId: string) {
  return request<any>(`/groups/${groupId}/reject-join/${requestId}`, { method: 'POST' });
}

export async function apiAddTeacher(groupId: string, userId: string) {
  return request<any>(`/groups/${groupId}/add-teacher`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}

export async function apiLeaveGroup(groupId: string) {
  return request<any>(`/groups/${groupId}/leave`, { method: 'POST' });
}

// Backward compat (deprecated — use apiFetchMyGroups)
export async function apiFetchTeacherGroups(teacherId: string) {
  return request<any[]>(`/groups/teacher/${teacherId}`);
}

export async function apiFetchStudentGroups(studentId: string) {
  return request<any[]>(`/groups/student/${studentId}`);
}
