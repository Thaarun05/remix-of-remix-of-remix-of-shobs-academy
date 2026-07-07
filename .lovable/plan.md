# Worksheet Builder v2 — Edit Loop, Answer Key, Real Diagrams

Scoped to Worksheet Builder only. Notemaker, Quiz Maker, and the shared `src/lib/extractSource.ts` are untouched.

## Part A — Foundation & Edit Loop

### A1. Auth hardening on `generate-worksheet`
- `supabase/config.toml`: change `[functions.generate-worksheet]` to `verify_jwt = true`.
- In `supabase/functions/generate-worksheet/index.ts`:
  - Read `Authorization: Bearer <jwt>`.
  - Build a Supabase client with anon key + the caller's Authorization header.
  - `getClaims(token)` to get `sub`; then check role using the existing `public.has_role(user_id, 'teacher')` RPC.
  - Non-teacher → 403 JSON `{ error: "Only teachers can generate worksheets." }`.
- Client (`TeacherWorksheetBuilder.tsx`) already invokes via `supabase.functions.invoke`, which forwards the JWT automatically. No client change beyond surfacing the 403 toast.

### A2. Schema v2 (additive — no breaking field renames)
Every question object gains:
- `marks: number` (already present for some — make it consistently required)
- `difficulty: "easy" | "medium" | "hard"`
- `blooms_level: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create"`
- `rubric?: string` (optional short marking guidance)

Top-level worksheet gains:
- `metadata: { topic_tags: string[], estimated_minutes: number }`

All existing fields (`number`, `type`, `prompt`, `options`, `parts`, `answer`, `working`, `diagram`) remain exactly as today. System prompt + JSON schema in the edge function extended to require the new fields.

### A3. Per-question edit loop in the preview
In `TeacherWorksheetBuilder.tsx` question cards, add a per-card toolbar:
- **Edit** — toggles inline editable fields (prompt textarea; option inputs for MCQ; answer / working textareas; parts editor for `part_question`). Saves back into local `worksheet.questions[i]`.
- **Regenerate** — calls `generate-worksheet` with a new `mode: "regenerate_question"` body (see below); replaces only that question on success.
- **Delete** — removes the question and renumbers `number` sequentially.
- **Drag to reorder** — use `@dnd-kit/core` + `@dnd-kit/sortable` (add as deps). On drop, reorder and renumber. Renumbering must not mutate any other field.

Regenerate-question mode in the same edge function:
- Request body switches on `mode`:
  - default (`"full"` or missing) → current behavior.
  - `"regenerate_question"` → payload includes `worksheet_title`, `subject`, `grade`, `topic`, `difficulty`, `allowed_types`, `other_questions_summary` (array of `{ number, type, prompt }`), `target_number`, `original_source_excerpt` (pasted text + any previously extracted text — not re-uploading images), and optional `instructions`.
  - Returns `{ question: <single question object in schema v2> }`.
- The single-question call uses a shorter system prompt that reuses the same schema rules but instructs the model to return one question only, avoid duplicating any of the other prompts, and match the requested `type` when provided.

Rule: editing or regenerating one card only mutates `worksheet.questions[i]`. React state updates use functional setters and shallow-copy arrays so untouched questions keep referential identity.

### A4. Teacher Answer-Key PDF
- Extend `handleDownloadPDF(includeAnswers: boolean)` in `TeacherWorksheetBuilder.tsx`.
- Two buttons above the preview: **Download Student PDF** (`includeAnswers=false`) and **Download Answer Key PDF** (`includeAnswers=true`).
- Same layout, branding, header, student-info row, footer, page-break logic.
- When `includeAnswers`:
  - Under each question, print `Answer:`, `Working:` (multi-line, page-break aware), and `Rubric:` when present.
  - Filename: `shobs-academy-{slug}-answer-key.pdf`.
- Preview stays student-view; answer key exists only in the PDF.

## Part B — Real Diagrams (spec-driven, SVG-first)

### B1. Diagram Spec Language (DSL)
Question schema's `diagram` becomes `{ kind, spec, caption }` with three kinds in this pass:

- `geometry_2d`
  - `spec: { vertices: [{id, x, y, label?}], edges: [{from, to, length_label?}], angles: [{at_vertex, from, to, label?, mark?: "arc" | "right"}], circles?: [{center:{x,y}, radius, label?}], bearings?: [{from, to, degrees}], units?: "cm"|"m"|"" }`
- `coordinate_graph`
  - `spec: { x_range:[min,max], y_range:[min,max], x_step, y_step, grid:boolean, functions?: [{ expr, domain?:[a,b], label? }], points?: [{x,y,label?}], segments?: [{from:{x,y}, to:{x,y}, label?}] }`
  - `expr` is a plain math expression in `x` (e.g. `2*x+1`, `x^2-3`). Evaluated safely (see B3).
- `number_line`
  - `spec: { range:[min,max], step, ticks?: number[], points?: [{value, label?, filled?:boolean}], intervals?: [{from, to, open_from?:boolean, open_to?:boolean, label?}] }`

Each kind has a strict Zod schema in `src/lib/diagrams/schemas.ts`. Parsing failure = "spec invalid".

### B2. Two-pass generation
- **Pass A** — existing worksheet generation. For any figure question, the model outputs `diagram: { kind, description }` only. Coordinates/lengths are NOT requested here.
- **Pass B** — new edge function `generate-diagram-spec` (small, focused). Input: `{ kind, description, question_prompt }`. Output: strict DSL JSON validated against the Zod schema on the client after return. Uses `openai/gpt-5-mini` with a tight per-kind system prompt and `response_format: json_object`. `verify_jwt = true`, teacher-role check.
- Client orchestration in `TeacherWorksheetBuilder.tsx`:
  1. Call `generate-worksheet` as today.
  2. Walk `questions`; for each with a Pass-A `diagram`, call `generate-diagram-spec`. Run these in parallel with a small concurrency cap (e.g. 4).
  3. Validate returned spec with Zod. On failure, retry once. On second failure, replace the diagram with `{ kind, spec: null, caption, error: "diagram could not be generated" }` — preview shows an inline warning card, the rest of the worksheet renders normally.
- Regenerate-question flow re-runs Pass B for that one question's diagram if present.

### B3. SVG renderers (replace html2canvas-first flow)
New folder `src/components/teacher/worksheet/diagrams/`:
- `Geometry2D.tsx`, `CoordinateGraph.tsx`, `NumberLine.tsx` — pure React SVG, driven only by validated spec.
- `DiagramRenderer.tsx` — switches on `kind`, renders the matching component, or the "could not be generated" fallback card.
- Sizing: fixed viewBox per kind (e.g. 480×320), `preserveAspectRatio="xMidYMid meet"`, wrapper max-width so it never exceeds the worksheet column.
- `CoordinateGraph` uses a tiny safe expression evaluator: whitelist `+ - * / ^ ( )`, `x`, and functions `sin cos tan sqrt abs log ln exp`. Parse with a minimal shunting-yard or `mathjs` (add dep) restricted to `evaluate` on `{x}`. No `eval`, no `new Function`.
- Preview renders these components directly (no html2canvas for the three implemented kinds).

PDF export:
- Add `svg2pdf.js` (works with jsPDF) to embed SVG as vector into the existing jsPDF document — keeps text crisp, respects A4 margins, page-break aware.
- If `svg2pdf` fails for a given node, fall back to rasterizing that single SVG at 2× DPR via `html2canvas` and embed as PNG.
- `html2canvas` remains only as a last-resort fallback and only for `diagram.kind` values not yet implemented (none in this pass, but the code path stays for future kinds).
- Margin guard: compute available width from current jsPDF margins; scale SVG width to fit; if height would overflow the page, insert a page break before drawing.

## Scope guardrails (enforced by this plan)
- No changes to `TeacherAiNotetaker.tsx`, `TeacherQuizMaker.tsx`, `generate-notes`, `generate-quiz`, or `src/lib/extractSource.ts`.
- No worksheet persistence, no student assignment, no template library.
- No bar/line/pie charts. No KaTeX. Those are explicitly deferred.

## File-level change list
- `supabase/config.toml` — flip `generate-worksheet` to `verify_jwt = true`; add `[functions.generate-diagram-spec]` with `verify_jwt = true`.
- `supabase/functions/generate-worksheet/index.ts` — teacher-role check; schema v2; `mode: "regenerate_question"` branch.
- `supabase/functions/generate-diagram-spec/index.ts` — new, per-kind tight prompts, strict JSON.
- `src/lib/diagrams/schemas.ts` — Zod schemas for the 3 kinds + shared types.
- `src/lib/diagrams/mathExpr.ts` — safe expression evaluator for `coordinate_graph`.
- `src/components/teacher/worksheet/diagrams/` — `Geometry2D.tsx`, `CoordinateGraph.tsx`, `NumberLine.tsx`, `DiagramRenderer.tsx`.
- `src/components/teacher/TeacherWorksheetBuilder.tsx` — per-question edit/regenerate/delete/reorder toolbar; two PDF buttons; Pass-B orchestration; use `DiagramRenderer` in preview; `svg2pdf`-first export.
- `package.json` — add `@dnd-kit/core`, `@dnd-kit/sortable`, `svg2pdf.js`, `mathjs` (or a minimal parser).

## Open questions before build
1. For "drag to reorder", is a keyboard-accessible handle enough, or do you also want up/down arrow buttons on each card as a fallback?
2. For the answer-key PDF, should MCQ answers be shown as just the letter (e.g. `Answer: B`), the full option text, or both?
