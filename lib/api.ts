import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { getStoredAuthToken, getStoredUser } from '@/store/auth';


const API_URL = 'https://speakup.impulselc.uz/api'; 

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
  role?: 'student' | 'teacher';
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

export async function apiUpdateProfile(data: { fullName?: string; gender?: string; region?: string }) {
  return request<any>('/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function apiUploadUserAvatar(imageUri: string) {
  const url = `${API_URL}/auth/avatar`;
  const token = await getStoredAuthToken();

  const formData = new FormData();
  formData.append('avatar', {
    uri: imageUri,
    name: 'avatar.jpg',
    type: 'image/jpeg',
  } as any);

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'User-Agent': getUserAgent(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Upload failed: ${res.status}`);
  }

  return res.json();
}

export interface AuthSessionItem {
  sessionId: string;
  userId: string;
  device: string;
  ip: string;
  createdAt: string;
  lastActiveAt: string;
  current: boolean;
}

export interface TestSession {
  id: string;
  testId: number;
  userId: string;
  visibility: 'private' | 'group' | 'community';
  groupId: string | null;
  likes: number;
  commentsCount: number;
  scoreAvg: number | null;
  cefrLevel: string | null;
  createdAt: string;
  test?: { id: number; title: string; description: string | null };
  user?: { id: string; fullName: string; username: string; avatarUrl: string | null };
  responses?: SpeakingResponse[];
  reviews?: any[];
  isLiked?: boolean;
  _count?: { responses: number; reviews?: number; comments?: number };
}

export interface SpeakingResponse {
  id: string;
  questionId: number;
  studentId: string;
  sessionId: string | null;
  localUri: string | null;
  remoteUrl: string | null;
  teacherScore: number | null;
  teacherFeedback: string | null;
  audioProcessed: boolean;
  createdAt: string;
  student?: { id: string; fullName: string; username: string; avatarUrl: string | null };
  question?: { id: number; qText: string; part: string; speakingTimer: number; prepTimer: number };
}

export async function apiFetchSessions() {
  return request<{ sessions: AuthSessionItem[] }>('/auth/sessions');
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
  options: {
    visibility?: 'private' | 'group' | 'community';
    groupId?: string;
    sessionId?: string;
    testId?: number;
  } = {},
) {
  const url = `${API_URL}/speaking`;
  const token = await getStoredAuthToken();

  const formData = new FormData();
  formData.append('questionId', questionId.toString());
  if (options.visibility) formData.append('visibility', options.visibility);
  if (options.groupId) formData.append('groupId', options.groupId);
  if (options.sessionId) formData.append('sessionId', options.sessionId);
  if (options.testId) formData.append('testId', options.testId.toString());
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
  return request<{ data: TestSession[]; pagination: any }>(`/speaking/my?page=${page}&limit=${limit}`);
}

export async function apiFetchPendingSpeaking(page = 1, limit = 20) {
  return request<{ data: TestSession[]; pagination: any }>(`/speaking/pending?page=${page}&limit=${limit}`);
}

export async function apiFetchSessionDetail(sessionId: string) {
  return request<TestSession>(`/speaking/sessions/${sessionId}`);
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

// Likes (session-based)
export async function apiLikeSession(sessionId: string) {
  return request<any>(`/speaking/sessions/${sessionId}/like`, { method: 'POST' });
}

export async function apiUnlikeSession(sessionId: string) {
  return request<any>(`/speaking/sessions/${sessionId}/like`, { method: 'DELETE' });
}

// Comments (session-based)
export async function apiCommentOnSession(sessionId: string, text: string) {
  return request<any>(`/speaking/sessions/${sessionId}/comment`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export async function apiFetchSessionComments(sessionId: string, page = 1, limit = 20) {
  return request<{ data: any[]; pagination: any }>(`/speaking/sessions/${sessionId}/comments?page=${page}&limit=${limit}`);
}

// Deprecated — use session-based versions above
export const apiLikeSpeaking = apiLikeSession;
export const apiUnlikeSpeaking = apiUnlikeSession;
export const apiCommentOnSpeaking = apiCommentOnSession;
export const apiFetchSpeakingComments = apiFetchSessionComments;

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

export async function apiRemoveMember(groupId: string, userId: string) {
  return request<any>(`/groups/${groupId}/remove-member`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}

export async function apiSearchGroups(query: string) {
  return request<any[]>(`/groups/search?q=${encodeURIComponent(query)}`);
}

export async function apiUploadGroupAvatar(groupId: string, imageUri: string) {
  const url = `${API_URL}/groups/${groupId}/avatar`;
  const token = await getStoredAuthToken();

  const formData = new FormData();
  formData.append('avatar', {
    uri: imageUri,
    name: 'avatar.jpg',
    type: 'image/jpeg',
  } as any);

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'User-Agent': getUserAgent(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Upload failed: ${res.status}`);
  }

  return res.json();
}

// =============================================
// Teacher Verification
// =============================================

export async function apiRequestTeacherVerification(reason?: string) {
  return request<any>('/teacher-verification', {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function apiFetchMyVerificationStatus() {
  return request<any>('/teacher-verification/me');
}

export async function apiFetchAllVerifications(status?: string) {
  const qs = status ? `?status=${status}` : '';
  return request<any[]>(`/teacher-verification${qs}`);
}

export async function apiReviewVerification(id: string, data: { status: 'approved' | 'rejected'; reviewNote?: string }) {
  return request<any>(`/teacher-verification/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// =============================================
// Tests CRUD (teacher/admin)
// =============================================

export async function apiCreateTest(data: { title: string; description?: string }) {
  const user = await getStoredUser();
  if (user?.role !== 'admin' && !(user?.role === 'teacher' && user?.verifiedTeacher)) {
    throw new Error('Only verified teachers can create tests');
  }
  return request<any>('/tests', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function apiUpdateTest(testId: number, data: { title?: string; description?: string }) {
  return request<any>(`/tests/${testId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function apiDeleteTest(testId: number) {
  return request<any>(`/tests/${testId}`, { method: 'DELETE' });
}

export async function apiCreateQuestion(testId: number, data: { qText: string; part: string; image?: string; speakingTimer?: number; prepTimer?: number }) {
  const user = await getStoredUser();
  if (user?.role !== 'admin' && !(user?.role === 'teacher' && user?.verifiedTeacher)) {
    throw new Error('Only verified teachers can create questions');
  }
  return request<any>(`/tests/${testId}/questions`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function apiUpdateQuestion(questionId: number, data: { qText?: string; part?: string; image?: string; speakingTimer?: number; prepTimer?: number }) {
  return request<any>(`/tests/questions/${questionId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function apiDeleteQuestion(questionId: number) {
  return request<any>(`/tests/questions/${questionId}`, { method: 'DELETE' });
}

// Backward compat (deprecated — use apiFetchMyGroups)
export async function apiFetchTeacherGroups(teacherId: string) {
  return request<any[]>(`/groups/teacher/${teacherId}`);
}

export async function apiFetchStudentGroups(studentId: string) {
  return request<any[]>(`/groups/student/${studentId}`);
}
