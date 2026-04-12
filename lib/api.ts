const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
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

export async function apiUpdatePushToken(userId: string, pushToken: string) {
  return request<any>('/auth/push-token', {
    method: 'PUT',
    body: JSON.stringify({ userId, pushToken }),
  });
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
// Responses
// =============================================

export async function apiSubmitResponse(questionId: number, studentId: string, audioUri: string) {
  const url = `${API_URL}/responses`;

  const formData = new FormData();
  formData.append('questionId', questionId.toString());
  formData.append('studentId', studentId);
  formData.append('audio', {
    uri: audioUri,
    name: `response_${Date.now()}.m4a`,
    type: 'audio/m4a',
  } as any);

  const res = await fetch(url, {
    method: 'POST',
    body: formData,
    // Don't set Content-Type header for multipart — fetch sets it with boundary
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Upload failed: ${res.status}`);
  }

  return res.json();
}

export async function apiFetchStudentResponses(studentId: string) {
  return request<any[]>(`/responses/student/${studentId}`);
}

export async function apiFetchPendingResponses() {
  return request<any[]>('/responses/pending');
}

export async function apiFetchCommunitySubmissions() {
  return request<any[]>('/responses/community');
}

export async function apiGradeResponse(id: string | number, score: number, feedback: string) {
  return request<any>(`/responses/${id}/grade`, {
    method: 'PUT',
    body: JSON.stringify({ score, feedback }),
  });
}

export async function apiDeleteResponse(id: string | number) {
  return request<any>(`/responses/${id}`, { method: 'DELETE' });
}

// =============================================
// Groups
// =============================================

export async function apiFetchTeacherGroups(teacherId: string) {
  return request<any[]>(`/groups/teacher/${teacherId}`);
}

export async function apiFetchStudentGroups(studentId: string) {
  return request<any[]>(`/groups/student/${studentId}`);
}

export async function apiFetchGroupById(groupId: string) {
  return request<any>(`/groups/${groupId}`);
}

export async function apiFetchGroupMembers(groupId: string) {
  return request<any[]>(`/groups/${groupId}/members`);
}

export async function apiFetchGroupSubmissions(groupId: string) {
  return request<any[]>(`/groups/${groupId}/submissions`);
}

export async function apiCreateGroup(name: string, description: string, teacherId: string) {
  return request<any>('/groups', {
    method: 'POST',
    body: JSON.stringify({ name, description, teacherId }),
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

export async function apiJoinGroup(referralCode: string, studentId: string) {
  return request<any>('/groups/join', {
    method: 'POST',
    body: JSON.stringify({ referralCode, studentId }),
  });
}

export async function apiLeaveGroup(groupId: string, studentId: string) {
  return request<any>(`/groups/${groupId}/leave`, {
    method: 'POST',
    body: JSON.stringify({ studentId }),
  });
}

export async function apiRemoveMember(groupId: string, studentId: string) {
  return request<any>(`/groups/${groupId}/remove-member`, {
    method: 'POST',
    body: JSON.stringify({ studentId }),
  });
}
