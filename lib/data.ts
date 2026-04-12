import { apiFetchQuestion, apiFetchTests } from './api';
import { getCachedQuestionById, getCachedQuestions, getCachedTests, upsertQuestions, upsertTests } from './db';

export interface Question {
  id: number;
  test_id: number;
  q_text: string;
  part: string;
  image: string | null;
  speaking_timer: number;
  prep_timer: number;
}

export interface Test {
  id: number;
  title: string;
  description: string | null;
  questions?: Question[];
}

/**
 * Fetch tests with their questions from the API server.
 * Falls back to local SQLite cache if offline.
 */
export const fetchTestsWithQuestions = async (): Promise<Test[]> => {
  try {
    const data = await apiFetchTests();

    // Normalize: API returns nested questions inside each test
    const tests: Test[] = [];
    const allQuestions: Question[] = [];

    for (const t of data) {
      const questions = (t.questions || []).map((q: any) => ({
        id: q.id,
        test_id: q.testId ?? q.test_id,
        q_text: q.qText ?? q.q_text,
        part: q.part,
        image: q.image,
        speaking_timer: q.speakingTimer ?? q.speaking_timer,
        prep_timer: q.prepTimer ?? q.prep_timer,
      }));
      tests.push({ id: t.id, title: t.title, description: t.description, questions });
      allQuestions.push(...questions);
    }

    // Cache to SQLite for offline use
    await upsertTests(tests);
    await upsertQuestions(allQuestions);

    return tests;
  } catch (e) {
    console.warn('Failed to fetch from API, using local cache:', e);
    return getTestsFromCache();
  }
};

/**
 * Read tests + questions purely from SQLite cache.
 */
export const getTestsFromCache = async (): Promise<Test[]> => {
  const tests = await getCachedTests();
  const questions = await getCachedQuestions();

  return tests.map((t: any) => ({
    ...t,
    questions: questions.filter((q: any) => q.test_id === t.id),
  }));
};

/**
 * Get a single question by ID. Tries API first, falls back to cache.
 */
export const fetchQuestionById = async (id: number): Promise<Question | null> => {
  try {
    const q = await apiFetchQuestion(id);
    return {
      id: q.id,
      test_id: q.testId ?? q.test_id,
      q_text: q.qText ?? q.q_text,
      part: q.part,
      image: q.image,
      speaking_timer: q.speakingTimer ?? q.speaking_timer,
      prep_timer: q.prepTimer ?? q.prep_timer,
    };
  } catch (e) {
    console.warn('Failed to fetch question, using cache:', e);
    return getCachedQuestionById(id);
  }
};
