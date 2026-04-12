type TestRecord = {
  id: number;
  title: string;
  description?: string | null;
  created_at: string;
};

type QuestionRecord = {
  id: number;
  test_id: number;
  q_text: string;
  part: string;
  image?: string | null;
  speaking_timer: number;
  prep_timer: number;
  created_at: string;
};

type ResponseRecord = {
  id: number;
  question_id: number;
  student_id: string;
  local_uri?: string | null;
  remote_url?: string | null;
  is_synced: number;
  teacher_score?: number | null;
  teacher_feedback?: string | null;
  created_at: string;
};

type SyncQueueRecord = {
  id: number;
  action?: string | null;
  payload?: string | null;
  created_at: string;
};

type DatabaseState = {
  tests: TestRecord[];
  questions: QuestionRecord[];
  responses: ResponseRecord[];
  sync_queue: SyncQueueRecord[];
};

const STORAGE_KEY = 'speakup-web-db';

let databaseState: DatabaseState | null = null;

function getEmptyState(): DatabaseState {
  return {
    tests: [],
    questions: [],
    responses: [],
    sync_queue: [],
  };
}

function loadState(): DatabaseState {
  if (databaseState) {
    return databaseState;
  }

  if (typeof localStorage === 'undefined') {
    databaseState = getEmptyState();
    return databaseState;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    databaseState = raw ? (JSON.parse(raw) as DatabaseState) : getEmptyState();
  } catch {
    databaseState = getEmptyState();
  }

  return databaseState;
}

function persistState() {
  if (typeof localStorage === 'undefined' || !databaseState) {
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(databaseState));
}

function upsertById<T extends { id: number }>(items: T[], value: T) {
  const index = items.findIndex((item) => item.id === value.id);
  if (index >= 0) {
    items[index] = value;
    return;
  }

  items.push(value);
}

function getNextId(items: Array<{ id: number }>) {
  return items.reduce((maxId, item) => Math.max(maxId, item.id), 0) + 1;
}

// Web avoids importing expo-sqlite so Metro does not need the wa-sqlite wasm worker.
export const openDb = async () => loadState();

export const upsertTests = async (tests: any[]) => {
  const state = loadState();

  for (const test of tests) {
    upsertById(state.tests, {
      id: Number(test.id),
      title: test.title,
      description: test.description ?? null,
      created_at: test.created_at ?? new Date().toISOString(),
    });
  }

  persistState();
};

export const upsertQuestions = async (questions: any[]) => {
  const state = loadState();

  for (const question of questions) {
    upsertById(state.questions, {
      id: Number(question.id),
      test_id: Number(question.test_id),
      q_text: question.q_text,
      part: String(question.part),
      image: question.image ?? null,
      speaking_timer: Number(question.speaking_timer ?? 30),
      prep_timer: Number(question.prep_timer ?? 5),
      created_at: question.created_at ?? new Date().toISOString(),
    });
  }

  persistState();
};

export const getCachedTests = async () => {
  const state = loadState();
  return [...state.tests].sort((left, right) => left.id - right.id);
};

export const getCachedQuestions = async (testId?: number) => {
  const state = loadState();
  const questions = typeof testId === 'number'
    ? state.questions.filter((question) => question.test_id === testId)
    : state.questions;

  return [...questions].sort((left, right) => left.id - right.id);
};

export const getCachedQuestionById = async (questionId: number) => {
  const state = loadState();
  return state.questions.find((question) => question.id === questionId) ?? null;
};

export const saveResponseOffline = async (questionId: number, studentId: string, localUri: string) => {
  const state = loadState();
  const id = getNextId(state.responses);

  state.responses.push({
    id,
    question_id: questionId,
    student_id: studentId,
    local_uri: localUri,
    remote_url: null,
    is_synced: 0,
    teacher_score: null,
    teacher_feedback: null,
    created_at: new Date().toISOString(),
  });

  persistState();

  return id;
};

export const getUnsyncedResponses = async () => {
  const state = loadState();
  return state.responses.filter((response) => response.is_synced === 0);
};

export const markResponseSynced = async (id: number, remoteUrl: string) => {
  const state = loadState();
  const response = state.responses.find((item) => item.id === id);

  if (!response) {
    return;
  }

  response.is_synced = 1;
  response.remote_url = remoteUrl;
  persistState();
};

export const getStudentResponses = async (studentId: string) => {
  const state = loadState();

  return state.responses
    .filter((response) => response.student_id === studentId)
    .sort((left, right) => right.created_at.localeCompare(left.created_at));
};

export const deleteResponseLocal = async (id: number) => {
  const state = loadState();
  state.responses = state.responses.filter((response) => response.id !== id);
  persistState();
};