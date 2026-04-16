// ─── V2 Engagement Types ────────────────────────────────────────

export type ExamType = 'cefr' | 'ielts';

// ─── AI Feedback ────────────────────────────────────────────────

export interface GrammarIssue {
  original: string;
  corrected: string;
  explanation: string;
}

export interface VocabSuggestion {
  word: string;
  alternatives: string[];
  context: string;
}

export interface PronIssue {
  word: string;
  issue: string;
  tip: string;
}

export interface AIFeedback {
  id: string;
  responseId: string;
  transcript: string;
  grammarScore: number;
  fluencyWPM: number;
  fluencyScore: number;
  vocabDiversity: number;
  pronScore: number;
  overallScore: number;
  grammarIssues: GrammarIssue[];
  vocabSuggestions: VocabSuggestion[];
  pronIssues: PronIssue[];
  naturalness: string;
  fillerWords: Record<string, number>;
  pauseCount: number;
  aiSummary: string;
  createdAt: string;
  response?: {
    studentId: string;
    question: { qText: string; part: number };
  };
}

export interface SessionFeedbackAggregate {
  averageOverallScore: number | null;
  averageFluencyWPM: number | null;
  totalResponses: number;
}

export interface SessionFeedbackResponse {
  feedbacks: (AIFeedback & {
    response: {
      id: string;
      question: { id: number; qText: string; part: number };
    };
  })[];
  aggregate: SessionFeedbackAggregate;
}

// ─── Gamification ───────────────────────────────────────────────

export interface UserProgress {
  id: string;
  userId: string;
  xp: number;
  level: number;
  coins: number;
  currentStreak: number;
  longestStreak: number;
  streakFreezes: number;
  weeklyXP: number;
  lastActiveDate: string | null;
  fluencyWPMAvg: number;
  vocabDiversityAvg: number;
  pronScoreAvg: number;
  xpInCurrentLevel: number;
  xpForNextLevel: number;
  xpPercent: number;
}

export interface Achievement {
  id: string;
  key: string;
  title: string;
  description: string;
  category: 'speaking' | 'social' | 'streak' | 'mastery';
  xpReward: number;
  coinReward: number;
  unlocked: boolean;
  unlockedAt: string | null;
}

export interface LeaderboardEntry {
  userId: string;
  weeklyXP?: number;
  xp?: number;
  currentStreak?: number;
  level: number;
  user: { id: string; fullName: string; username: string; avatarUrl: string | null };
}

export interface LeaderboardResponse {
  type: string;
  data: LeaderboardEntry[];
  userRank: number;
  userProgress: UserProgress;
}

export interface WeeklySummary {
  weeklyXP: number;
  weeklyRecordings: number;
  currentStreak: number;
  level: number;
  improvements: {
    fluency: number;
    grammar: number;
    vocabulary: number;
  };
  averages: {
    fluencyWPM: number;
    vocabDiversity: number;
    pronScore: number;
  };
  totalFeedbacks: number;
}

// ─── Reputation ─────────────────────────────────────────────────

export interface UserReputation {
  id: string;
  userId: string;
  helpfulVotes: number;
  reviewsGiven: number;
  clarityScore: number;
  mentorLevel: 0 | 1 | 2 | 3;
  mentorLabel: '' | 'Helper' | 'Mentor' | 'Expert';
  badges: string[];
  user: { id: string; fullName: string; username: string; avatarUrl: string | null };
}

// ─── Challenges ─────────────────────────────────────────────────

export interface Challenge {
  id: string;
  title: string;
  description: string | null;
  type: 'daily' | 'weekly' | 'special';
  difficulty: string;
  promptText: string;
  promptImage: string | null;
  startsAt: string;
  endsAt: string;
  xpReward: number;
  coinReward: number;
  isActive: boolean;
  submitted: boolean;
  participantCount: number;
  userSubmission?: {
    id: string;
    responseId: string;
    submittedAt: string;
  };
  submissions?: ChallengeSubmission[];
}

export interface ChallengeSubmission {
  id: string;
  challengeId: string;
  userId: string;
  responseId: string;
  submittedAt: string;
  challenge?: Challenge;
  user?: { id: string; fullName: string; username: string; avatarUrl: string | null };
}

// ─── Courses ────────────────────────────────────────────────────

export interface Course {
  id: string;
  title: string;
  description: string;
  level: string;
  imageUrl: string | null;
  isPublished: boolean;
  order: number;
  totalLessons: number;
  completedLessons: number;
  progressPercent: number;
  units: CourseUnit[];
}

export interface CourseUnit {
  id: string;
  courseId: string;
  title: string;
  order: number;
  lessons: Lesson[];
  _count?: { lessons: number };
}

export interface Lesson {
  id: string;
  unitId: string;
  title: string;
  order: number;
  xpReward: number;
  completed: boolean;
  score: number | null;
  xpEarned: number;
}

export interface Exercise {
  id: string;
  lessonId: string;
  type: 'listenRepeat' | 'speakTheAnswer' | 'fillInBlank' | 'multipleChoice' | 'reorderWords' | 'matchPairs' | 'translate';
  order: number;
  prompt: string;
  correctAnswer: string | null;
  options: string[] | null;
  audioUrl: string | null;
  imageUrl: string | null;
  hints: string[] | null;
}

export interface LessonDetail {
  id: string;
  title: string;
  unitId: string;
  order: number;
  xpReward: number;
  unit: {
    id: string;
    title: string;
    course: { id: string; title: string; level: string };
  };
  exercises: Exercise[];
}

// ─── Score helpers ──────────────────────────────────────────────

export function isValidScore(score: number, examType: ExamType): boolean {
  if (examType === 'ielts') {
    return score >= 0 && score <= 9 && (score * 2) % 1 === 0;
  }
  return Number.isInteger(score) && score >= 0 && score <= 75;
}

export function getScoreColor(score: number): string {
  if (score >= 80) return '#4CAF50';
  if (score >= 60) return '#FFC107';
  if (score >= 40) return '#FF9800';
  return '#F44336';
}
