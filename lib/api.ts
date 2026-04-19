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

export async function apiLogin(login: string, password: string) {
  return request<any>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ login, password }),
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
  phone?: string;
}) {
  return request<any>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiUpdatePushToken(_userId: string, pushToken: string, deviceId: string) {
  return request<any>('/auth/push-token', {
    method: 'PUT',
    body: JSON.stringify({ pushToken, deviceId }),
  });
}

export async function apiRemovePushToken(deviceId: string) {
  return request<any>('/auth/push-token', {
    method: 'DELETE',
    body: JSON.stringify({ deviceId }),
  });
}

export async function apiLogout() {
  return request<any>('/auth/logout', { method: 'POST' });
}

// =============================================
// Telegram Link
// =============================================

export async function apiGetTelegramLink() {
  return request<{ deepLink: string; linked: boolean }>('/auth/telegram-link');
}

// =============================================
// Password Reset (via Telegram)
// =============================================

export async function apiRequestPasswordReset(login: string) {
  return request<{ message: string }>('/auth/password-reset/request', {
    method: 'POST',
    body: JSON.stringify({ login }),
  });
}

export async function apiConfirmPasswordReset(login: string, code: string, newPassword: string) {
  return request<{ message: string }>('/auth/password-reset/confirm', {
    method: 'POST',
    body: JSON.stringify({ login, code, newPassword }),
  });
}

export async function apiUpdateProfile(data: { fullName?: string; gender?: string; region?: string; phone?: string }) {
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
  visibility: 'private' | 'group' | 'community' | 'ai_only';
  isAnonymous: boolean;
  examType: 'cefr' | 'ielts';
  groupId: string | null;
  likes: number;
  commentsCount: number;
  scoreAvg: number | null;
  cefrLevel: string | null;
  createdAt: string;
  test?: { id: number; title: string; description: string | null; testType?: 'cefr' | 'ielts' };
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

export interface PaginatedTestsResponse {
  data: any[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export async function apiFetchTests(opts?: { testType?: 'cefr' | 'ielts'; isPublished?: boolean; page?: number; limit?: number }) {
  const params = new URLSearchParams();
  if (opts?.testType) params.set('testType', opts.testType);
  if (opts?.isPublished !== undefined) params.set('isPublished', String(opts.isPublished));
  if (opts?.page) params.set('page', String(opts.page));
  if (opts?.limit) params.set('limit', String(opts.limit));
  const query = params.toString() ? `?${params.toString()}` : '';
  return request<PaginatedTestsResponse>(`/tests${query}`);
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
    visibility?: 'private' | 'group' | 'community' | 'ai_only';
    groupId?: string;
    sessionId?: string;
    testId?: number;
    isAnonymous?: boolean;
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
  if (options.isAnonymous) formData.append('isAnonymous', 'true');
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

export async function apiFetchMyGroupReviews(page = 1, limit = 20) {
  return request<{ data: TestSession[]; pagination: any }>(`/reviews/my-groups?page=${page}&limit=${limit}`);
}

export async function apiFetchSessionDetail(sessionId: string) {
  return request<TestSession>(`/speaking/sessions/${sessionId}`);
}

export async function apiFetchSpeakingById(id: string) {
  return request<any>(`/speaking/${id}`);
}

export async function apiUpdateSpeaking(sessionId: string, visibility: string) {
  return request<any>(`/speaking/sessions/${sessionId}`, {
    method: 'PUT',
    body: JSON.stringify({ visibility }),
  });
}

export async function apiDeleteSpeaking(id: string) {
  return request<any>(`/speaking/${id}`, { method: 'DELETE' });
}

export async function apiDeleteSession(sessionId: string) {
  return request<any>(`/speaking/sessions/${sessionId}`, { method: 'DELETE' });
}

// Likes (session-based)
export async function apiLikeSession(sessionId: string) {
  return request<any>(`/speaking/sessions/${sessionId}/like`, { method: 'POST' });
}

export async function apiUnlikeSession(sessionId: string) {
  return request<any>(`/speaking/sessions/${sessionId}/like`, { method: 'DELETE' });
}

// Comments (session-based)
export async function apiCommentOnSession(sessionId: string, text: string, replyToId?: string) {
  return request<any>(`/speaking/sessions/${sessionId}/comment`, {
    method: 'POST',
    body: JSON.stringify({ text, ...(replyToId ? { replyToId } : {}) }),
  });
}

export async function apiFetchSessionComments(sessionId: string, page = 1, limit = 20) {
  return request<{ data: any[]; pagination: any }>(`/speaking/sessions/${sessionId}/comments?page=${page}&limit=${limit}`);
}

export async function apiEditComment(commentId: string, text: string) {
  return request<any>(`/speaking/comments/${commentId}`, {
    method: 'PUT',
    body: JSON.stringify({ text }),
  });
}

export async function apiDeleteComment(commentId: string) {
  return request<any>(`/speaking/comments/${commentId}`, {
    method: 'DELETE',
  });
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

export async function apiFetchCommunityFeed(strategy: string = 'latest', page = 1, limit = 20, examType?: 'cefr' | 'ielts') {
  let url = `/community/feed?strategy=${strategy}&page=${page}&limit=${limit}`;
  if (examType) url += `&examType=${examType}`;
  return request<{ data: any[]; pagination: any; strategy: string }>(url);
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

export async function apiCreateGroup(name: string, description: string, isGlobal?: boolean) {
  return request<any>('/groups', {
    method: 'POST',
    body: JSON.stringify({ name, description, ...(isGlobal != null ? { isGlobal } : {}) }),
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

export async function apiJoinGlobalGroup(groupId: string) {
  return request<any>(`/groups/${groupId}/join`, { method: 'POST' });
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

export async function apiCreateTest(data: { title: string; description?: string; testType?: 'cefr' | 'ielts'; isPublished?: boolean }) {
  const user = await getStoredUser();
  if (user?.role !== 'admin' && !(user?.role === 'teacher' && user?.verifiedTeacher)) {
    throw new Error('Only verified teachers can create tests');
  }
  return request<any>('/tests', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function apiUpdateTest(testId: number, data: { title?: string; description?: string; testType?: 'cefr' | 'ielts'; isPublished?: boolean }) {
  return request<any>(`/tests/${testId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function apiDeleteTest(testId: number) {
  return request<any>(`/tests/${testId}`, { method: 'DELETE' });
}

export async function apiCreateQuestion(
  testId: number,
  data: { qText: string; part: string; imageUri?: string; audioUrl?: string; speakingTimer?: number; prepTimer?: number },
) {
  const user = await getStoredUser();
  if (user?.role !== 'admin' && !(user?.role === 'teacher' && user?.verifiedTeacher)) {
    throw new Error('Only verified teachers can create questions');
  }
  const url = `${API_URL}/tests/${testId}/questions`;
  const token = await getStoredAuthToken();
  const headers: Record<string, string> = {
    'User-Agent': getUserAgent(),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  let body: any;
  if (data.imageUri) {
    const formData = new FormData();
    formData.append('qText', data.qText);
    formData.append('part', data.part);
    if (data.audioUrl) formData.append('audioUrl', data.audioUrl);
    if (data.speakingTimer != null) formData.append('speakingTimer', String(data.speakingTimer));
    if (data.prepTimer != null) formData.append('prepTimer', String(data.prepTimer));
    formData.append('image', {
      uri: data.imageUri,
      name: `question_${Date.now()}.jpg`,
      type: 'image/jpeg',
    } as any);
    body = formData;
  } else {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify({
      qText: data.qText,
      part: data.part,
      audioUrl: data.audioUrl,
      speakingTimer: data.speakingTimer,
      prepTimer: data.prepTimer,
    });
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Upload failed: ${res.status}`);
  }
  return res.json();
}

export async function apiUpdateQuestion(
  questionId: number,
  data: { qText?: string; part?: string; imageUri?: string; audioUrl?: string; speakingTimer?: number; prepTimer?: number },
) {
  const url = `${API_URL}/tests/questions/${questionId}`;
  const token = await getStoredAuthToken();
  const headers: Record<string, string> = {
    'User-Agent': getUserAgent(),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  let body: any;
  if (data.imageUri) {
    const formData = new FormData();
    if (data.qText != null) formData.append('qText', data.qText);
    if (data.part != null) formData.append('part', data.part);
    if (data.audioUrl != null) formData.append('audioUrl', data.audioUrl);
    if (data.speakingTimer != null) formData.append('speakingTimer', String(data.speakingTimer));
    if (data.prepTimer != null) formData.append('prepTimer', String(data.prepTimer));
    formData.append('image', {
      uri: data.imageUri,
      name: `question_${Date.now()}.jpg`,
      type: 'image/jpeg',
    } as any);
    body = formData;
  } else {
    headers['Content-Type'] = 'application/json';
    const json: any = {};
    if (data.qText != null) json.qText = data.qText;
    if (data.part != null) json.part = data.part;
    if (data.audioUrl != null) json.audioUrl = data.audioUrl;
    if (data.speakingTimer != null) json.speakingTimer = data.speakingTimer;
    if (data.prepTimer != null) json.prepTimer = data.prepTimer;
    body = JSON.stringify(json);
  }

  const res = await fetch(url, {
    method: 'PUT',
    headers,
    body,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Upload failed: ${res.status}`);
  }
  return res.json();
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

// =============================================
// Users & Follows
// =============================================

export interface PublicUser {
  id: string;
  username: string;
  fullName: string;
  avatarUrl?: string | null;
  role?: 'student' | 'teacher' | 'admin' | null;
  verifiedTeacher?: boolean;
}

export interface UserProfileResponse {
  user: PublicUser;
  stats: { followers: number; following: number };
  relationship: { isMe: boolean; isFollowing: boolean; followsMe: boolean };
}

export interface FollowListItem extends PublicUser {
  isFollowing: boolean;
}

export async function apiGetUserProfile(userId: string) {
  return request<UserProfileResponse>(`/users/${userId}`);
}

export async function apiFollowUser(userId: string) {
  return request<{ success: boolean }>(`/users/${userId}/follow`, { method: 'POST' });
}

export async function apiUnfollowUser(userId: string) {
  return request<{ success: boolean }>(`/users/${userId}/follow`, { method: 'DELETE' });
}

export async function apiGetFollowers(userId: string, page = 1, limit = 20) {
  return request<{ data: FollowListItem[]; pagination: any }>(
    `/users/${userId}/followers?page=${page}&limit=${limit}`,
  );
}

export async function apiGetFollowing(userId: string, page = 1, limit = 20) {
  return request<{ data: FollowListItem[]; pagination: any }>(
    `/users/${userId}/following?page=${page}&limit=${limit}`,
  );
}

export async function apiGetUserSessions(userId: string, page = 1, limit = 20) {
  return request<{ data: TestSession[]; pagination: any }>(
    `/users/${userId}/sessions?page=${page}&limit=${limit}`,
  );
}

// =============================================
// Ads
// =============================================

export interface Ad {
  id: number;
  title: string;
  imageUrl: string;
  linkUrl: string | null;
  adText: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function apiFetchActiveAds() {
  return request<Ad[]>('/ads');
}

export async function apiFetchAllAds() {
  return request<Ad[]>('/ads/all');
}

export async function apiFetchAdById(id: number) {
  return request<Ad>(`/ads/${id}`);
}

export async function apiCreateAd(title: string, imageUri: string, linkUrl?: string, adText?: string) {
  const url = `${API_URL}/ads`;
  const token = await getStoredAuthToken();

  const formData = new FormData();
  formData.append('title', title);
  formData.append('image', {
    uri: imageUri,
    name: `ad_${Date.now()}.jpg`,
    type: 'image/jpeg',
  } as any);
  if (linkUrl) formData.append('linkUrl', linkUrl);
  if (adText) formData.append('adText', adText);

  const res = await fetch(url, {
    method: 'POST',
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

  return res.json() as Promise<Ad>;
}

export async function apiUpdateAd(id: number, data: { title?: string; imageUri?: string; linkUrl?: string; adText?: string; isActive?: boolean }) {
  const url = `${API_URL}/ads/${id}`;
  const token = await getStoredAuthToken();

  const formData = new FormData();
  if (data.title != null) formData.append('title', data.title);
  if (data.linkUrl != null) formData.append('linkUrl', data.linkUrl);
  if (data.adText != null) formData.append('adText', data.adText);
  if (data.isActive != null) formData.append('isActive', String(data.isActive));
  if (data.imageUri) {
    formData.append('image', {
      uri: data.imageUri,
      name: `ad_${Date.now()}.jpg`,
      type: 'image/jpeg',
    } as any);
  }

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

  return res.json() as Promise<Ad>;
}

export async function apiDeleteAd(id: number) {
  return request<any>(`/ads/${id}`, { method: 'DELETE' });
}

// =============================================
// Text-to-Speech
// =============================================

export type TTSVoice = 'erin' | 'george' | 'lisa' | 'emily' | 'nick';

export async function apiTextToSpeech(text: string, voice: TTSVoice = 'erin') {
  const res = await fetch('https://backend.impulselc.uz/api/voice-chat-bot/text-to-voice-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `TTS failed: ${res.status}`);
  }

  return res.json() as Promise<{ success: boolean; url: string; filename: string }>;
}

// =============================================
// AI Feedback (v2)
// =============================================

import type { Achievement, AIFeedback, Challenge, ChallengeSubmission, Course, CourseUnit, Exercise, ExerciseSession, LeaderboardResponse, Lecture, Lesson, LessonDetail, SessionFeedbackResponse, UserLectureProgress, UserProgress, UserReputation, WeeklySummary } from './types';

export async function apiFetchAIFeedback(responseId: string) {
  return request<AIFeedback>(`/ai-feedback/${responseId}`);
}

export async function apiFetchSessionFeedback(sessionId: string) {
  return request<SessionFeedbackResponse>(`/ai-feedback/session/${sessionId}`);
}

export async function apiMarkHelpful(responseId: string) {
  return request<{ message: string }>(`/ai-feedback/${responseId}/helpful`, { method: 'POST' });
}

// =============================================
// Progress / Gamification (v2)
// =============================================

export async function apiFetchProgress() {
  return request<UserProgress>('/progress/me');
}

export async function apiFetchAchievements() {
  return request<{ data: Achievement[] }>('/progress/achievements');
}

export async function apiCheckAchievements() {
  return request<{ newlyUnlocked: Achievement[] }>('/progress/check-achievements', { method: 'POST' });
}

export async function apiBuyStreakFreeze() {
  return request<{ success: boolean; message: string; streakFreezes: number; coins: number }>('/progress/buy-streak-freeze', { method: 'POST' });
}

export async function apiFetchLeaderboard(type: 'weekly' | 'alltime' | 'streak' = 'weekly', limit = 20) {
  return request<LeaderboardResponse>(`/progress/leaderboard?type=${type}&limit=${limit}`);
}

export async function apiFetchWeeklySummary() {
  return request<WeeklySummary>('/progress/weekly-summary');
}

export async function apiFetchReputation(userId?: string) {
  const qs = userId ? `?userId=${userId}` : '';
  return request<UserReputation>(`/progress/reputation${qs}`);
}

// =============================================
// Challenges (v2)
// =============================================

export async function apiFetchChallenges(type?: 'daily' | 'weekly' | 'special') {
  const qs = type ? `?type=${type}` : '';
  return request<{ data: Challenge[] }>(`/challenges${qs}`);
}

export async function apiFetchChallenge(id: string) {
  return request<Challenge>(`/challenges/${id}`);
}

export async function apiSubmitChallenge(challengeId: string, audioUri: string, questionId?: number) {
  const url = `${API_URL}/challenges/${challengeId}/submit`;
  const token = await getStoredAuthToken();

  const formData = new FormData();
  formData.append('audio', {
    uri: audioUri,
    name: `challenge_${Date.now()}.m4a`,
    type: 'audio/m4a',
  } as any);
  if (questionId) formData.append('questionId', questionId.toString());

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'User-Agent': getUserAgent(),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Submit failed: ${res.status}`);
  }

  return res.json();
}

export async function apiFetchChallengeHistory(page = 1, limit = 20) {
  return request<{ data: ChallengeSubmission[]; pagination: any }>(`/challenges/history?page=${page}&limit=${limit}`);
}

// =============================================
// Courses (v2)
// =============================================

export async function apiFetchCourses(level?: string, all?: boolean) {
  const params = new URLSearchParams();
  if (level) params.set('level', level);
  if (all) params.set('all', 'true');
  const qs = params.toString() ? `?${params.toString()}` : '';
  return request<{ data: Course[] }>(`/courses${qs}`);
}

export async function apiFetchAdminCourses() {
  return request<{ data: Course[] }>('/courses/admin/all');
}

export async function apiFetchCourse(id: string) {
  return request<Course>(`/courses/${id}`);
}

export async function apiFetchLesson(lessonId: string) {
  return request<LessonDetail>(`/courses/lessons/${lessonId}`);
}

export async function apiCompleteLesson(lessonId: string, score?: number) {
  return request<{ progress: any; xpEarned: number }>(`/courses/lessons/${lessonId}/complete`, {
    method: 'POST',
    body: JSON.stringify({ score }),
  });
}

// =============================================
// Course Admin (v2)
// =============================================

export async function apiCreateCourse(data: { title: string; description: string; level: string; imageUri?: string; order?: number; isPublished?: boolean }) {
  const url = `${API_URL}/courses/admin/create`;
  const token = await getStoredAuthToken();
  const headers: Record<string, string> = {
    'User-Agent': getUserAgent(),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const formData = new FormData();
  formData.append('title', data.title);
  formData.append('description', data.description);
  formData.append('level', data.level);
  if (data.isPublished != null) formData.append('isPublished', String(data.isPublished));
  if (data.order != null) formData.append('order', String(data.order));
  if (data.imageUri) {
    formData.append('image', {
      uri: data.imageUri,
      name: `course_${Date.now()}.jpg`,
      type: 'image/jpeg',
    } as any);
  }

  const res = await fetch(url, { method: 'POST', headers, body: formData });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errBody.error || `Create failed: ${res.status}`);
  }
  return res.json();
}

export async function apiUpdateCourse(id: string, data: Partial<{ title: string; description: string; level: string; imageUri: string; isPublished: boolean; order: number }>) {
  const url = `${API_URL}/courses/admin/${id}`;
  const token = await getStoredAuthToken();
  const headers: Record<string, string> = {
    'User-Agent': getUserAgent(),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const formData = new FormData();
  if (data.title != null) formData.append('title', data.title);
  if (data.description != null) formData.append('description', data.description);
  if (data.level != null) formData.append('level', data.level);
  if (data.isPublished != null) formData.append('isPublished', String(data.isPublished));
  if (data.order != null) formData.append('order', String(data.order));
  if (data.imageUri) {
    formData.append('image', {
      uri: data.imageUri,
      name: `course_${Date.now()}.jpg`,
      type: 'image/jpeg',
    } as any);
  }

  const res = await fetch(url, { method: 'PUT', headers, body: formData });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errBody.error || `Update failed: ${res.status}`);
  }
  return res.json();
}

export async function apiDeleteCourse(id: string) {
  return request(`/courses/admin/${id}`, { method: 'DELETE' });
}

export async function apiCreateCourseUnit(data: { courseId: string; title: string; order?: number }) {
  return request<CourseUnit>('/courses/admin/units', { method: 'POST', body: JSON.stringify(data) });
}

export async function apiUpdateCourseUnit(id: string, data: Partial<{ title: string; order: number }>) {
  return request<CourseUnit>(`/courses/admin/units/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function apiDeleteCourseUnit(id: string) {
  return request(`/courses/admin/units/${id}`, { method: 'DELETE' });
}

export async function apiCreateLessonAdmin(data: { unitId: string; title: string; type?: string; order?: number; xpReward?: number }) {
  return request<Lesson>('/courses/admin/lessons', { method: 'POST', body: JSON.stringify(data) });
}

export async function apiUpdateLessonAdmin(id: string, data: Partial<{ title: string; type: string; order: number; xpReward: number }>) {
  return request<Lesson>(`/courses/admin/lessons/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function apiDeleteLessonAdmin(id: string) {
  return request(`/courses/admin/lessons/${id}`, { method: 'DELETE' });
}

// =============================================
// Lecture Admin (v2)
// =============================================

export async function apiCreateLecture(data: {
  lessonId: string;
  contentType: string;
  title: string;
  order?: number;
  textBody?: string | null;
  mediaUrl?: string | null;
  thumbnailUrl?: string | null;
  durationSec?: number | null;
}) {
  return request<Lecture>('/courses/admin/lectures', { method: 'POST', body: JSON.stringify(data) });
}

export async function apiCreateLectureMultipart(data: {
  lessonId: string;
  contentType: string;
  title: string;
  order?: number;
  textBody?: string | null;
  durationSec?: number | null;
  mediaUri?: string;
  thumbnailUri?: string;
  attachmentUris?: { uri: string; name: string; type: string }[];
}) {
  const url = `${API_URL}/courses/admin/lectures`;
  const token = await getStoredAuthToken();
  const headers: Record<string, string> = {
    'User-Agent': getUserAgent(),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const formData = new FormData();
  formData.append('lessonId', data.lessonId);
  formData.append('contentType', data.contentType);
  formData.append('title', data.title);
  if (data.order != null) formData.append('order', String(data.order));
  if (data.textBody) formData.append('textBody', data.textBody);
  if (data.durationSec != null) formData.append('durationSec', String(data.durationSec));
  if (data.mediaUri) {
    formData.append('media', {
      uri: data.mediaUri,
      name: `media_${Date.now()}.${data.contentType === 'audio' ? 'mp3' : 'mp4'}`,
      type: data.contentType === 'audio' ? 'audio/mpeg' : 'video/mp4',
    } as any);
  }
  if (data.thumbnailUri) {
    formData.append('thumbnail', {
      uri: data.thumbnailUri,
      name: `thumb_${Date.now()}.jpg`,
      type: 'image/jpeg',
    } as any);
  }
  if (data.attachmentUris?.length) {
    for (const att of data.attachmentUris) {
      formData.append('attachments', { uri: att.uri, name: att.name, type: att.type } as any);
    }
  }

  const res = await fetch(url, { method: 'POST', headers, body: formData });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errBody.error || `Create lecture failed: ${res.status}`);
  }
  return res.json() as Promise<Lecture>;
}

export async function apiUpdateLecture(id: string, data: Partial<{
  contentType: string;
  title: string;
  order: number;
  textBody: string | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  durationSec: number | null;
}>) {
  return request<Lecture>(`/courses/admin/lectures/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function apiDeleteLecture(id: string) {
  return request(`/courses/admin/lectures/${id}`, { method: 'DELETE' });
}

export async function apiAddLectureAttachments(lectureId: string, files: { uri: string; name: string; type: string }[]) {
  const url = `${API_URL}/courses/admin/lectures/${lectureId}/attachments`;
  const token = await getStoredAuthToken();
  const headers: Record<string, string> = {
    'User-Agent': getUserAgent(),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const formData = new FormData();
  for (const f of files) {
    formData.append('files', { uri: f.uri, name: f.name, type: f.type } as any);
  }
  const res = await fetch(url, { method: 'POST', headers, body: formData });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errBody.error || `Upload failed: ${res.status}`);
  }
  return res.json();
}

export async function apiDeleteLectureAttachment(attachmentId: string) {
  return request(`/courses/admin/lecture-attachments/${attachmentId}`, { method: 'DELETE' });
}

// =============================================
// Lecture Viewer — Student (v2)
// =============================================

export async function apiFetchLecture(lectureId: string) {
  return request<Lecture>(`/courses/lectures/${lectureId}`);
}

export async function apiUpdateLectureProgress(lectureId: string, data: { progressPct: number; completed?: boolean }) {
  return request<UserLectureProgress>(`/courses/lectures/${lectureId}/progress`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function apiCreateExercise(data: {
  lessonId: string;
  type: string;
  prompt: string;
  order?: number;
  correctAnswer?: string | null;
  sentenceTemplate?: string | null;
  targetText?: string | null;
  audioUrl?: string | null;
  imageUrl?: string | null;
  hints?: string[] | null;
  explanation?: string | null;
  difficulty?: number;
  xpReward?: number;
  options?: { text: string; isCorrect: boolean; audioUrl?: string | null; imageUrl?: string | null; order: number }[];
  matchPairs?: { leftText: string; rightText: string; leftAudio?: string | null; rightAudio?: string | null; order: number }[];
  wordBankItems?: { text: string; correctPosition: number; isDistractor: boolean }[];
  conversationLines?: { speaker: string; text: string; audioUrl?: string | null; isUserTurn: boolean; acceptedAnswers?: string[] | null; order: number }[];
}) {
  return request<Exercise>('/courses/admin/exercises', { method: 'POST', body: JSON.stringify(data) });
}

export async function apiUpdateExercise(id: string, data: Partial<{
  type: string;
  prompt: string;
  order: number;
  correctAnswer: string | null;
  sentenceTemplate: string | null;
  targetText: string | null;
  audioUrl: string | null;
  imageUrl: string | null;
  hints: string[] | null;
  explanation: string | null;
  difficulty: number;
  xpReward: number;
  options: { text: string; isCorrect: boolean; audioUrl?: string | null; imageUrl?: string | null; order: number }[];
  matchPairs: { leftText: string; rightText: string; leftAudio?: string | null; rightAudio?: string | null; order: number }[];
  wordBankItems: { text: string; correctPosition: number; isDistractor: boolean }[];
  conversationLines: { speaker: string; text: string; audioUrl?: string | null; isUserTurn: boolean; acceptedAnswers?: string[] | null; order: number }[];
}>) {
  return request<Exercise>(`/courses/admin/exercises/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function apiDeleteExercise(id: string) {
  return request(`/courses/admin/exercises/${id}`, { method: 'DELETE' });
}

// =============================================
// Exercise Sessions (v2)
// =============================================

export async function apiStartLessonSession(lessonId: string) {
  return request<{ session: ExerciseSession; exercises: Exercise[] }>(`/courses/lessons/${lessonId}/start`, { method: 'POST' });
}

export async function apiSubmitAttempt(sessionId: string, data: {
  exerciseId: string;
  userAnswer: Record<string, any>;
  isCorrect: boolean;
  timeTakenMs?: number;
}) {
  return request<{
    attempt: { id: string; isCorrect: boolean; xpEarned: number };
    session: ExerciseSession;
  }>(`/courses/sessions/${sessionId}/attempt`, { method: 'POST', body: JSON.stringify(data) });
}

export async function apiCompleteSession(sessionId: string) {
  return request<ExerciseSession>(`/courses/sessions/${sessionId}/complete`, { method: 'POST' });
}

export async function apiGetSession(sessionId: string) {
  return request<ExerciseSession>(`/courses/sessions/${sessionId}`);
}
