# Course Builder — React + shadcn/ui Rebuild Documentation

> Blueprint for rebuilding the SpeakUp Community Course Builder from React Native (Expo Router) to React (Next.js App Router) with shadcn/ui components.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Data Model & TypeScript Types](#2-data-model--typescript-types)
3. [API Layer](#3-api-layer)
4. [Routing Structure](#4-routing-structure)
5. [Page-by-Page Specifications](#5-page-by-page-specifications)
   - 5.1 [Admin Course List](#51-admin-course-list)
   - 5.2 [Create Course](#52-create-course)
   - 5.3 [Course Builder (Unit/Lesson Manager)](#53-course-builder-unitlesson-manager)
   - 5.4 [Edit Course](#54-edit-course)
   - 5.5 [Lesson Builder (Exercise/Lecture Editor)](#55-lesson-builder-exerciselecture-editor)
   - 5.6 [Student Course List](#56-student-course-list)
   - 5.7 [Course Detail (Duolingo-style Path)](#57-course-detail-duolingo-style-path)
   - 5.8 [Lesson Player (Exercise Session)](#58-lesson-player-exercise-session)
   - 5.9 [Lecture Viewer](#59-lecture-viewer)
6. [UI/UX Feature Specifications](#6-uiux-feature-specifications)
7. [shadcn/ui Component Mapping](#7-shadcnui-component-mapping)
8. [State Management](#8-state-management)
9. [File Structure](#9-file-structure)

---

## 1. Architecture Overview

### Current Stack (React Native)
- **Framework:** Expo Router (file-based routing)
- **UI:** Custom React Native `StyleSheet` components
- **Icons:** `lucide-react-native`
- **State:** React local state + `useFocusEffect` for data refetch
- **API:** Custom fetch wrapper with auth token headers
- **Theme:** Centralized `TG` theme object from `@/constants/theme`

### Target Stack (React Web)
- **Framework:** Next.js 14+ App Router
- **UI:** shadcn/ui + Tailwind CSS
- **Icons:** `lucide-react`
- **State:** React local state + `useEffect` / React Query (TanStack Query)
- **API:** Same REST endpoints, wrapped in a typed client
- **Theme:** Tailwind CSS theme + shadcn/ui theming (CSS variables)
- **Forms:** React Hook Form + Zod validation

---

## 2. Data Model & TypeScript Types

All types should be preserved. Create `src/lib/types.ts`:

```typescript
// ─── Courses ────────────────────────────────────────────────
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
  level: string;                // 'A2' | 'B1' | 'B2' | 'C1'
  imageUrl: string | null;
  isPublished: boolean;
  order: number;
  totalLessons: number;
  completedLessons: number;     // student-specific
  progressPercent: number;      // student-specific
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
  completed: boolean;           // student-specific
  score: number | null;
  xpEarned: number;
}

export interface LessonDetail extends Lesson {
  exercises: Exercise[];
  lectures: Lecture[];
  unit: {
    id: string;
    title: string;
    course: { id: string; title: string };
  };
}

export interface Lecture {
  id: string;
  lessonId: string;
  contentType: LectureContentType;
  title: string;
  order: number;
  textBody: string | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  durationSec: number | null;
  createdAt: string;
  updatedAt: string;
  attachments: LectureAttachment[];
  userProgress?: UserLectureProgress | null;
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
  difficulty: number;           // 1=Easy, 2=Medium, 3=Hard
  xpReward: number;
  options: ExerciseOption[];
  matchPairs: ExerciseMatchPair[];
  wordBankItems: ExerciseWordBankItem[];
  conversationLines: ExerciseConversationLine[];
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
}

export type TTSVoice = 'erin' | 'george' | 'lisa' | 'emily' | 'nick';
```

---

## 3. API Layer

Base URL: `https://speakup.impulselc.uz/api`
TTS URL: `https://backend.impulselc.uz/api/voice-chat-bot/text-to-voice-url`

Create `src/lib/api.ts` with typed functions. All requests require `Authorization: Bearer <token>` header.

### Course API Functions

| Function | Method | Endpoint | Description |
|---|---|---|---|
| `apiFetchCourses(level?, all?)` | GET | `/courses` | List courses (student view, filtered) |
| `apiFetchAdminCourses()` | GET | `/courses/admin` | List all courses (admin) |
| `apiFetchCourse(id)` | GET | `/courses/:id` | Get course with units & lessons |
| `apiCreateCourse(data)` | POST | `/courses` | Create course (multipart if image) |
| `apiUpdateCourse(id, data)` | PATCH | `/courses/:id` | Update course |
| `apiDeleteCourse(id)` | DELETE | `/courses/:id` | Delete course |

### Unit API Functions

| Function | Method | Endpoint | Description |
|---|---|---|---|
| `apiCreateCourseUnit(data)` | POST | `/courses/units` | Create unit in a course |
| `apiUpdateCourseUnit(id, data)` | PATCH | `/courses/units/:id` | Update unit title/order |
| `apiDeleteCourseUnit(id)` | DELETE | `/courses/units/:id` | Delete unit + cascade lessons |

### Lesson API Functions

| Function | Method | Endpoint | Description |
|---|---|---|---|
| `apiFetchLesson(id)` | GET | `/courses/lessons/:id` | Get lesson with exercises + lectures |
| `apiCreateLessonAdmin(data)` | POST | `/courses/lessons` | Create lesson in unit |
| `apiUpdateLessonAdmin(id, data)` | PATCH | `/courses/lessons/:id` | Update lesson |
| `apiDeleteLessonAdmin(id)` | DELETE | `/courses/lessons/:id` | Delete lesson + cascade exercises |
| `apiCompleteLesson(id, score?)` | POST | `/courses/lessons/:id/complete` | Mark lesson complete (student) |

### Lecture API Functions

| Function | Method | Endpoint | Description |
|---|---|---|---|
| `apiFetchLecture(id)` | GET | `/courses/lectures/:id` | Get lecture content |
| `apiCreateLecture(data)` | POST | `/courses/lectures` | Create lecture |
| `apiUpdateLecture(id, data)` | PATCH | `/courses/lectures/:id` | Update lecture |
| `apiDeleteLecture(id)` | DELETE | `/courses/lectures/:id` | Delete lecture |
| `apiUpdateLectureProgress(id, data)` | POST | `/courses/lectures/:id/progress` | Track reading/viewing progress |

### Exercise API Functions

| Function | Method | Endpoint | Description |
|---|---|---|---|
| `apiCreateExercise(data)` | POST | `/courses/exercises` | Create exercise with all sub-data |
| `apiUpdateExercise(id, data)` | PATCH | `/courses/exercises/:id` | Update exercise |
| `apiDeleteExercise(id)` | DELETE | `/courses/exercises/:id` | Delete exercise |

### Session API Functions (Student Gameplay)

| Function | Method | Endpoint | Description |
|---|---|---|---|
| `apiStartLessonSession(lessonId)` | POST | `/courses/sessions/start` | Start exercise session |
| `apiSubmitAttempt(sessionId, data)` | POST | `/courses/sessions/:id/attempt` | Submit answer for an exercise |
| `apiCompleteSession(sessionId)` | POST | `/courses/sessions/:id/complete` | Finalize session |

### Text-to-Speech

| Function | Method | Endpoint | Description |
|---|---|---|---|
| `apiTextToSpeech(text, voice)` | POST | TTS URL | Generate audio from text. Voices: `erin`, `george`, `lisa`, `emily`, `nick` |

---

## 4. Routing Structure

### Next.js App Router file-based routes

```
src/app/
├── (admin)/
│   └── admin/
│       └── courses/
│           ├── page.tsx                    # Admin course list
│           ├── create/page.tsx             # Create new course
│           ├── [id]/
│           │   ├── page.tsx                # Course builder (units + lessons)
│           │   └── edit/page.tsx           # Edit course metadata
│           └── lessons/
│               └── [id]/page.tsx           # Lesson builder (exercises + lectures)
├── (student)/
│   └── courses/
│       ├── page.tsx                        # Student course list
│       └── [id]/
│           ├── page.tsx                    # Course detail (Duolingo path)
│           └── lessons/
│               └── [id]/
│                   ├── page.tsx            # Lesson player (exercise session)
│                   └── lecture/
│                       └── [lectureId]/page.tsx  # Lecture viewer
```

### Route-to-Page Mapping

| Route | Page | Role |
|---|---|---|
| `/admin/courses` | Admin Course List | Admin |
| `/admin/courses/create` | Create Course Form | Admin |
| `/admin/courses/[id]` | Course Builder (manage units & lessons) | Admin |
| `/admin/courses/[id]/edit` | Edit Course Form | Admin |
| `/admin/courses/lessons/[id]` | Lesson Builder (manage exercises & lectures) | Admin |
| `/courses` | Student Course List (browse & enroll) | Student |
| `/courses/[id]` | Course Detail with Duolingo-style path | Student |
| `/courses/[id]/lessons/[id]` | Lesson Player (gamified exercise session) | Student |
| `/courses/[id]/lessons/[id]/lecture/[id]` | Lecture Viewer (markdown, audio, video) | Student |

---

## 5. Page-by-Page Specifications

### 5.1 Admin Course List

**Current:** `app/(admin)/courses.tsx` (tab) + `app/admin/courses/` routes
**Purpose:** Shows all courses for admin management.

#### UI Components
- Page header with "Courses" title
- **"Create Course"** button → navigates to `/admin/courses/create`
- Course list as a table or card grid
- Each row shows: title, level badge, published status toggle, lesson count, actions (edit, delete)

#### shadcn/ui Components
- `Card` — course cards
- `Badge` — level badges (A2/B1/B2/C1), published/draft status
- `Button` — create, edit, delete actions
- `Table` (or `Card` grid) — course listing
- `AlertDialog` — confirm delete
- `Switch` — toggle published/draft inline

#### Behavior
- Fetch via `apiFetchAdminCourses()`
- Click course → navigate to `/admin/courses/[id]` (Course Builder)
- Click edit → navigate to `/admin/courses/[id]/edit`
- Delete → confirmation dialog → `apiDeleteCourse(id)`

---

### 5.2 Create Course

**Current:** `app/admin/courses/create.tsx`
**Purpose:** Form to create a new course.

#### Form Fields

| Field | Type | Required | Notes |
|---|---|---|---|
| Title | Text input | Yes | e.g. "Everyday Conversations" |
| Description | Textarea (multiline) | Yes | Course description |
| Level | Segmented button group | Yes | Options: `A2`, `B1`, `B2`, `C1` |
| Published | Switch/toggle | No | Default: `false` (draft). Hint: "If disabled, the course will be saved as a draft." |
| Cover Image | File upload with preview | No | 16:9 aspect ratio, max 0.8 quality |

#### shadcn/ui Components
- `Input` — title
- `Textarea` — description
- `ToggleGroup` — level selector (A2/B1/B2/C1), active state shows checkmark icon
- `Switch` + `Label` — publish toggle with description
- Custom file upload area with `Card` — image picker with drag-drop zone
- `Button` — "Create Course" submit (disabled when invalid, shows spinner when loading)

#### Validation
- Title required (trimmed non-empty)
- Description required (trimmed non-empty)
- Submit button disabled when `!title.trim() || !description.trim() || creating`

#### API Call
- `apiCreateCourse({ title, description, level, imageUri, isPublished })`
- On success: toast "Course created successfully", navigate back
- On error: toast error message

---

### 5.3 Course Builder (Unit/Lesson Manager)

**Current:** `app/admin/courses/[id]/index.tsx`
**Purpose:** The core course structure editor. Manage units and lessons within a course.

#### Layout Structure

```
┌─────────────────────────────────────┐
│ ← Course Builder    [Edit] [👁/👁‍🗨] │  Header with back, edit, publish toggle
├─────────────────────────────────────┤
│ [Cover Image]  Course Title         │  Course header card with image,
│                B1 · 12 total lessons│  level badge, lesson count
├─────────────────────────────────────┤
│ ┌─ Unit 1: Greetings ─── [✏️][🗑] ┐│  Unit card with header actions
│ │ • Introducing Yourself    [×]    ││  Lessons listed under unit
│ │ • At the Airport          [×]    ││  Click lesson → go to Lesson Builder
│ │ 📖 Cultural Notes         [×]    ││  Lesson type badges (practice/lecture/mixed)
│ │ [+ Add Lesson]                   ││  Add lesson button per unit
│ └──────────────────────────────────┘│
│ ┌─ Unit 2: Shopping ───── [✏️][🗑] ┐│
│ │ • At the Market           [×]    ││
│ │ [+ Add Lesson]                   ││
│ └──────────────────────────────────┘│
│                                     │
│ [+ Add New Unit]                    │  Primary action button
└─────────────────────────────────────┘
```

#### Features

1. **Course Header Card**
   - Cover image or placeholder icon
   - Title, level badge, total lesson count

2. **Unit Cards** (displayed as a list)
   - Unit title with edit (pencil) and delete (trash) icons
   - Lessons listed within each unit
   - Each lesson shows: dot indicator, title, type badge (`📖 Lecture`, `📖🏋️ Mixed`)
   - Click lesson → navigate to `/admin/courses/lessons/[lessonId]`
   - Delete lesson → inline `×` icon with confirmation
   - "Add Lesson" button at bottom of each unit

3. **Top Bar Actions**
   - Back button
   - Edit button → navigate to `/admin/courses/[id]/edit`
   - Publish/Unpublish toggle (`Eye`/`EyeOff` icon)

4. **Unit Modal** (Dialog)
   - Title input for unit name
   - Used for both create and edit (state tracked by `editUnitId`)
   - Cancel/Save buttons

5. **Lesson Modal** (Dialog)
   - Title input for lesson name
   - Lesson type selector: `practice` 🏋️ | `lecture` 📖 | `mixed` 📖🏋️
   - Cancel/Save buttons

#### shadcn/ui Components
- `Card`, `CardHeader`, `CardContent` — unit cards, course header
- `Button` (icon variant) — edit, delete, add actions
- `Badge` — level, lesson type
- `Dialog`, `DialogContent`, `DialogHeader`, `DialogFooter` — unit/lesson modals
- `Input` — unit/lesson title
- `ToggleGroup` — lesson type selector in modal
- `AlertDialog` — delete confirmations ("Delete unit and all its lessons?")
- `Separator` — between unit header and lessons
- `Tooltip` — on icon buttons

#### API Calls
- `apiFetchCourse(id)` — load course with units and lessons
- `apiUpdateCourse(id, { isPublished })` — toggle publish
- `apiCreateCourseUnit({ courseId, title })` — add unit
- `apiUpdateCourseUnit(id, { title })` — edit unit
- `apiDeleteCourseUnit(id)` — delete unit (with confirmation)
- `apiCreateLessonAdmin({ unitId, title, type, xpReward: 10 })` — add lesson
- `apiDeleteLessonAdmin(id)` — delete lesson (with confirmation)

---

### 5.4 Edit Course

**Current:** `app/admin/courses/[id]/edit.tsx`
**Purpose:** Edit existing course metadata. Identical form layout to Create Course but pre-filled.

#### Differences from Create
- Loads existing data via `apiFetchCourse(id)` on mount
- Pre-fills all form fields
- Shows loading spinner while fetching
- Submit calls `apiUpdateCourse(id, data)` instead of create
- Image upload: only sends new `imageUri` if a local file was chosen (not if existing URL)
- Button text: "Update Course" instead of "Create Course"

---

### 5.5 Lesson Builder (Exercise/Lecture Editor)

**Current:** `app/admin/courses/lessons/[id]/index.tsx`
**Purpose:** The most complex page. Full exercise and lecture management for a lesson.

#### Layout Structure

```
┌──────────────────────────────────────────┐
│ ← Exercise Builder              [✨]     │  Header: back, title, breadcrumb, templates
│   Course Title • Unit Title              │  Subtitle shows course/unit context
├──────────────────────────────────────────┤
│ Lesson Title                             │
│ [Unit 1] [🏋️ Practice] [⚡ 10 XP]      │  Lesson metadata badges
├──────────────────────────────────────────┤
│ ┌─ LECTURES (2) ──────────────────────┐  │  Lecture section (if type=lecture|mixed)
│ │ [📄] Intro to Present Perfect       │  │  Cards with content type icon
│ │      Text • 3 files     [↑↓ ✏️ 🗑] │  │  Reorder, edit, delete actions
│ │ [🎤] Pronunciation Guide            │  │
│ │      Audio • 5:20       [↑↓ ✏️ 🗑] │  │
│ │ [+ Add Lecture]                      │  │
│ └──────────────────────────────────────┘  │
├──────────────────────────────────────────┤
│ ┌─ STATS DASHBOARD ───────────────────┐  │  Statistics card
│ │   12 Exercises  │  180 Total XP  │  │  │  3 stats: count, XP, types
│ │    4 Types      │                │  │  │
│ │ [▓▓▓▓▓▓░░░░] difficulty bar       │  │  Color-coded difficulty distribution
│ │ 🟢 Easy(5) 🟠 Medium(4) 🔴 Hard(3)│  │
│ │ [📋 4] [🔀 3] [✏️ 3] [🎧 2]      │  │  Exercise type chips with counts
│ └──────────────────────────────────────┘  │
├──────────────────────────────────────────┤
│ 🔍 Search exercises... [🏷️] [☐]        │  Search box, filter toggle, bulk select
│                                          │
│ Filters: [All|MCQ|Fill|Listen|...] type  │  Expandable filter panel
│          [All|Easy|Medium|Hard] difficulty│
│          [✕ Clear Filters]               │
│                                          │
│ [☐ Select all (3 selected)] [🗑 Delete] │  Bulk action bar
├──────────────────────────────────────────┤
│ Exercise Cards (list)                    │
│ ┌──────────────────────────────────────┐ │
│ │ #1 [📋 Multiple Choice]  [↑↓ 📋 👁 🗑]│ │  Exercise card with colored left border
│ │ What does "ubiquitous" mean?         │ │  Type badge, order number
│ │ ✓ Found everywhere    ○ Rare         │ │  Inline preview of content
│ │ ○ Beautiful           ○ Complex      │ │
│ │ [🟢 Easy] [⚡ 10 XP] [💡 2] [📝]   │ │  Footer: difficulty, XP, hints, explanation
│ └──────────────────────────────────────┘ │
│                                          │
│ [+ Add Exercise]                         │  Primary action
│ [✨ Use Template]                        │  Secondary action
└──────────────────────────────────────────┘
```

#### Exercise Card Features

Each exercise card displays:
- **Color-coded left border** based on exercise type group (Listen=purple, Speak=coral, Read/Write=green, Interactive=yellow)
- **Order badge** `#1`, `#2` etc.
- **Type badge** with emoji and label
- **Prompt text** (truncated to 2 lines)
- **Inline preview** of content:
  - MCQ: shows options with correct marked ✓
  - Match Pairs: shows left → right mappings
  - Word Bank: shows word chips (distractors in red)
  - Conversation: shows speaker lines
  - Fill-in-blank: shows correct answer
  - Target text: shows 🎯 target
- **Footer badges**: difficulty (color-coded), XP, hint count, explanation indicator
- **Actions**: reorder up/down, duplicate, preview, delete
- **Long press** → enters bulk selection mode
- **Click** → opens edit wizard

#### Exercise Type Groups (for grouping and color-coding)

```typescript
const EXERCISE_TYPE_GROUPS = [
  {
    label: 'Listen',
    color: '#6C5CE7',  // purple
    types: ['listenRepeat', 'listenAndChoose', 'tapWhatYouHear']
  },
  {
    label: 'Speak',
    color: '#E17055',  // coral
    types: ['speakTheAnswer', 'pronunciation', 'roleplay']
  },
  {
    label: 'Read / Write',
    color: '#00B894',  // green
    types: ['multipleChoice', 'fillInBlank', 'reorderWords', 'translateSentence']
  },
  {
    label: 'Interactive',
    color: '#FDCB6E',  // yellow
    types: ['matchPairs', 'completeConversation']
  },
];
```

#### Exercise Editor Wizard (3-Step Modal)

Opens as a **Sheet/Dialog** with three wizard steps:

**Step 1: Type Selection**
- Title: "Choose Exercise Type"
- Grouped by category (Listen, Speak, Read/Write, Interactive)
- Each type card shows: emoji icon, label, short description
- Selected type gets highlighted border + checkmark

**Step 2: Content**
- Shows current type indicator with "Change" link back to Step 1
- **Prompt** field (textarea, required)
- **Type-specific fields** (see below)

**Step 3: Settings**
- **Difficulty Level**: 3-option selector (🟢 Easy, 🟠 Medium, 🔴 Hard)
- **XP Reward**: Quick chips (5, 10, 15, 20, 25, 30) + custom input
- **Explanation**: Textarea — shown after student answers
- **Hints**: Dynamic list — add/remove progressive hints

**Wizard Navigation:**
- Step indicator bar at top (1. Type → 2. Content → 3. Settings) with checkmarks for completed steps
- Back/Next buttons at bottom
- Final step shows "Create Exercise" / "Update Exercise" button
- Save button also in header

#### Type-Specific Fields (Step 2)

| Exercise Type | Additional Fields |
|---|---|
| **listenRepeat** | Audio player/URL, Generate Audio button (TTS), Target Text |
| **pronunciation** | Audio player/URL, Generate Audio button (TTS), Target Text |
| **listenAndChoose** | Audio player/URL, Generate Audio button, Options (min 2, mark correct) |
| **tapWhatYouHear** | Audio player/URL, Generate Audio button, Options (min 2, mark correct) |
| **speakTheAnswer** | Audio player/URL, Generate Audio button, Correct Answer, Image URL |
| **multipleChoice** | Options list (2-6, mark 1 correct with radio toggle) |
| **fillInBlank** | Sentence Template (must contain `___`), Correct Answer, Options (optional, for dropdown mode) |
| **reorderWords** | Correct Sentence (words will be scrambled), Distractors list, Word bank preview |
| **translateSentence** | Correct Sentence, Distractors list, Word bank preview |
| **matchPairs** | Pairs list (min 2, left ↔ right inputs) |
| **completeConversation** | Conversation lines (Bot/User toggle), Accepted answers for user turns |
| **roleplay** | Conversation lines (Bot/User toggle) |

#### Audio Generation (TTS)

For audio-requiring types (`listenRepeat`, `listenAndChoose`, `tapWhatYouHear`, `pronunciation`, `speakTheAnswer`):
- Voice selector: `erin`, `george`, `lisa`, `emily`, `nick` (chip toggle group)
- "Generate Audio" button → calls `apiTextToSpeech(text, voice)`
- Audio preview player (waveform)
- Audio URL input (manual override)
- Remove audio button

#### Quick Templates Modal

Available templates (pre-fill exercise form and skip to Step 2):

| Template | Pre-fills |
|---|---|
| Vocabulary MCQ | `multipleChoice`, 4 options, difficulty: Easy |
| Grammar Fill-in | `fillInBlank`, template with `___`, difficulty: Medium |
| Word Order | `reorderWords`, empty sentence, difficulty: Medium |
| Listening Quiz | `listenAndChoose`, 3 options, difficulty: Easy |
| Translation | `translateSentence`, empty sentence, difficulty: Medium |
| Dialogue | `completeConversation`, 3-line conversation, difficulty: Medium |
| Blank Exercise | Opens empty wizard at Step 1 |

#### Filter & Search

- **Search box**: Full-text search across prompt, correct answer, type label
- **Type filter**: Horizontal scrollable chips for all 12 exercise types + "All"
- **Difficulty filter**: Chips for Easy/Medium/Hard + "All"
- **Active filter count badge** on filter button
- **Clear Filters** button when any filter active
- **Results count**: "5 of 12 exercises" when filtered

#### Bulk Operations

- Toggle selection mode via toolbar icon
- Checkbox per exercise card
- "Select all" toggle
- Bulk delete with confirmation ("Delete 3 exercises?")
- Long-press on card enters selection mode

#### Exercise Preview Modal

Full-screen sheet showing all exercise details:
- Type badge with color
- Difficulty + XP info
- Prompt text
- All content: correct answer, sentence template, target text, audio URL
- Options list (correct highlighted)
- Match pairs table
- Word bank with distractors highlighted
- Conversation lines with user turns marked
- Hints list
- Explanation
- "Edit" button in header → opens editor

#### Lecture Section

Shown only when lesson type is `lecture` or `mixed`:
- Section header: "Lectures (count)"
- Lecture cards with:
  - Content type icon (📄 text, 🎤 audio, 🎬 video)
  - Title, content type label, duration, attachment count
  - Reorder arrows (up/down)
  - Edit + Delete buttons
- "Add Lecture" button

#### Lecture Editor Modal

- **Content Type** selector: Text | Audio | Video (icon tabs)
- **Title** input
- **For Text**: Markdown editor with preview
- **For Audio/Video**: Media URL input, Thumbnail URL input, Duration (seconds) input
- Save/Cancel

#### Validation Rules

| Type | Validation |
|---|---|
| All | Prompt is required |
| MCQ/listenAndChoose/tapWhatYouHear | ≥2 options, exactly 1 correct |
| fillInBlank | Template must contain `___` |
| matchPairs | ≥2 complete pairs |
| reorderWords/translateSentence | Sentence needs ≥3 words |
| completeConversation | ≥1 user turn |

#### shadcn/ui Components for Lesson Builder

- `Sheet` / `Dialog` — exercise wizard, lecture editor, templates, preview
- `Tabs` — wizard step indicator
- `Card` — exercise cards, lecture cards, stats dashboard
- `Badge` — type badges, difficulty, XP
- `Button` — all actions (icon variants for toolbar)
- `Input`, `Textarea` — form fields
- `ToggleGroup` — difficulty, voice, lesson type, content type
- `RadioGroup` — option correct toggle
- `Checkbox` — bulk selection
- `ScrollArea` — scrollable filter chips
- `Command` or filter chips — exercise type/difficulty filter
- `Progress` — difficulty distribution bar
- `Separator` — section dividers
- `AlertDialog` — delete confirmations
- `Tooltip` — action button tooltips
- `Popover` — filter panel
- `DropdownMenu` — exercise card action menu (alternative to inline icons)
- Custom Markdown editor component (use `@uiw/react-md-editor` or similar)
- Custom audio waveform player component

---

### 5.6 Student Course List

**Current:** `app/courses/index.tsx`
**Purpose:** Browse available courses as a student with progress tracking.

#### Layout
- Header: "Courses" with back button
- Pull-to-refresh
- Course cards in a vertical grid
- Each card:
  - Full-width, rounded, colored by level
  - 3D depth effect (bottom border darker shade)
  - Level pill badge (top-left)
  - Checkmark icon (top-right, if 100% complete)
  - Course title (bold white)
  - Progress: "5/12 lessons"
  - Progress bar (white on semi-transparent)

#### Level Color Scheme

```typescript
const LEVEL_COLORS = {
  'A1': { bg: '#58CC02', dark: '#4CAD02' },
  'A2': { bg: '#1CB0F6', dark: '#1899D6' },
  'B1': { bg: '#FF9600', dark: '#E08600' },
  'B2': { bg: '#CE82FF', dark: '#B56AE8' },
  'C1': { bg: '#FF4B4B', dark: '#E04343' },
  'C2': { bg: '#2B70C9', dark: '#2460B0' },
};
```

#### shadcn/ui Components
- Custom styled `Card` with colored backgrounds
- `Badge` — level pills
- `Progress` — lesson progress bar
- `Button` — card click navigates to course detail

---

### 5.7 Course Detail (Duolingo-style Path)

**Current:** `app/course/[id]/index.tsx`
**Purpose:** Duolingo-inspired lesson path with zigzag layout, bouncing current node, locked/completed states.

#### Layout Concept

```
    ┌─── Unit 1: Greetings ─────────┐
    │     ████████████ 3/4 complete  │   Unit header with progress bar
    └────────────────────────────────┘

              ★ ← completed (green)
            /
          ✓ ← completed (green)
         /
       ★ ← current (unit color, bouncing, "START!" tooltip)
        \
          🔒 ← locked (gray)
            \
              🔒

    ┌─── Unit 2: Shopping ──────────┐
    │     ░░░░░░░░░░░░ 0/3 complete │
    └────────────────────────────────┘
```

#### Node States
- **Completed**: Green circle (`#58CC02`) with ✓ checkmark
- **Current**: Unit-colored circle with bouncing animation + "START!" tooltip
- **Locked**: Gray circle (`#E5E5E5`) with lock icon

#### Zigzag Pattern
Offset array: `[0, 40, 70, 40, 0, -40, -70, -40]` (pixels, cycling)

#### Icons Cycle
On current/locked nodes, cycle through: Star, FileText, Mic, PenLine icons

#### Bounce Animation
Current node bounces up and down (-8px) with 600ms ease-in-out infinite loop.
Implement with CSS `@keyframes` or Framer Motion.

#### Node Interaction
- Click completed/current → navigate to `/courses/[courseId]/lessons/[lessonId]`
- Click locked → no action (opacity reduced)

#### Unit Headers
- Colored section headers matching unit color cycle
- Show completed/total lesson count with mini progress bar

#### shadcn/ui Components
- Custom CSS/Framer Motion for zigzag path layout
- `Card` — unit headers
- `Progress` — unit progress
- `Badge` — level badge in page header
- `Tooltip` — "START!" on current node
- Custom animated node components

---

### 5.8 Lesson Player (Exercise Session)

**Current:** `app/lesson/[id].tsx`
**Purpose:** Gamified exercise session — the core learning experience.

#### Game Mechanics
- **Hearts system**: Start with 5 hearts, lose 1 per wrong answer. Game over at 0.
- **Combo system**: Consecutive correct answers build combo. Max combo tracked.
- **XP system**: Earn XP per correct answer (modified by combo).
- **Progress bar**: Shows current exercise / total exercises.

#### Layout Structure

```
┌─────────────────────────────────────┐
│ [✕]  ████████░░░░░░ 3/10    ❤️ ❤️ ❤️│  Header: close, progress, hearts
├─────────────────────────────────────┤
│                                     │
│ 📋 Choose the Correct Answer       │  Exercise type badge
│                                     │
│ What does "ubiquitous" mean?        │  Prompt
│                                     │
│ [🔊 Play audio]                    │  Audio button (if audio type)
│                                     │
│ ┌─────────────────────────┐        │  Answer area (varies by type)
│ │ ○ Found everywhere      │        │
│ │ ○ Very rare             │        │
│ │ ○ Beautiful             │        │
│ │ ○ Complex               │        │
│ └─────────────────────────┘        │
│                                     │
│ [💡 Hint]                          │  Hint button (if hints available)
│                                     │
│         [CHECK ANSWER]              │  Submit button
│                                     │
├─────────────────────────────────────┤
│ ✅ Correct! +15 XP  🔥 Combo ×3   │  Result banner (green/red)
│ Explanation: "'Went' is past..."    │
│         [CONTINUE]                  │
└─────────────────────────────────────┘
```

#### Exercise Type UIs

| Type | Student Interaction |
|---|---|
| `multipleChoice` | Tap to select one option from list |
| `listenAndChoose` | Listen to audio, then select from options |
| `tapWhatYouHear` | Listen to audio, select correct transcription |
| `fillInBlank` | Type answer or select from dropdown (if options provided) |
| `listenRepeat` | Listen to audio, record speech, auto-transcribe & compare |
| `speakTheAnswer` | Record speech answer, transcribe & validate |
| `pronunciation` | Listen to target, record attempt, compare |
| `reorderWords` | Drag/tap words from bank into correct order |
| `translateSentence` | Tap words from bank to build translation |
| `matchPairs` | Tap left item, then tap matching right item |
| `completeConversation` | Fill in blanks in a dialogue (type or speak) |
| `roleplay` | Speak each user turn in a conversation |

#### Answer Validation (Client-side)

```typescript
function normalizeText(s: string) {
  return s.toLowerCase().trim().replace(/[.,!?;:'"]/g, '').replace(/\s+/g, ' ');
}
```

All comparisons use normalized text. Specific rules:
- MCQ: selected option text === correct option text
- Fill-in-blank: typed answer === correctAnswer (or selected option)
- Listen/Speak: transcribed text === targetText or correctAnswer
- Reorder: joined words === correct word order
- Match: all pairs matched correctly
- Conversation: user turns match accepted answers (if provided), or non-empty

#### Result Feedback
- **Correct**: Green banner, confetti animation, +XP with combo multiplier, sound effect
- **Wrong**: Red banner, -1 heart, show correct answer, sound effect
- **Explanation**: Shown below result if available
- **Continue** button advances to next exercise

#### Completion Screen (when all exercises done)
- Confetti animation
- Score summary: correct count, XP earned, max combo
- Star rating based on accuracy
- "Continue" button → back to course

#### Game Over Screen (0 hearts)
- "You ran out of hearts!"
- Show progress so far
- "Try Again" button → restart session

#### Lecture Routing
- If lesson type is `lecture` or `mixed`, show lectures first
- "Start Exercises" button after lectures (or auto-advance)
- Lectures link to `/courses/[courseId]/lessons/[lessonId]/lecture/[lectureId]`

#### Audio Features
- Exercise audio playback (prompt audio)
- Speech recording via Web Audio API / MediaRecorder
- Sound effects: correct.mp3, wrong.mp3, lesson-complete.mp3

#### shadcn/ui Components
- `Progress` — exercise progress bar
- `Button` — options, check answer, continue
- `Card` — exercise container
- `Badge` — type indicator, combo, XP
- `Alert` — result feedback banner
- Custom drag-and-drop for word reorder (use `@dnd-kit/core`)
- Custom audio recorder component
- Custom confetti (`canvas-confetti` or `react-confetti`)

---

### 5.9 Lecture Viewer

**Current:** `app/lecture/[id].tsx`
**Purpose:** Display lecture content (text/audio/video) with progress tracking.

#### Content Types

**Text Lecture:**
- Markdown renderer (use `react-markdown` + `remark-gfm`)
- Scroll-based progress tracking (send progress at 10% intervals)
- Auto-complete at 95% scroll

**Audio Lecture:**
- Audio card with icon, title, duration
- Waveform player
- Progress tracked by playback position

**Video Lecture:**
- Embedded video player (use `react-player` or HTML5 `<video>`)
- Progress tracked by playback position

#### Common Features
- Attachments section: list of downloadable files with filename, size, download button
- "Mark as Complete" button (if not auto-completed)
- Completed banner with green checkmark
- Progress bar in header

#### shadcn/ui Components
- `Card` — content container, attachment cards
- `Button` — mark complete, download
- `Progress` — reading/viewing progress
- `Badge` — content type indicator
- `Separator` — between content and attachments

---

## 6. UI/UX Feature Specifications

### Toast Notifications
Replace custom `useToast` with shadcn/ui `Sonner` toast:
- Success: green icon, title + description
- Error: red icon
- Warning: yellow icon

### Confirmation Dialogs
Replace `CustomAlert` with shadcn/ui `AlertDialog`:
- Destructive actions (delete) use red "Delete" button
- Non-destructive use default styling

### Loading States
- Page-level: centered spinner with text
- Button-level: spinner inside button, disabled state
- Skeleton loaders for cards (optional enhancement)

### Empty States
- Custom empty state illustrations with emoji, title, description
- Action button when applicable (e.g., "Create your first course")

### Form Validation
- Use React Hook Form + Zod schemas
- Inline error messages below fields
- Visual validation box with bullet points (like current wizard validation)
- Disabled submit when invalid

### Keyboard Navigation
- Tab through form fields
- Enter to submit
- Escape to close modals

### Responsive Design
- Mobile-first Tailwind classes
- Course cards: 1 column mobile, 2-3 columns desktop
- Exercise wizard: full-screen on mobile, centered dialog on desktop

### Dark Mode Support
- Use shadcn/ui CSS variable theming
- Map current `TG` theme colors to CSS variables

### Theme Color Mapping

```css
:root {
  --accent:           #58CC02;     /* TG.accent — primary green */
  --accent-light:     #58CC0220;   /* TG.accentLight */
  --bg:               #ffffff;     /* TG.bg */
  --bg-secondary:     #f5f5f5;     /* TG.bgSecondary */
  --header-bg:        #1a1a2e;     /* TG.headerBg — dark header */
  --text-primary:     #1a1a1a;     /* TG.textPrimary */
  --text-secondary:   #6b7280;     /* TG.textSecondary */
  --text-hint:        #9ca3af;     /* TG.textHint */
  --separator:        #e5e7eb;     /* TG.separator */
  --red:              #ef4444;     /* TG.red */
  --green:            #22c55e;     /* TG.green / TG.scoreGreen */
  --gold:             #f59e0b;     /* TG.gold */
  --score-orange:     #f97316;     /* TG.scoreOrange */
  --score-red:        #ef4444;     /* TG.scoreRed */
}
```

---

## 7. shadcn/ui Component Mapping

| RN Component/Pattern | shadcn/ui Replacement |
|---|---|
| `TouchableOpacity` | `Button` (variants: default, outline, ghost, destructive) |
| `TextInput` | `Input` / `Textarea` |
| `Modal` | `Dialog` / `Sheet` |
| `Switch` | `Switch` |
| `FlatList` | Native `map()` with virtualization if needed (`@tanstack/react-virtual`) |
| `ScrollView` | `ScrollArea` |
| `ActivityIndicator` | `Loader2` icon with `animate-spin` class |
| `Alert` (custom) | `AlertDialog` |
| Toast (custom) | `Sonner` toast |
| Level selector chips | `ToggleGroup` |
| Tab bar | `Tabs` |
| Markdown editor | `@uiw/react-md-editor` wrapped in shadcn styling |
| Image picker | `<input type="file">` with drag-drop zone |
| Audio player | Custom HTML5 `<audio>` + waveform visualization |
| Confetti | `canvas-confetti` or `react-confetti` |
| Drag reorder | `@dnd-kit/core` + `@dnd-kit/sortable` |

---

## 8. State Management

### Recommended: TanStack Query (React Query)

```typescript
// Course query
const { data: course, isLoading } = useQuery({
  queryKey: ['course', courseId],
  queryFn: () => apiFetchCourse(courseId),
});

// Mutations with cache invalidation
const createUnit = useMutation({
  mutationFn: (data) => apiCreateCourseUnit(data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['course', courseId] });
    toast.success('Unit created');
  },
});
```

### Local State (keep for)
- Form state (React Hook Form)
- Modal open/close
- Wizard step
- Filter/search state
- Selection mode / selected IDs
- Game state (lesson player: hearts, combo, current index)

### Auth State
- Auth token stored in cookie/localStorage
- Auth context provider or Zustand store (keep same `store/auth.tsx` pattern)

---

## 9. File Structure

```
src/
├── app/
│   ├── layout.tsx                          # Root layout with providers
│   ├── (admin)/
│   │   └── admin/
│   │       └── courses/
│   │           ├── page.tsx                # Admin course list
│   │           ├── create/page.tsx         # Create course form
│   │           ├── [id]/
│   │           │   ├── page.tsx            # Course builder
│   │           │   └── edit/page.tsx       # Edit course form
│   │           └── lessons/
│   │               └── [id]/page.tsx       # Lesson builder
│   └── (student)/
│       └── courses/
│           ├── page.tsx                    # Course browser
│           └── [id]/
│               ├── page.tsx                # Course detail (Duolingo path)
│               └── lessons/
│                   └── [id]/
│                       ├── page.tsx        # Lesson player
│                       └── lecture/
│                           └── [lectureId]/page.tsx
├── components/
│   ├── ui/                                 # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── input.tsx
│   │   ├── badge.tsx
│   │   ├── ... (all shadcn components)
│   ├── courses/
│   │   ├── course-card.tsx                 # Reusable course card
│   │   ├── course-form.tsx                 # Shared create/edit form
│   │   ├── unit-card.tsx                   # Unit with lessons list
│   │   ├── unit-modal.tsx                  # Create/edit unit dialog
│   │   ├── lesson-modal.tsx                # Create lesson dialog
│   │   ├── exercise-card.tsx               # Exercise list card
│   │   ├── exercise-wizard.tsx             # 3-step exercise editor
│   │   ├── exercise-preview.tsx            # Full exercise preview
│   │   ├── exercise-type-fields.tsx        # Type-specific form fields
│   │   ├── lecture-card.tsx                # Lecture list card
│   │   ├── lecture-editor.tsx              # Lecture create/edit form
│   │   ├── stats-dashboard.tsx             # Exercise statistics
│   │   ├── filter-bar.tsx                  # Search + filter UI
│   │   ├── quick-templates.tsx             # Template picker sheet
│   │   ├── duolingo-path.tsx               # Zigzag lesson path
│   │   ├── lesson-node.tsx                 # Single path node
│   │   └── tts-generator.tsx               # Audio generation UI
│   ├── player/
│   │   ├── lesson-player.tsx               # Main game controller
│   │   ├── exercise-renderer.tsx           # Renders correct UI per type
│   │   ├── hearts-display.tsx              # Hearts UI
│   │   ├── combo-display.tsx               # Combo counter
│   │   ├── result-banner.tsx               # Correct/wrong feedback
│   │   ├── completion-screen.tsx           # Session complete
│   │   ├── game-over-screen.tsx            # Out of hearts
│   │   ├── word-bank.tsx                   # Drag-drop word bank
│   │   ├── match-pairs.tsx                 # Matching game
│   │   ├── conversation-player.tsx         # Conversation/roleplay
│   │   └── audio-recorder.tsx              # Speech recording
│   ├── lectures/
│   │   ├── lecture-viewer.tsx              # Main lecture component
│   │   ├── markdown-content.tsx            # Text lecture renderer
│   │   ├── audio-player.tsx                # Waveform audio player
│   │   ├── video-player.tsx                # Video player
│   │   └── attachments-list.tsx            # Downloadable files
│   └── shared/
│       ├── markdown-editor.tsx             # Rich markdown editor
│       ├── audio-waveform.tsx              # Waveform visualization
│       └── confetti.tsx                    # Confetti animation
├── lib/
│   ├── api.ts                              # All API functions (typed)
│   ├── types.ts                            # All TypeScript interfaces
│   ├── utils.ts                            # Utility functions
│   ├── validation.ts                       # Zod schemas
│   └── answer-validator.ts                 # Exercise answer checking
├── hooks/
│   ├── use-course.ts                       # Course query hooks
│   ├── use-lesson.ts                       # Lesson query hooks
│   ├── use-audio-recorder.ts               # Web Audio recording
│   └── use-audio-player.ts                 # Audio playback
└── store/
    └── auth.ts                             # Auth state
```

---

## Appendix: Exercise Type Reference

| Type | Emoji | Label | Description | Audio Required |
|---|---|---|---|---|
| `listenRepeat` | 🎧 | Listen & Repeat | Student listens and repeats | Yes |
| `listenAndChoose` | 👂 | Listen & Choose | Listen then pick correct answer | Yes |
| `tapWhatYouHear` | 🔊 | Tap What You Hear | Tap the correct transcription | Yes |
| `speakTheAnswer` | 🎤 | Speak the Answer | Answer by speaking aloud | Yes |
| `pronunciation` | 🗣️ | Pronunciation | Practice correct pronunciation | Yes |
| `roleplay` | 🎭 | Roleplay | Act out a spoken conversation | No |
| `multipleChoice` | 📋 | Multiple Choice | Pick one correct option | No |
| `fillInBlank` | ✏️ | Fill in the Blank | Complete the sentence | No |
| `reorderWords` | 🔀 | Reorder Words | Arrange words in order | No |
| `translateSentence` | 🌐 | Translate Sentence | Translate using word bank | No |
| `matchPairs` | 🔗 | Match Pairs | Match items together | No |
| `completeConversation` | 💬 | Complete Conversation | Fill dialogue gaps | No |

### Difficulty Options

| Value | Label | Color | Emoji |
|---|---|---|---|
| 1 | Easy | `#22c55e` (green) | 🟢 |
| 2 | Medium | `#f97316` (orange) | 🟠 |
| 3 | Hard | `#ef4444` (red) | 🔴 |

### TTS Voices

| Voice | Key |
|---|---|
| Erin | `erin` |
| George | `george` |
| Lisa | `lisa` |
| Emily | `emily` |
| Nick | `nick` |
