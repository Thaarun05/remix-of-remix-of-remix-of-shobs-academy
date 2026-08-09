# Worksheet Builder: single-shot generation, fixed count options, and "undefined" fix

## 1. Question text prints as "undefined"

The last worksheet generated fine — title, instructions, marks and numbering all correct — but every question body printed as `undefined`.

The generation request asks for JSON but does not enforce a strict schema (`supabase/functions/_shared/nim.ts` only sets `response_format: json_object`). The app reads question text from a field named `prompt`. When the model returns it under a different name — `question`, `text`, `statement`, `question_text` — nothing fills `prompt`, so both the preview and the PDF writer print `undefined`.

Fix:
- Normalise aliases server-side in `normalizeQuestion`: map the first non-empty of `prompt`, `question`, `question_text`, `text`, `statement`, `body` into `prompt`. Same for `parts[].prompt`.
- Drop any question that still has no text after normalisation, then renumber so the sheet stays sequential.
- Restate in the system prompt that the exact key `prompt` must be used, with a one-object example.
- Client safety net: never render a bare `undefined` — fall back to empty string in the preview and skip the line in the PDF writer.

## 2. Remove batching — generate the whole worksheet in one call

Batching (10 questions per call, 2 concurrent, merge) is removed. `generate-worksheet` goes back to a single model call for the full requested count, as it worked before.

- Delete the batched path, the `BATCH_SIZE` plan/worker logic and the batch wording in the user prompt from `supabase/functions/generate-worksheet/index.ts`.
- Keep one single-shot generation for any count, with the existing truncation retry as the only fallback.
- Raise `max_tokens` for the single call so a 50-question sheet fits, since the whole worksheet now comes back in one response.
- Remove the "Batch 1 of 5"-style title suffix and the batch progress messaging in `TeacherWorksheetBuilder.tsx`.

## 3. Question count becomes a 10 / 25 / 50 choice

Replace the free-text number input with three fixed options.

- In `TeacherWorksheetBuilder.tsx`, swap the numeric `Input` for a select (or three toggle buttons) offering **10**, **25**, **50**, defaulting to 10.
- Remove the 1–60 range validation, which no longer applies.
- Server clamps the accepted count to those three values.

## Technical details

- `supabase/functions/generate-worksheet/index.ts`: alias normalisation, empty-question filtering, batching removed, single-shot call with a larger token budget.
- `src/components/teacher/TeacherWorksheetBuilder.tsx`: count selector, batch UI copy removed, `prompt` render guards.
- Redeploy `generate-worksheet` and verify with a real 50-question run that question text appears in preview and PDF.

Note: one 50-question response is a large single output. If it truncates, the existing retry produces a shorter sheet with a warning rather than failing.
