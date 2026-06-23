## What gets built

A new **AI Notetaker** tab in the Teacher Dashboard. Teachers paste/type lecture content, optionally upload PDFs and images, click Generate, get a branded Shobs Academy notes preview they can edit via normal form controls, then either download as PDF, save to the shared Resources library (staging — teacher/admin-only), or assign the PDF to a specific student (delivery — appears in StudentNotes).

## Pre-flight check (do first, before any UI work)

Before building the UI, verify the unverified assumption: send a one-off test request via `supabase--curl_edge_functions` to a tiny throwaway version of `generate-notes` that posts a multimodal payload (one text block + one tiny `image_url` data URL) to `https://ai.gateway.lovable.dev/v1/chat/completions` with `openai/gpt-5-mini`. If the gateway rejects image blocks for that model, fall back to text-only (PDF text extraction + OCR-via-rasterise dropped) or switch model — surface this choice to the user before continuing.

## Files to add

1. **`supabase/functions/generate-notes/index.ts`** — mirrors `generate-worksheet/index.ts`.
   - Full endpoint: `https://ai.gateway.lovable.dev/v1/chat/completions`.
   - Same CORS, `LOVABLE_API_KEY` header, model `openai/gpt-5-mini`, `response_format: { type: "json_object" }`, same 429/402/500 handling.
   - Request body: `{ subject, grade, topic, text, images: string[], instructions }`.
   - User message `content` is an array: one `{ type: "text", text: ... }` block with metadata + pasted/extracted text + teacher instructions, then one `{ type: "image_url", image_url: { url: dataUrl } }` block per supplied image.
   - System prompt instructs the model to produce concise, original study notes in this JSON schema:
     ```
     { title, subject, grade,
       summary,
       sections: [{ heading, bullets: string[], key_terms: [{term, definition}], formulas?: string[] }],
       quick_revision: string[] }
     ```
   - Returns `{ notes: parsed }`.

2. **`supabase/config.toml`** — add `[functions.generate-notes]` with `verify_jwt = false`.

3. **`src/components/teacher/TeacherAiNotetaker.tsx`** — new component, structured like `TeacherWorksheetBuilder.tsx`.
   - Form fields: Subject, Grade, Topic, Instructions (textarea), Pasted lecture text (textarea), File upload (`.pdf,.png,.jpg,.jpeg`, multiple, max 20MB/file).
   - Client-side file handling before invoking the function:
     - Images → read as base64 data URL, push into `images`.
     - PDFs → use `pdfjs-dist` to extract text from each page; if a page yields almost no text (likely scanned), render it to a canvas and push that PNG data URL into `images`.
     - `pdfjs-dist` worker loaded as the ESM `.mjs` build with `import.meta.url` or a version-pinned CDN URL that exactly matches the installed package version.
   - Amber warning banner like the worksheet builder (don't switch tabs, ~30s).
   - Generate button calls `supabase.functions.invoke("generate-notes", { body: {...} })` and stores the parsed `notes` object in React state.
   - **Editable preview via controlled inputs**, not contentEditable:
     - Title, summary → `<Input>` / `<Textarea>` bound to state.
     - Each section heading, bullet, key term, definition, formula, quick-revision item → controlled `<Input>` / `<Textarea>` bound to its slot in the notes-state object via small handler helpers (update by section index / bullet index).
     - Buttons to add/remove bullets, key terms, sections, quick-revision items.
   - **Separate read-only branded doc** rendered from the same state into a hidden/off-screen `docRef` div (Shobs logo + "SHOBS ACADEMY" header, title, subject/grade line, sections, summary, quick revision list, footer with date) using the same `.worksheet-doc` styling pattern. This div is the only thing html2canvas captures, so we never have to read DOM back into state.
   - Action buttons (visible once notes exist): **Download PDF**, **Save to Resources**, **Assign to Student** (Select of assigned students from `student_teacher_assignments` + `assigned_teacher_id`, same query as `TeacherNotes`), **Regenerate**.
   - PDF export uses jsPDF + html2canvas on `docRef`, identical paging logic to the worksheet builder. `pdf.save(...)` for download. For Save/Assign we additionally call `pdf.output("blob")` (net-new vs the worksheet builder — valid jsPDF, just not currently used elsewhere) to get a `Blob` to upload.

4. **`src/components/teacher/tabs/AiNotetakerTab.tsx`** — one-liner wrapper:
   ```ts
   import { TeacherAiNotetaker } from "@/components/teacher/TeacherAiNotetaker";
   export default function AiNotetakerTab() { return <TeacherAiNotetaker />; }
   ```

## Files to edit

1. **`src/components/dashboard/DashboardSidebar.tsx`** — add `{ id: "ai-notetaker", label: "AI Notetaker", icon: Sparkles }` to `teacherSidebarItems` (right after Worksheet Builder).

2. **`src/pages/TeacherDashboard.tsx`**
   - Add `const AiNotetakerTab = lazy(() => import("@/components/teacher/tabs/AiNotetakerTab"));`
   - Add the `activeTab === "ai-notetaker"` branch in the existing render switch, wrapped in `<Suspense>` matching the WorksheetBuilderTab branch.

## Save / Assign behaviour (re-uses existing patterns)

**Save to Resources** — staging only, visible to teachers/admins, NOT to students. Mirrors `TeacherResources.handleUpload`:
- Build PDF as `Blob` via `pdf.output("blob")`.
- Upload to `teacher-resources` bucket at `${user.id}/${timestamp}_${safeTitle}.pdf`.
- Insert into `teacher_resources` with `title`, `subject`, `file_name`, `file_type: "application/pdf"`, `file_size`, `storage_path`, `uploaded_by: user.id`.

**Assign to Student** — delivery; this is what makes the note appear in `StudentNotes`. Mirrors `TeacherNotes.handleUpload`:
- Upload the same PDF blob to `note-files` bucket at `${user.id}/${timestamp}_${safeTitle}.pdf`.
- Insert into `notes` with `teacher_user_id`, `student_user_id`, `title`, `subject`, `grade`, `file_name`, `file_type: "application/pdf"`, `storage_path`, `file_size`.
- Insert a `notifications` row matching the existing `note_uploaded` format (`recipient_id`, `sender_id`, `role_target: "student"`, `entity_table: "notes"`, title/body).
- Caveat (inherited, not new): `StudentNotes` returns early if the student has no `assigned_teacher_id`. Normal students have one set; if not, they won't see the note. Don't fix here.

All file opens use 1h signed URLs like the existing components. No new tables, no schema changes — `notes`, `teacher_resources`, `notifications`, and both storage buckets already exist. Soft deletes are inherent because we write into tables that already have `deleted_at`.

## Dependencies

Add `pdfjs-dist` (client-side only). Pin the worker URL to the installed version and use the `.mjs` ESM worker build for Vite compatibility.

## Out of scope

- No new "My Generated Notes" history view — generated notes are ephemeral until the teacher saves to Resources or assigns to a student, both of which surface in existing screens.
- No changes to `StudentNotes` or to the `assigned_teacher_id` early-return behaviour.
- No schema migration.
