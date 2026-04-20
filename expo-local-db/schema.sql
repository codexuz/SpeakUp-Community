-- ============================================================
-- SpeakUp Community – Expo Local-First SQLite Schema
-- Mirrors the server Prisma/PostgreSQL schema for offline use.
-- ============================================================
-- ─── Sync Metadata ──────────────────────────────────────────────
-- Every mutable table includes:
--   sync_status  TEXT  ('synced' | 'pending' | 'conflict')
--   last_synced_at TEXT (ISO-8601 timestamp, NULL = never synced)
--   updated_at     TEXT (ISO-8601 timestamp, set on every local write)
--   is_deleted     INTEGER (soft-delete flag for sync, 0 or 1)
-- ─── Enums (stored as TEXT, validated in app code) ──────────────
-- user_role:        'student' | 'teacher' | 'admin'
-- visibility:       'private' | 'group' | 'community' | 'ai_only'
-- group_role:       'owner' | 'teacher' | 'student'
-- request_status:   'pending' | 'approved' | 'rejected'
-- message_type:     'text' | 'image' | 'video' | 'file' | 'system'
-- challenge_type:   'daily' | 'weekly' | 'special'
-- exam_type:        'cefr' | 'ielts'
-- lesson_type:      'practice' | 'lecture' | 'mixed'
-- lecture_content_type: 'text' | 'audio' | 'video'
-- exercise_type:    'listenRepeat' | 'speakTheAnswer' | 'fillInBlank'
--                   | 'multipleChoice' | 'listenAndChoose' | 'roleplay'
--                   | 'pronunciation' | 'matchPairs' | 'reorderWords'
--                   | 'translateSentence' | 'tapWhatYouHear' | 'completeConversation'
-- ─── Users ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  phone TEXT UNIQUE,
  full_name TEXT NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student',
  verified_teacher INTEGER NOT NULL DEFAULT 0,
  gender TEXT,
  region TEXT,
  avatar_url TEXT,
  push_token TEXT,
  telegram_chat_id TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  -- sync columns
  sync_status TEXT NOT NULL DEFAULT 'synced',
  last_synced_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_deleted INTEGER NOT NULL DEFAULT 0
);
-- ─── User Follows ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_follows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sync_status TEXT NOT NULL DEFAULT 'pending',
  last_synced_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_deleted INTEGER NOT NULL DEFAULT 0,
  UNIQUE(follower_id, following_id)
);
CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON user_follows(following_id);
-- ─── Tests ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  test_type TEXT NOT NULL DEFAULT 'cefr',
  is_published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sync_status TEXT NOT NULL DEFAULT 'synced',
  last_synced_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_tests_published ON tests(is_published);
-- ─── Test Sessions ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS test_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  visibility TEXT NOT NULL DEFAULT 'private',
  group_id TEXT REFERENCES groups(id) ON DELETE
  SET
    NULL,
    exam_type TEXT NOT NULL DEFAULT 'cefr',
    is_anonymous INTEGER NOT NULL DEFAULT 0,
    likes INTEGER NOT NULL DEFAULT 0,
    comments_count INTEGER NOT NULL DEFAULT 0,
    score_avg REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    sync_status TEXT NOT NULL DEFAULT 'pending',
    last_synced_at TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    is_deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_test_sessions_user ON test_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_test_sessions_test ON test_sessions(test_id);
CREATE INDEX IF NOT EXISTS idx_test_sessions_group ON test_sessions(group_id);
CREATE INDEX IF NOT EXISTS idx_test_sessions_visibility ON test_sessions(visibility);
CREATE INDEX IF NOT EXISTS idx_test_sessions_created ON test_sessions(created_at);
-- ─── Questions ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  q_text TEXT NOT NULL,
  part TEXT NOT NULL,
  image TEXT,
  audio_url TEXT,
  speaking_timer INTEGER NOT NULL DEFAULT 30,
  prep_timer INTEGER NOT NULL DEFAULT 5,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sync_status TEXT NOT NULL DEFAULT 'synced',
  last_synced_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_deleted INTEGER NOT NULL DEFAULT 0
);
-- ─── Sample Answers ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sample_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  level TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  answer_text TEXT NOT NULL,
  audio_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sync_status TEXT NOT NULL DEFAULT 'synced',
  last_synced_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_deleted INTEGER NOT NULL DEFAULT 0,
  UNIQUE(question_id, level, version)
);
CREATE INDEX IF NOT EXISTS idx_sample_answers_question ON sample_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_sample_answers_level ON sample_answers(level);
-- ─── Responses ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id INTEGER REFERENCES test_sessions(id) ON DELETE
  SET
    NULL,
    local_uri TEXT,
    remote_url TEXT,
    teacher_score INTEGER,
    teacher_feedback TEXT,
    audio_processed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    sync_status TEXT NOT NULL DEFAULT 'pending',
    last_synced_at TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    is_deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_responses_student ON responses(student_id);
CREATE INDEX IF NOT EXISTS idx_responses_session ON responses(session_id);
CREATE INDEX IF NOT EXISTS idx_responses_created ON responses(created_at);
-- ─── Reviews ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES test_sessions(id) ON DELETE CASCADE,
  reviewer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score REAL NOT NULL,
  feedback TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sync_status TEXT NOT NULL DEFAULT 'pending',
  last_synced_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_deleted INTEGER NOT NULL DEFAULT 0,
  UNIQUE(session_id, reviewer_id)
);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON reviews(reviewer_id);
-- ─── Likes ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS likes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES test_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sync_status TEXT NOT NULL DEFAULT 'pending',
  last_synced_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_deleted INTEGER NOT NULL DEFAULT 0,
  UNIQUE(session_id, user_id)
);
-- ─── Comments ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES test_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sync_status TEXT NOT NULL DEFAULT 'pending',
  last_synced_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_comments_session ON comments(session_id);
-- ─── Groups ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  teacher_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL UNIQUE,
  is_global INTEGER NOT NULL DEFAULT 0,
  is_practice_room INTEGER NOT NULL DEFAULT 0,
  max_level TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sync_status TEXT NOT NULL DEFAULT 'synced',
  last_synced_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_deleted INTEGER NOT NULL DEFAULT 0
);
-- ─── Group Members ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS group_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'student',
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  sync_status TEXT NOT NULL DEFAULT 'synced',
  last_synced_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_deleted INTEGER NOT NULL DEFAULT 0,
  UNIQUE(group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_role ON group_members(role);
-- ─── Group Join Requests ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS group_join_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  sync_status TEXT NOT NULL DEFAULT 'pending',
  last_synced_at TEXT,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  UNIQUE(group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_group_join_requests_status ON group_join_requests(status);
-- ─── Teacher Verifications ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS teacher_verifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by TEXT REFERENCES users(id) ON DELETE
  SET
    NULL,
    review_note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    sync_status TEXT NOT NULL DEFAULT 'synced',
    last_synced_at TEXT,
    is_deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_teacher_verifications_user ON teacher_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_teacher_verifications_status ON teacher_verifications(status);
-- ─── Group Messages ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS group_messages (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'text',
  text TEXT,
  entities TEXT,
  -- JSON string
  reply_to_id TEXT REFERENCES group_messages(id) ON DELETE
  SET
    NULL,
    is_edited INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    sync_status TEXT NOT NULL DEFAULT 'pending',
    last_synced_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_group_messages_group_created ON group_messages(group_id, created_at);
CREATE INDEX IF NOT EXISTS idx_group_messages_sender ON group_messages(sender_id);
-- ─── Group Message Read Cursors ─────────────────────────────────
CREATE TABLE IF NOT EXISTS group_message_read_cursors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_msg_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  sync_status TEXT NOT NULL DEFAULT 'pending',
  last_synced_at TEXT,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  UNIQUE(group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_read_cursors_user ON group_message_read_cursors(user_id);
-- ─── Group Message Attachments ──────────────────────────────────
CREATE TABLE IF NOT EXISTS group_message_attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id TEXT NOT NULL REFERENCES group_messages(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sync_status TEXT NOT NULL DEFAULT 'synced',
  last_synced_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_msg_attachments_message ON group_message_attachments(message_id);
-- ─── Ads ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  ad_text TEXT,
  image_url TEXT NOT NULL,
  link_url TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  sync_status TEXT NOT NULL DEFAULT 'synced',
  last_synced_at TEXT,
  is_deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_ads_active ON ads(is_active);
-- ─── AI Feedback ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_feedbacks (
  id TEXT PRIMARY KEY,
  response_id INTEGER NOT NULL UNIQUE REFERENCES responses(id) ON DELETE CASCADE,
  transcript TEXT NOT NULL,
  grammar_score REAL NOT NULL,
  fluency_wpm REAL NOT NULL,
  fluency_score REAL NOT NULL,
  vocab_diversity REAL NOT NULL,
  pron_score REAL NOT NULL,
  overall_score REAL NOT NULL,
  grammar_issues TEXT NOT NULL DEFAULT '[]',
  -- JSON
  vocab_suggestions TEXT NOT NULL DEFAULT '[]',
  -- JSON
  pron_issues TEXT NOT NULL DEFAULT '[]',
  -- JSON
  naturalness TEXT,
  filler_words TEXT NOT NULL DEFAULT '{}',
  -- JSON
  pause_count INTEGER NOT NULL DEFAULT 0,
  ai_summary TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sync_status TEXT NOT NULL DEFAULT 'synced',
  last_synced_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_ai_feedbacks_response ON ai_feedbacks(response_id);
-- ─── User Progress ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  coins INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_active_date TEXT,
  streak_freezes INTEGER NOT NULL DEFAULT 0,
  total_recordings INTEGER NOT NULL DEFAULT 0,
  total_writings INTEGER NOT NULL DEFAULT 0,
  total_reviews_given INTEGER NOT NULL DEFAULT 0,
  fluency_wpm_avg REAL,
  vocab_diversity_avg REAL,
  pron_score_avg REAL,
  weekly_xp INTEGER NOT NULL DEFAULT 0,
  weekly_xp_reset_at TEXT NOT NULL DEFAULT (datetime('now')),
  sync_status TEXT NOT NULL DEFAULT 'pending',
  last_synced_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_user_progress_xp ON user_progress(xp);
CREATE INDEX IF NOT EXISTS idx_user_progress_weekly ON user_progress(weekly_xp);
CREATE INDEX IF NOT EXISTS idx_user_progress_streak ON user_progress(current_streak);
-- ─── Achievements ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS achievements (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon_url TEXT,
  xp_reward INTEGER NOT NULL DEFAULT 0,
  coin_reward INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  last_synced_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_deleted INTEGER NOT NULL DEFAULT 0
);
-- ─── User Achievements ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_achievements (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at TEXT NOT NULL DEFAULT (datetime('now')),
  sync_status TEXT NOT NULL DEFAULT 'pending',
  last_synced_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_deleted INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, achievement_id)
);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);
-- ─── Challenges ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'daily',
  difficulty TEXT NOT NULL DEFAULT 'beginner',
  prompt_text TEXT NOT NULL,
  prompt_image TEXT,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  xp_reward INTEGER NOT NULL DEFAULT 50,
  coin_reward INTEGER NOT NULL DEFAULT 5,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sync_status TEXT NOT NULL DEFAULT 'synced',
  last_synced_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_challenges_type_active ON challenges(type, is_active);
CREATE INDEX IF NOT EXISTS idx_challenges_dates ON challenges(starts_at, ends_at);
-- ─── Challenge Submissions ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS challenge_submissions (
  id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  response_id INTEGER NOT NULL,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  sync_status TEXT NOT NULL DEFAULT 'pending',
  last_synced_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_deleted INTEGER NOT NULL DEFAULT 0,
  UNIQUE(challenge_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_challenge_submissions_user ON challenge_submissions(user_id);
-- ─── Courses ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  level TEXT NOT NULL,
  image_url TEXT,
  is_published INTEGER NOT NULL DEFAULT 0,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sync_status TEXT NOT NULL DEFAULT 'synced',
  last_synced_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_courses_published ON courses(is_published);
-- ─── Course Units ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS course_units (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  last_synced_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_course_units_course ON course_units(course_id);
-- ─── Lessons ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL REFERENCES course_units(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'practice',
  "order" INTEGER NOT NULL,
  xp_reward INTEGER NOT NULL DEFAULT 10,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  last_synced_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_lessons_unit ON lessons(unit_id);
-- ─── Lectures ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lectures (
  id TEXT PRIMARY KEY,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL,
  title TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  text_body TEXT,
  media_url TEXT,
  thumbnail_url TEXT,
  duration_sec INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  sync_status TEXT NOT NULL DEFAULT 'synced',
  last_synced_at TEXT,
  is_deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_lectures_lesson ON lectures(lesson_id);
-- ─── Lecture Attachments ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lecture_attachments (
  id TEXT PRIMARY KEY,
  lecture_id TEXT NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sync_status TEXT NOT NULL DEFAULT 'synced',
  last_synced_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_lecture_attachments_lecture ON lecture_attachments(lecture_id);
-- ─── User Lecture Progress ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_lecture_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lecture_id TEXT NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
  completed INTEGER NOT NULL DEFAULT 0,
  progress_pct INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  last_synced_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_deleted INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, lecture_id)
);
CREATE INDEX IF NOT EXISTS idx_user_lecture_progress_user ON user_lecture_progress(user_id);
-- ─── Exercises ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exercises (
  id TEXT PRIMARY KEY,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  prompt_audio TEXT,
  correct_answer TEXT,
  sentence_template TEXT,
  target_text TEXT,
  audio_url TEXT,
  image_url TEXT,
  hints TEXT,
  -- JSON
  explanation TEXT,
  difficulty INTEGER NOT NULL DEFAULT 1,
  xp_reward INTEGER NOT NULL DEFAULT 10,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  last_synced_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_exercises_lesson ON exercises(lesson_id);
-- ─── Exercise Options ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exercise_options (
  id TEXT PRIMARY KEY,
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  audio_url TEXT,
  image_url TEXT,
  is_correct INTEGER NOT NULL DEFAULT 0,
  "order" INTEGER NOT NULL DEFAULT 0,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  last_synced_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_exercise_options_exercise ON exercise_options(exercise_id);
-- ─── Exercise Match Pairs ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS exercise_match_pairs (
  id TEXT PRIMARY KEY,
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  left_text TEXT NOT NULL,
  left_audio TEXT,
  right_text TEXT NOT NULL,
  right_audio TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  last_synced_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_exercise_match_pairs_exercise ON exercise_match_pairs(exercise_id);
-- ─── Exercise Word Bank Items ───────────────────────────────────
CREATE TABLE IF NOT EXISTS exercise_word_bank_items (
  id TEXT PRIMARY KEY,
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  correct_position INTEGER NOT NULL,
  is_distractor INTEGER NOT NULL DEFAULT 0,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  last_synced_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_exercise_word_bank_exercise ON exercise_word_bank_items(exercise_id);
-- ─── Exercise Conversation Lines ────────────────────────────────
CREATE TABLE IF NOT EXISTS exercise_conversation_lines (
  id TEXT PRIMARY KEY,
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  speaker TEXT NOT NULL,
  text TEXT NOT NULL,
  audio_url TEXT,
  is_user_turn INTEGER NOT NULL DEFAULT 0,
  accepted_answers TEXT,
  -- JSON
  "order" INTEGER NOT NULL,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  last_synced_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_exercise_convo_lines_exercise ON exercise_conversation_lines(exercise_id);
-- ─── Exercise Sessions ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exercise_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  hearts INTEGER NOT NULL DEFAULT 5,
  combo INTEGER NOT NULL DEFAULT 0,
  max_combo INTEGER NOT NULL DEFAULT 0,
  total_xp INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  wrong_count INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  last_synced_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_exercise_sessions_user ON exercise_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_exercise_sessions_lesson ON exercise_sessions(lesson_id);
CREATE INDEX IF NOT EXISTS idx_exercise_sessions_user_lesson ON exercise_sessions(user_id, lesson_id);
-- ─── Exercise Attempts ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exercise_attempts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES exercise_sessions(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  user_answer TEXT NOT NULL,
  -- JSON
  is_correct INTEGER NOT NULL,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  time_taken_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sync_status TEXT NOT NULL DEFAULT 'pending',
  last_synced_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_exercise_attempts_session ON exercise_attempts(session_id);
CREATE INDEX IF NOT EXISTS idx_exercise_attempts_exercise ON exercise_attempts(exercise_id);
-- ─── User Lesson Progress ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_lesson_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  completed INTEGER NOT NULL DEFAULT 0,
  score REAL,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  last_synced_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_deleted INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, lesson_id)
);
CREATE INDEX IF NOT EXISTS idx_user_lesson_progress_user ON user_lesson_progress(user_id);
-- ─── User Reputation ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_reputations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  helpful_votes INTEGER NOT NULL DEFAULT 0,
  clarity_score REAL NOT NULL DEFAULT 0,
  reviews_given INTEGER NOT NULL DEFAULT 0,
  mentor_level INTEGER NOT NULL DEFAULT 0,
  badges TEXT NOT NULL DEFAULT '[]',
  -- JSON
  sync_status TEXT NOT NULL DEFAULT 'synced',
  last_synced_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_user_reputations_helpful ON user_reputations(helpful_votes);
CREATE INDEX IF NOT EXISTS idx_user_reputations_mentor ON user_reputations(mentor_level);
-- ─── Writing Tests ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS writing_tests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  exam_type TEXT NOT NULL DEFAULT 'cefr',
  is_published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sync_status TEXT NOT NULL DEFAULT 'synced',
  last_synced_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_writing_tests_published ON writing_tests(is_published);
-- ─── Writing Tasks ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS writing_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_id INTEGER NOT NULL REFERENCES writing_tests(id) ON DELETE CASCADE,
  task_text TEXT NOT NULL,
  part TEXT NOT NULL,
  image TEXT,
  min_words INTEGER NOT NULL DEFAULT 150,
  max_words INTEGER NOT NULL DEFAULT 250,
  time_limit INTEGER NOT NULL DEFAULT 1200,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sync_status TEXT NOT NULL DEFAULT 'synced',
  last_synced_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_deleted INTEGER NOT NULL DEFAULT 0
);
-- ─── Writing Sessions ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS writing_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_id INTEGER NOT NULL REFERENCES writing_tests(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exam_type TEXT NOT NULL DEFAULT 'cefr',
  visibility TEXT NOT NULL DEFAULT 'private',
  group_id TEXT REFERENCES groups(id) ON DELETE
  SET
    NULL,
    score_avg REAL,
    cefr_level TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    sync_status TEXT NOT NULL DEFAULT 'pending',
    last_synced_at TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    is_deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_writing_sessions_user ON writing_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_writing_sessions_test ON writing_sessions(test_id);
CREATE INDEX IF NOT EXISTS idx_writing_sessions_group ON writing_sessions(group_id);
CREATE INDEX IF NOT EXISTS idx_writing_sessions_created ON writing_sessions(created_at);
-- ─── Writing Responses ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS writing_responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES writing_tasks(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id INTEGER REFERENCES writing_sessions(id) ON DELETE
  SET
    NULL,
    essay_text TEXT NOT NULL,
    word_count INTEGER NOT NULL,
    time_taken_sec INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    sync_status TEXT NOT NULL DEFAULT 'pending',
    last_synced_at TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    is_deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_writing_responses_student ON writing_responses(student_id);
CREATE INDEX IF NOT EXISTS idx_writing_responses_session ON writing_responses(session_id);
CREATE INDEX IF NOT EXISTS idx_writing_responses_created ON writing_responses(created_at);
-- ─── Writing AI Feedback ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS writing_ai_feedbacks (
  id TEXT PRIMARY KEY,
  response_id INTEGER NOT NULL UNIQUE REFERENCES writing_responses(id) ON DELETE CASCADE,
  exam_type TEXT NOT NULL,
  task_achievement REAL NOT NULL,
  coherence_cohesion REAL NOT NULL,
  lexical_resource REAL NOT NULL,
  grammatical_range REAL NOT NULL,
  overall_score REAL NOT NULL,
  cefr_level TEXT NOT NULL,
  grammar_issues TEXT NOT NULL DEFAULT '[]',
  -- JSON
  vocab_suggestions TEXT NOT NULL DEFAULT '[]',
  -- JSON
  coherence_notes TEXT NOT NULL DEFAULT '[]',
  -- JSON
  task_notes TEXT,
  ai_summary TEXT,
  improved_essay TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sync_status TEXT NOT NULL DEFAULT 'synced',
  last_synced_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_deleted INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_writing_ai_feedbacks_response ON writing_ai_feedbacks(response_id);
-- ─── Writing Reviews ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS writing_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES writing_sessions(id) ON DELETE CASCADE,
  reviewer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score REAL NOT NULL,
  feedback TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sync_status TEXT NOT NULL DEFAULT 'pending',
  last_synced_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_deleted INTEGER NOT NULL DEFAULT 0,
  UNIQUE(session_id, reviewer_id)
);
CREATE INDEX IF NOT EXISTS idx_writing_reviews_reviewer ON writing_reviews(reviewer_id);
-- ─── Sync Queue (outgoing changes to push to server) ────────────
CREATE TABLE IF NOT EXISTS sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  row_id TEXT NOT NULL,
  action TEXT NOT NULL,
  -- 'create' | 'update' | 'delete'
  payload TEXT NOT NULL,
  -- JSON snapshot of the row
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  retries INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_sync_queue_table ON sync_queue(table_name);
CREATE INDEX IF NOT EXISTS idx_sync_queue_created ON sync_queue(created_at);
-- ─── Key-Value Store (app settings, last sync timestamps) ───────
CREATE TABLE IF NOT EXISTS kv_store (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);