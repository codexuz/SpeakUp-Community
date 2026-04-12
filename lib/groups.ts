import {
  apiApproveJoinRequest,
  apiCreateGroup,
  apiDeleteGroup,
  apiFetchGroupById,
  apiFetchGroupMembers,
  apiFetchGroupSubmissions,
  apiFetchJoinRequests,
  apiFetchMyGroups,
  apiJoinGroup,
  apiLeaveGroup,
  apiRegenerateReferralCode,
  apiRejectJoinRequest,
  apiUpdateGroup,
} from './api';

export interface Group {
  id: string;
  name: string;
  description: string | null;
  referralCode: string;
  createdById: string;
  createdAt: string;
  creator?: { fullName: string; avatarUrl?: string };
  member_count?: number;
  myRole?: string;
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  role: string;
  joinedAt: string;
  user?: { id: string; fullName: string; username: string; avatarUrl?: string };
}

export interface JoinRequest {
  id: string;
  groupId: string;
  userId: string;
  message: string | null;
  status: string;
  createdAt: string;
  user?: { id: string; fullName: string; username: string; avatarUrl?: string };
}

// =============================================
// Fetch groups
// =============================================

export async function fetchMyGroups(): Promise<Group[]> {
  const data = await apiFetchMyGroups();
  return data || [];
}

export async function fetchGroupById(groupId: string): Promise<Group | null> {
  return apiFetchGroupById(groupId);
}

export async function fetchGroupMembers(groupId: string): Promise<GroupMember[]> {
  return (await apiFetchGroupMembers(groupId)) || [];
}

export async function fetchGroupSubmissions(groupId: string, page = 1) {
  return apiFetchGroupSubmissions(groupId, page);
}

// =============================================
// CRUD
// =============================================

export async function createGroup(name: string, description: string): Promise<Group | null> {
  return apiCreateGroup(name, description);
}

export async function updateGroup(groupId: string, name: string, description: string): Promise<Group | null> {
  return apiUpdateGroup(groupId, name, description);
}

export async function deleteGroup(groupId: string): Promise<void> {
  await apiDeleteGroup(groupId);
}

export async function regenerateReferralCode(groupId: string): Promise<string> {
  const result = await apiRegenerateReferralCode(groupId);
  return result.referralCode;
}

// =============================================
// Membership
// =============================================

export async function joinGroupByCode(referralCode: string): Promise<Group | null> {
  return apiJoinGroup(referralCode);
}

export async function leaveGroup(groupId: string): Promise<void> {
  await apiLeaveGroup(groupId);
}

// =============================================
// Join Requests
// =============================================

export async function fetchJoinRequests(groupId: string): Promise<JoinRequest[]> {
  return (await apiFetchJoinRequests(groupId)) || [];
}

export async function approveJoinRequest(groupId: string, requestId: string, role = 'student'): Promise<void> {
  await apiApproveJoinRequest(groupId, requestId, role);
}

export async function rejectJoinRequest(groupId: string, requestId: string): Promise<void> {
  await apiRejectJoinRequest(groupId, requestId);
}
