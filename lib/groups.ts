import {
    apiCreateGroup,
    apiDeleteGroup,
    apiFetchCommunitySubmissions,
    apiFetchGroupById,
    apiFetchGroupMembers,
    apiFetchGroupSubmissions,
    apiFetchStudentGroups,
    apiFetchTeacherGroups,
    apiGradeResponse,
    apiJoinGroup,
    apiLeaveGroup,
    apiRegenerateReferralCode,
    apiRemoveMember,
    apiUpdateGroup,
} from './api';

export interface Group {
  id: string;
  name: string;
  description: string | null;
  teacher_id: string;
  referral_code: string;
  created_at: string;
  teacher?: { fullName: string; avatarUrl?: string };
  member_count?: number;
}

export interface GroupMember {
  id: number;
  group_id: string;
  student_id: string;
  joined_at: string;
  student?: { id: string; fullName: string; username: string; avatarUrl?: string };
}

// =============================================
// Teacher: CRUD
// =============================================

export async function createGroup(name: string, description: string, teacherId: string): Promise<Group | null> {
  return apiCreateGroup(name, description, teacherId);
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
// Fetch groups
// =============================================

export async function fetchTeacherGroups(teacherId: string): Promise<Group[]> {
  const data = await apiFetchTeacherGroups(teacherId);
  return (data || []).map((g: any) => ({
    ...g,
    teacher_id: g.teacherId ?? g.teacher_id,
    referral_code: g.referralCode ?? g.referral_code,
    created_at: g.createdAt ?? g.created_at,
    member_count: g.member_count ?? g._count?.members ?? 0,
  }));
}

export async function fetchStudentGroups(studentId: string): Promise<Group[]> {
  const data = await apiFetchStudentGroups(studentId);
  return (data || []).map((g: any) => ({
    ...g,
    teacher_id: g.teacherId ?? g.teacher_id,
    referral_code: g.referralCode ?? g.referral_code,
    created_at: g.createdAt ?? g.created_at,
    member_count: g.member_count ?? g._count?.members ?? 0,
  }));
}

export async function fetchGroupById(groupId: string): Promise<Group | null> {
  const g = await apiFetchGroupById(groupId);
  if (!g) return null;
  return {
    ...g,
    teacher_id: g.teacherId ?? g.teacher_id,
    referral_code: g.referralCode ?? g.referral_code,
    created_at: g.createdAt ?? g.created_at,
  };
}

export async function fetchGroupMembers(groupId: string): Promise<GroupMember[]> {
  const data = await apiFetchGroupMembers(groupId);
  return (data || []).map((m: any) => ({
    ...m,
    group_id: m.groupId ?? m.group_id,
    student_id: m.studentId ?? m.student_id,
    joined_at: m.joinedAt ?? m.joined_at,
  }));
}

// =============================================
// Student: Join by referral code
// =============================================

export async function joinGroupByCode(referralCode: string, studentId: string): Promise<Group | null> {
  const g = await apiJoinGroup(referralCode, studentId);
  return g ? {
    ...g,
    teacher_id: g.teacherId ?? g.teacher_id,
    referral_code: g.referralCode ?? g.referral_code,
    created_at: g.createdAt ?? g.created_at,
  } : null;
}

export async function leaveGroup(groupId: string, studentId: string): Promise<void> {
  await apiLeaveGroup(groupId, studentId);
}

export async function removeStudentFromGroup(groupId: string, studentId: string): Promise<void> {
  await apiRemoveMember(groupId, studentId);
}

// =============================================
// Community: All students' submissions 
// =============================================

export async function fetchCommunitySubmissions() {
  const data = await apiFetchCommunitySubmissions();
  return (data || []).map((r: any) => ({
    ...r,
    question_id: r.questionId ?? r.question_id,
    student_id: r.studentId ?? r.student_id,
    remote_url: r.remoteUrl ?? r.remote_url,
    teacher_score: r.teacherScore ?? r.teacher_score,
    teacher_feedback: r.teacherFeedback ?? r.teacher_feedback,
    created_at: r.createdAt ?? r.created_at,
  }));
}

export async function fetchGroupSubmissions(groupId: string) {
  const data = await apiFetchGroupSubmissions(groupId);
  return (data || []).map((r: any) => ({
    ...r,
    question_id: r.questionId ?? r.question_id,
    student_id: r.studentId ?? r.student_id,
    remote_url: r.remoteUrl ?? r.remote_url,
    teacher_score: r.teacherScore ?? r.teacher_score,
    teacher_feedback: r.teacherFeedback ?? r.teacher_feedback,
    created_at: r.createdAt ?? r.created_at,
  }));
}

export async function gradeSubmission(responseId: number, score: number, feedback: string): Promise<void> {
  await apiGradeResponse(responseId, score, feedback);
}
