# Fix: worksheet questions print as "undefined"

## What is happening

The worksheet generated fine — titles, instructions, marks and numbering are all correct. Only the question text is missing, printing as `undefined`.

The generation request asks the model for JSON but does not enforce a strict schema (`supabase/functions/_shared/nim.ts` only sets `response_format: json_object`). The app reads each question's text from a field named `prompt`. When the model returns the text under a different name — `question`, `text`, `statement`, `question_text` — nothing populates `prompt`, and every render path (`q.prompt` in the preview and in the PDF writer at line 560) prints `undefined`.

## The fix

1. Normalise question fields on the server. In `normalizeQuestion` (`supabase/functions/generate-worksheet/index.ts`), accept the common aliases and map the first non-empty one into `prompt`: `question`, `question_text`, `text`, `statement`, `body`. Do the same for question parts (`parts[].prompt`) and for options/answer aliases.
2. Drop empty questions. If a question still has no usable text after normalisation, exclude it rather than emitting a numbered blank, and renumber the survivors so the sheet stays sequential.
3. Tighten the prompt. Restate in the system prompt that each question object must use the exact key `prompt` for the question text, with a short example object.
4. Client-side safety net. In `TeacherWorksheetBuilder.tsx`, never render a bare `undefined` — fall back to an empty string in the preview and skip the line in the PDF writer, so a bad response can never print `undefined` on a student worksheet.
5. Redeploy `generate-worksheet` and run a real 10-question generation to confirm the question text appears in both preview and exported PDF.

## Technical details

- `supabase/functions/generate-worksheet/index.ts`: extend `normalizeQuestion` with alias resolution and part-level normalisation; filter empty-prompt questions inside `normalizeWorksheet` before renumbering.
- `supabase/functions/_shared/nim.ts`: unchanged.
- `src/components/teacher/TeacherWorksheetBuilder.tsx`: guard `q.prompt` / `p.prompt` at the render and PDF-write sites.

No layout, styling or workflow changes.
