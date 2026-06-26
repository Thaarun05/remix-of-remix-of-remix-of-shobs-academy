# Interactive Auto-Graded Quizzes (multi-attempt)

End-to-end MCQ quiz feature: teachers author quizzes (AI-generated from topics + uploads, then editable), publish & assign to students with per-assignment max-attempts (blank = unlimited) and optional time limit, students take in-app with server-side auto-grading, teachers see per-student attempt history.

## Part A — Database migration

New migration `supabase/migrations/<ts>_quiz_interactive.sql` as drafted in chat:

- `public.quizzes` — teacher-owned metadata incl. `time_limit_minutes`, soft-delete, `update_updated_at_column` trigger. RLS: teacher own (`has_role 'teacher'`); admin ALL; student SELECT only if linked via `quiz_assignments` and `deleted_at IS NULL`.
- `public.quiz_questions` — holds `correct_option` + `explanation`. RLS: teacher manages rows for own quizzes; admin ALL. **No student policy** — answers never reach client; edge functions read via service role.
- `public.quiz_assignments` — grant row per (quiz, student). `max_attempts INT NULL` (NULL = unlimited), `assigned_at`, `deleted_at`, **UNIQUE(quiz_id, student_user_id)**. RLS: teacher own; admin ALL; student SELECT own. No score/status columns (derived from attempts).
- `public.quiz_attempts` — one row per submission. `attempt_number`, `answers`, `results`, `score`, `total`, `submitted_at`, UNIQUE(assignment_id, attempt_number). RLS: student SELECT own; teacher SELECT for own assignments; admin ALL. **No INSERT/UPDATE policy** — service role only, so scores cannot be forged.

GRANTs on all four tables to `authenticated` + `service_role` (no anon). Note: anon exclusion is actually enforced by RLS having no anon policies — the explicit GRANTs are cleaner but slightly diverge from the existing notes/assignments migrations (which rely on default privileges). Effectively safe either way.

## Part B — Edge functions (Deno, `verify_jwt = false`, in-function `auth.getUser()`)

All three mirror `generate-notes` (CORS, 429/402 handling). Add each to `supabase/config.toml`.

1. **generate-quiz** — Lovable AI Gateway (`openai/gpt-5-mini`, `response_format: json_object`, multimodal `image_url`). Body: `{ subject, grade, topics, count, difficulty, text, images, instructions }`. Returns `{ quiz: { title, subject, grade, instructions, questions:[{number, topic, difficulty, question, options[4], correct_option, explanation}] } }`.
2. **get-quiz-for-student** — Body `{ quiz_assignment_id }`. Verify caller owns assignment. Count `quiz_attempts`; reject if `max_attempts` set and count ≥ max. Service-role-load quiz + questions, return STUDENT-SAFE payload (no `correct_option`/`explanation`), include `time_limit_minutes`.
3. **submit-quiz** — Body `{ quiz_assignment_id, answers }`. Verify ownership. `attempt_number = existing + 1`; reject if cap reached. Service-role-load questions, compute `score`/`total`/per-question `results`, INSERT `quiz_attempts`. Insert teacher notification (`type: 'quiz_completed'`, body includes attempt #). Return `{ score, total, results, attempt_number }`.

## Part C — Teacher authoring

- `src/components/teacher/TeacherQuizMaker.tsx` + `src/components/teacher/tabs/QuizMakerTab.tsx` (lazy-loaded, wired in `TeacherDashboard.tsx` + sidebar entry `{ id: "quiz-maker", label: "Quiz Maker", icon: ListChecks }`).
- **Add `quiz-maker` to the "Select Student" card exclusion** in `TeacherDashboard.tsx` (~line 865) — it has its own multi-student selector, so the top card is redundant. Condition becomes `&& activeTab !== "quiz-maker"`.
- Cloned from `TeacherAiNotetaker.tsx`: Subject/Grade/Topics/Count/Difficulty/Instructions inputs, paste text, upload PDF/PNG/JPG via existing `pdfjs-dist@6.0.227` `extractFromPdf` + `fileToDataUrl` helpers (no new deps, no Vite config touch).
- Call `generate-quiz`, render editable question list (text, 4 options, correct A–D selector, explanation, add/remove).
- **Publish**: insert `quizzes` (status `'published'`, include `time_limit_minutes` from form) then bulk-insert `quiz_questions`, using `(supabase as any).from(...)`.
- **Assign**: multi-select of teacher's students (same dual query as Notetaker: `student_profiles.assigned_teacher_id` + `student_teacher_assignments`). Inputs:
  - Students (multi)
  - **Time limit (minutes, blank = none)** — written to `quizzes.time_limit_minutes` at publish (or here if assigning a draft); without this the Part D countdown never fires.
  - Max attempts (blank = unlimited)
  - Use `.upsert(rows, { onConflict: 'quiz_id,student_user_id', ignoreDuplicates: false })` so re-assigning the same quiz to a student doesn't error on the UNIQUE constraint — it updates `max_attempts`/`teacher_user_id`/clears `deleted_at`. Insert one `notifications` row per newly assigned student (skip notification when row already existed and nothing changed).
- **Results view** (second card in same tab): list teacher's quizzes; per quiz show assignments grouped by student with all `quiz_attempts` (attempt #, score/total, date) and best score.
- Keep optional "Save to Resources" / printable PDF as bonus.

## Part D — Student taking

- `src/components/student/StudentQuizzes.tsx`. Sidebar entry `{ id: "quizzes", label: "Quizzes", icon: ListChecks }` in `studentSidebarItems`; render `{activeTab === "quizzes" && <StudentQuizzes />}` in `StudentDashboard.tsx`.
- List: `(supabase as any).from("quiz_assignments").select(..., quizzes(title,subject,grade,time_limit_minutes), quiz_attempts(score,total,attempt_number,submitted_at)).eq("student_user_id", user.id).is("deleted_at", null)`.
- Per row: attempts used / max, best score, Start/Retake enabled while attempts remain, per-attempt history Review (renders stored `results` jsonb).
- Taking view: invoke `get-quiz-for-student`, render radio groups (existing `radio-group`). If `time_limit_minutes` set, countdown auto-submits on expiry. Submit invokes `submit-quiz`; results screen colors each question correct/incorrect with explanation.
- Toasts + `Loader2` + `EmptyState` consistent with the rest of the student dashboard.

## Constraints

- Answers/explanations never sent pre-submit. No student SELECT on `quiz_questions`. No student/teacher INSERT/UPDATE on `quiz_attempts`.
- Edge functions auth via Authorization header; service role for privileged reads/writes.
- Reuse `has_role`, `update_updated_at_column`, existing `notifications` schema, soft-delete via `deleted_at`, `(supabase as any)` casts.
- No new npm deps; `pdfjs-dist` stays at `6.0.227`.

## Out of scope

Question banks, proctoring beyond countdown, per-question media, retake-policy UI beyond `max_attempts`.

## Files touched

- New: migration; `supabase/functions/generate-quiz/index.ts`, `get-quiz-for-student/index.ts`, `submit-quiz/index.ts`; `src/components/teacher/TeacherQuizMaker.tsx`; `src/components/teacher/tabs/QuizMakerTab.tsx`; `src/components/student/StudentQuizzes.tsx`.
- Edit: `supabase/config.toml` (3 function blocks); `src/components/dashboard/DashboardSidebar.tsx` (teacher + student items); `src/pages/TeacherDashboard.tsx` (lazy import, render block, exclude `quiz-maker` from Select Student card); `src/pages/StudentDashboard.tsx`.
