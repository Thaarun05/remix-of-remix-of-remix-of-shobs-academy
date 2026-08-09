# Worksheet Builder: manual question count + answer key toggle

## 1. Manual question count

Replace the fixed 10 / 25 / 50 dropdown with a free number input.

- In `TeacherWorksheetBuilder.tsx`, swap the `Select` for a numeric `Input` (default 10), with a helper line: "Larger sheets take longer to generate."
- Validate on submit: whole number between 1 and 50. Out-of-range values show an inline toast and block generation.
- Server-side: `generate-worksheet` stops snapping the count to 10/25/50 and instead clamps to 1-50, using the exact number the teacher typed.
- The existing truncation retry stays: if a large sheet runs out of response room, it retries at roughly half the count and returns a warning.

## 2. Answer key toggle

Add an "Answer key" switch in the form, next to the question count.

- Default: On.
- When On, behaviour is as today: the model returns teacher answers/workings, and both "Download Student PDF" and "Download Answer Key PDF" are available.
- When Off, the request tells the model to omit answers and workings, the preview hides answer/working fields, and the "Download Answer Key PDF" button is hidden — only the student PDF is offered.
- The toggle can also be flipped after generation to hide/show the answer key section without regenerating (it only hides what exists; turning it on after an answers-off generation offers a regenerate hint rather than inventing answers).

## Technical details

- `src/components/teacher/TeacherWorksheetBuilder.tsx`: numeric count input + validation, `includeAnswerKey` state wired into the generate payload, preview answer blocks, and the answer-key download button visibility.
- `supabase/functions/generate-worksheet/index.ts`: accept an arbitrary count clamped 1-50, accept an `include_answers` flag and adjust the user prompt so answers/working are omitted when false.
- Redeploy `generate-worksheet` after the change.
