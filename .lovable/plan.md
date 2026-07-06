## Live Quiz-Taking Experience

Rework the student quiz flow into a one-question-at-a-time, server-timed experience. Teacher creation/editing, quiz tables, and RLS stay untouched.

CONTEXT:

Currently the student-facing quiz screen likely renders all questions at once. Replace this with a server-driven, one-question-at-a-time interface where the server is the source of truth for timing (never trust client-reported durations), and students can freely revisit and change any answered question before final submission.

### 1. Database migration (quiz_attempts)

Add columns:

- `status` text default `'in_progress'` (check: in_progress | submitted | expired)
- `furthest_question_index` int default 0
- `active_question_index` int default 0
- `started_at` timestamptz default now()
- `question_started_at` timestamptz default now()
- `total_time_spent_seconds` int default 0
- Make `submitted_at`, `score`, `total`, `results` nullable (they are only set on submission)

`answers` jsonb shape becomes: `{ [question_id]: { selected_option: "A"|..|null, time_spent_seconds: int } }`.

Add partial unique index to prevent duplicate in-progress attempts per assignment:
`CREATE UNIQUE INDEX ... ON quiz_attempts(quiz_assignment_id) WHERE status='in_progress';`

Existing rows (all already submitted) get backfilled with `status='submitted'`.

### 2. Edge functions

Replace/add functions (all `verify_jwt=false`, validate JWT in-code like existing ones):

`**start-quiz-attempt**` — body `{ quiz_assignment_id }`

- Auth + assignment ownership check
- If `status='in_progress'` attempt exists → resume (return it as-is)
- Else enforce max_attempts on submitted attempts, insert new attempt (attempt_number = submitted count + 1, active/furthest = 0, timestamps = now)
- Return: quiz meta, questions list (id, number, topic — no options/answers), active question full payload (options, no correct_option), previously selected option for it, `time_remaining_seconds` (null if untimed), `answers_summary` `{ question_id: selected_option }` for the nav grid

`**go-to-question**` — body `{ attempt_id, target_index }`

- Load attempt, guard status='in_progress', target_index in range
- Accumulate elapsed = now - question_started_at into `answers[current_qid].time_spent_seconds` (create entry if missing)
- Set `active_question_index=target_index`, bump `furthest_question_index`, reset `question_started_at=now()`
- Auto-expire if `time_remaining <= 0`: call submit path instead
- Return target question payload + previously selected + time_remaining

`**save-answer**` — body `{ attempt_id, question_id, selected_option }`

- Merge into `answers[question_id].selected_option`; preserve existing `time_spent_seconds`
- No index change, no timer reset
- Return `{ ok: true, time_remaining_seconds }`

`**submit-quiz**` — body `{ attempt_id }` (replaces existing)

- Accumulate elapsed onto currently-active question
- Sum all `time_spent_seconds` → `total_time_spent_seconds`
- Load correct answers, score, build results (question, options, selected, correct_option, is_correct, explanation, time_spent_seconds)
- Set `status='submitted'`, `submitted_at`, `score`, `total`, `results`
- Notify teacher (existing behavior)
- Return `{ score, total, total_time_spent_seconds, results, attempt_number }`

`**get-quiz-for-student**` — remove or leave dormant (student flow now uses start-quiz-attempt).

All timing is derived from `started_at`, `question_started_at`, and server `now()` — client-sent durations are ignored.

Register the four functions in `supabase/config.toml`.

### 3. Frontend — `src/components/student/StudentQuizzes.tsx`

Rewrite the taking flow:

- On "Start": call `start-quiz-attempt`, store `attempt`, `questions` list, current question payload, `answers_summary`, `serverTimeRemaining`, `serverSyncedAt`
- **Countdown** (only if time limit): derive `displayedRemaining = serverTimeRemaining - (Date.now()-serverSyncedAt)/1000`; tick every second; reconcile on every server response; auto-submit at 0
- **Stopwatch** (always): seed with stored `time_spent_seconds` for the active question from `answers_summary_full` (extend response to include per-q accumulated seconds), tick up locally while active
- **Navigation grid**: N numbered buttons; state = answered (filled), unanswered (outline), active (ring). Click → `go-to-question`
- **Prev / Next** buttons wired to `go-to-question(index±1)`
- **Options**: radio; on change → local state update + debounced `save-answer` (~400ms) + immediate update of `answers_summary`
- **Submit Quiz** button in persistent footer; if any unanswered, show AlertDialog "X questions unanswered — submit anyway?"
- On submit → results screen using returned `results` + `total_time_spent_seconds`

Per-question time on results: show `mm:ss` beside each question. Show total time prominently at top.

Resume-on-refresh: `startQuiz` idempotently reuses in_progress attempt, reopens at `active_question_index`.

### 4. Teacher reporting

In whichever teacher view lists a student's attempts (locate via ripgrep on `quiz_attempts`), add:

- Per-question `time_spent_seconds` column (formatted mm:ss) rendered from `results[i].time_spent_seconds`
- Total time spent row/badge from `total_time_spent_seconds`

No changes to teacher quiz authoring, publishing, or assignment.

### Out of scope

Quiz/question/assignment schemas, RLS, generate-quiz, teacher creation UI — untouched.

### Technical notes

- Concurrency: use single-row updates keyed by `id` + `status='in_progress'` guard to avoid double-submits.
- Backward compatibility: existing submitted attempts render fine because new columns are nullable/defaulted; `results` entries without `time_spent_seconds` fall back to "—".
- All new columns get grants via existing table grants (no new table, so no GRANT block needed — RLS policies already cover student self-access).