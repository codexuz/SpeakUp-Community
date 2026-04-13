import { apiFetchQuestion, apiFetchTests } from './api';

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

const normalizeQuestion = (q: any): Question => ({
  id: q.id,
  test_id: q.testId ?? q.test_id,
  q_text: q.qText ?? q.q_text,
  part: q.part,
  image: q.image,
  speaking_timer: q.speakingTimer ?? q.speaking_timer,
  prep_timer: q.prepTimer ?? q.prep_timer,
});

/**
 * Fetch tests with their questions from the API server.
 */
export const fetchTestsWithQuestions = async (): Promise<Test[]> => {
  const data = await apiFetchTests();

  return data.map((t: any) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    questions: (t.questions || []).map(normalizeQuestion),
  }));
};

/**
 * Get a single question by ID from the API.
 */
export const fetchQuestionById = async (id: number): Promise<Question | null> => {
  const q = await apiFetchQuestion(id);
  return normalizeQuestion(q);
};

/**
 * Get all questions for a given test from the API.
 */
export const fetchQuestionsByTestId = async (testId: number): Promise<Question[]> => {
  const tests = await apiFetchTests();
  const test = tests.find((t: any) => t.id === testId);
  if (!test || !test.questions) return [];
  return test.questions.map(normalizeQuestion);
};
