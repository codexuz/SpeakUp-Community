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

export type LessonType = 'practice' | 'lecture' | 'mixed';

export type LectureContentType = 'text' | 'audio' | 'video';

export type ExerciseType =
  | 'listenRepeat'
  | 'speakTheAnswer'
  | 'fillInBlank'
  | 'multipleChoice'
  | 'listenAndChoose'
  | 'roleplay'
  | 'pronunciation'
  | 'matchPairs'
  | 'reorderWords'
  | 'translateSentence'
  | 'tapWhatYouHear'
  | 'completeConversation';

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
  type: LessonType;
  order: number;
  xpReward: number;
  completed: boolean;
  score: number | null;
  xpEarned: number;
}

export interface LectureAttachment {
  id: string;
  lectureId: string;
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  order: number;
}

export interface UserLectureProgress {
  id: string;
  userId: string;
  lectureId: string;
  completed: boolean;
  progressPct: number;
  completedAt: string | null;
}

export interface Lecture {
  id: string;
  lessonId: string;
  contentType: LectureContentType;
  title: string;
  order: number;
  textBody: string | null;
  /** @deprecated Use audioUrl/videoUrl instead. Kept for backward compatibility. */
  mediaUrl: string | null;
  audioUrl: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  durationSec: number | null;
  createdAt: string;
  updatedAt: string;
  attachments: LectureAttachment[];
  userProgress?: UserLectureProgress | null;
}

export interface ExerciseOption {
  id: string;
  text: string;
  audioUrl: string | null;
  imageUrl: string | null;
  isCorrect: boolean;
  order: number;
}

export interface ExerciseMatchPair {
  id: string;
  leftText: string;
  leftAudio: string | null;
  rightText: string;
  rightAudio: string | null;
  order: number;
}

export interface ExerciseWordBankItem {
  id: string;
  text: string;
  correctPosition: number;
  isDistractor: boolean;
}

export interface ExerciseConversationLine {
  id: string;
  speaker: string;
  text: string;
  audioUrl: string | null;
  isUserTurn: boolean;
  acceptedAnswers: string[] | null;
  order: number;
}

export interface Exercise {
  id: string;
  lessonId: string;
  type: ExerciseType;
  order: number;
  prompt: string;
  promptAudio: string | null;
  correctAnswer: string | null;
  sentenceTemplate: string | null;
  targetText: string | null;
  audioUrl: string | null;
  imageUrl: string | null;
  hints: string[] | null;
  explanation: string | null;
  difficulty: number;
  xpReward: number;
  options: ExerciseOption[];
  matchPairs: ExerciseMatchPair[];
  wordBankItems: ExerciseWordBankItem[];
  conversationLines: ExerciseConversationLine[];
}

export interface ExerciseSession {
  id: string;
  userId: string;
  lessonId: string;
  hearts: number;
  combo: number;
  maxCombo: number;
  totalXp: number;
  correctCount: number;
  wrongCount: number;
  completed: boolean;
  startedAt: string;
  completedAt: string | null;
  attempts?: ExerciseAttempt[];
}

export interface ExerciseAttempt {
  id: string;
  sessionId: string;
  exerciseId: string;
  userAnswer: Record<string, any>;
  isCorrect: boolean;
  xpEarned: number;
  timeTakenMs: number | null;
  createdAt: string;
}

export interface LessonDetail {
  id: string;
  title: string;
  type: LessonType;
  unitId: string;
  order: number;
  xpReward: number;
  unit: {
    id: string;
    title: string;
    course: { id: string; title: string; level: string };
  };
  lectures: Lecture[];
  exercises: Exercise[];
}

// ─── Writing Tests & AI Assessment ──────────────────────────────

export type WritingExamType = 'ielts' | 'cefr';

export interface WritingTest {
  id: number;
  title: string;
  description: string | null;
  examType: WritingExamType;
  isPublished: boolean;
  createdAt: string;
  tasks?: WritingTask[];
}

export interface WritingTask {
  id: number;
  testId: number;
  taskText: string;
  part: string;
  image: string | null;
  minWords: number;
  maxWords: number;
  timeLimit: number;
}

export interface WritingSession {
  id: string;
  testId: number;
  userId: string;
  examType: WritingExamType;
  visibility: 'private' | 'group' | 'community' | 'ai_only';
  groupId: string | null;
  scoreAvg: number | null;
  cefrLevel: string | null;
  createdAt: string;
  test?: Pick<WritingTest, 'id' | 'title' | 'description'>;
  user?: { id: string; fullName: string; username: string; avatarUrl: string | null };
  responses?: WritingResponse[];
  reviews?: WritingReview[];
  _count?: { responses: number };
}

export interface WritingResponse {
  id: string;
  taskId: number;
  studentId: string;
  sessionId: string | null;
  essayText: string;
  wordCount: number;
  timeTakenSec: number | null;
  createdAt: string;
  student?: { id: string; fullName: string; username: string; avatarUrl: string | null };
  task?: Pick<WritingTask, 'id' | 'taskText' | 'part' | 'minWords' | 'maxWords'>;
  aiFeedback?: WritingAIFeedback | null;
}

export interface WritingAIFeedback {
  id: string;
  responseId: string;
  examType: WritingExamType;
  taskAchievement: number;
  coherenceCohesion: number;
  lexicalResource: number;
  grammaticalRange: number;
  overallScore: number;
  cefrLevel: string;
  grammarIssues: GrammarIssue[];
  vocabSuggestions: VocabSuggestion[];
  coherenceNotes: { issue: string; suggestion: string }[];
  taskNotes: string | null;
  aiSummary: string | null;
  improvedEssay: string | null;
  createdAt: string;
}

export interface WritingReview {
  id: string;
  sessionId: string;
  reviewerId: string;
  score: number;
  cefrLevel: string;
  feedback: string | null;
  createdAt: string;
  reviewer?: { id: string; fullName: string; avatarUrl: string | null };
}

export interface WritingSessionFeedbackResponse {
  feedbacks: (WritingAIFeedback & {
    response: { id: string; task: Pick<WritingTask, 'id' | 'taskText' | 'part'> };
  })[];
  aggregate: {
    averageOverallScore: number | null;
    cefrLevel: string | null;
    totalResponses: number;
  };
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
