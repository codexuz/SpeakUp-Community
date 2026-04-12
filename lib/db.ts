import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export const openDb = async () => {
  if (!db) {
    db = await SQLite.openDatabaseAsync('speakup.db');
    await initDb(db);
  }
  return db;
};

const initDb = async (database: SQLite.SQLiteDatabase) => {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS tests (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY,
      test_id INTEGER NOT NULL,
      q_text TEXT NOT NULL,
      part TEXT NOT NULL,
      image TEXT,
      speaking_timer INTEGER NOT NULL DEFAULT 30,
      prep_timer INTEGER NOT NULL DEFAULT 5,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER NOT NULL,
      student_id TEXT NOT NULL,
      local_uri TEXT,
      remote_url TEXT,
      is_synced INTEGER DEFAULT 0,
      teacher_score INTEGER,
      teacher_feedback TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT,
      payload TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
};

// =============================================
// Tests & Questions (cached from Supabase)
// =============================================

export const upsertTests = async (tests: any[]) => {
  const database = await openDb();
  for (const t of tests) {
    await database.runAsync(
      'INSERT OR REPLACE INTO tests (id, title, description) VALUES (?, ?, ?)',
      [t.id, t.title, t.description]
    );
  }
};

export const upsertQuestions = async (questions: any[]) => {
  const database = await openDb();
  for (const q of questions) {
    await database.runAsync(
      'INSERT OR REPLACE INTO questions (id, test_id, q_text, part, image, speaking_timer, prep_timer) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [q.id, q.test_id, q.q_text, q.part, q.image, q.speaking_timer, q.prep_timer]
    );
  }
};

export const getCachedTests = async () => {
  const database = await openDb();
  return await database.getAllAsync('SELECT * FROM tests ORDER BY id ASC') as any[];
};

export const getCachedQuestions = async (testId?: number) => {
  const database = await openDb();
  if (testId) {
    return await database.getAllAsync('SELECT * FROM questions WHERE test_id = ? ORDER BY id ASC', [testId]) as any[];
  }
  return await database.getAllAsync('SELECT * FROM questions ORDER BY id ASC') as any[];
};

export const getCachedQuestionById = async (questionId: number) => {
  const database = await openDb();
  return await database.getFirstAsync('SELECT * FROM questions WHERE id = ?', [questionId]) as any | null;
};

// =============================================
// Responses
// =============================================

export const saveResponseOffline = async (
  questionId: number, 
  studentId: string, 
  localUri: string
) => {
  const database = await openDb();
  const result = await database.runAsync(
    'INSERT INTO responses (question_id, student_id, local_uri, is_synced) VALUES (?, ?, ?, 0)',
    [questionId, studentId, localUri]
  );
  return result.lastInsertRowId;
};

export const getUnsyncedResponses = async () => {
    const database = await openDb();
    const rows = await database.getAllAsync('SELECT * FROM responses WHERE is_synced = 0');
    return rows;
};

export const markResponseSynced = async (id: number, remoteUrl: string) => {
    const database = await openDb();
    await database.runAsync('UPDATE responses SET is_synced = 1, remote_url = ? WHERE id = ?', [remoteUrl, id]);
};

export const getStudentResponses = async (studentId: string) => {
    const database = await openDb();
    return await database.getAllAsync('SELECT * FROM responses WHERE student_id = ? ORDER BY created_at DESC', [studentId]);
};

export const deleteResponseLocal = async (id: number) => {
    const database = await openDb();
    await database.runAsync('DELETE FROM responses WHERE id = ?', [id]);
};
