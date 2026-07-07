# Add Source File Upload to AI Worksheet Builder

Bring the "Upload source files (PDF/PNG/JPG, max 20MB each)" capability into the Worksheet Builder so the AI grounds generated questions in the uploaded material — matching how it already works in the AI Notemaker and Quiz Maker.

## Approach

Reuse Quiz Maker's client-side extraction pipeline (`pdfjs-dist` for PDF text + rasterizing image-only pages, base64 for PNG/JPG). It's self-contained inside the component and doesn't rely on any storage bucket — files never leave the browser except as `text` + `images[]` in the edge function call. That matches the Notemaker/Quiz Maker behavior exactly and requires no new storage/RLS.

## Frontend — `src/components/teacher/TeacherWorksheetBuilder.tsx`

1. Add state: `files: File[]`, `pastedText: string` (optional, for parity with Quiz Maker), plus a `fileInputRef`.
2. Copy the `extractFromPdf` and `fileToDataUrl` helpers from `TeacherQuizMaker.tsx` (or lift them to a shared util — see Technical notes).
3. Add a new "Upload source files (PDF, PNG, JPG — max 20MB each)" section in the generation form, placed directly above the "Generate Worksheet" button (mirrors Quiz Maker's position at the end of the form). Include:
   - Hidden `<input type="file" multiple accept=".pdf,.png,.jpg,.jpeg">`
   - "Choose files" outlined button with `Upload` icon + `N file(s)` count
   - Same removable `Badge` list of selected file names with the `X` icon
   - Same 20MB / type validation + toast-on-skip behavior
4. Optionally add a "Paste source text (optional)" textarea above it (parity with Quiz Maker). Flag: include only if the user wants full parity; otherwise stick to files only.
5. In `handleGenerate`, before invoking `generate-worksheet`:
   - Loop through `files`, run `extractFromPdf` on PDFs and `fileToDataUrl` on images
   - Concatenate extracted text; collect image data URLs
   - Pass `text` and `images` fields in the invoke body alongside existing fields

## Backend — `supabase/functions/generate-worksheet/index.ts`

1. Accept new optional fields `text?: string` and `images?: string[]` in the request body.
2. Build a multimodal `user` message the same way `generate-quiz` does:
   - Text block includes existing worksheet spec + any pasted/extracted `text`
   - Append `{ type: "image_url", image_url: { url } }` blocks for each image data URL
3. Extend the system prompt (small addition, not a rewrite) instructing the model to ground questions in the supplied source material when present, paraphrasing rather than copying — same rule Quiz Maker enforces.
4. Keep everything else (schema, question types, diagrams, part-questions, difficulty, error handling for 429/402) unchanged.

No other Worksheet Builder behavior changes (question types, difficulty, PDF export, preview all stay identical).

## Technical notes

- No new tables, buckets, RLS, or edge functions — additive only.
- `extractFromPdf` is duplicated inline in Quiz Maker today. Cleanest option is to lift it into `src/lib/extractSource.ts` and import from both components; acceptable alternative is to duplicate it in Worksheet Builder to keep this change surgical. Recommend lifting to a shared util.
- Model call remains `openai/gpt-5-mini` via Lovable AI gateway; multimodal input follows the existing Quiz Maker pattern.
- Existing Notemaker and Quiz Maker upload flows are untouched.

## Build summary will confirm

1. Shared client-side pipeline reused (extracted into `src/lib/extractSource.ts`, imported by both).
2. Upload UI inserted at the bottom of the Worksheet Builder generation form, just above "Generate Worksheet".
3. Extracted text + image data URLs are passed as `text` and `images` in the `generate-worksheet` invoke body; the edge function forwards them as a multimodal user message so questions are grounded in the source material.
