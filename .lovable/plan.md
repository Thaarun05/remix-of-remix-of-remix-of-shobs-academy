# AI Feature Audit — Shobs Academy

## Summary
Four AI generation features exist. Two work (Quiz Maker, AI Notetaker — both on Lovable AI, confirmed by successful gateway calls as recently as 2026-08-02). Two are broken (Worksheet Builder and its diagram pass) because they bypass Lovable AI and call OpenAI directly with model ids that do not exist in OpenAI's catalog.

---

## 1. AI Worksheet Builder
2. **Location**: UI `src/components/teacher/TeacherWorksheetBuilder.tsx` + `WorksheetRefineChat.tsx`; backend `supabase/functions/generate-worksheet/index.ts`; shared client `supabase/functions/_shared/openai.ts`
3. **Provider/model**: direct `api.openai.com/v1/chat/completions`, `MODEL_WORKSHEET = "gpt-5.6-terra"`
4. **Status**: broken
5. **Why**: `gpt-5.6-terra` is not an OpenAI API model id. Every call (generate, regenerate, chat refine) is rejected upstream; `_shared/openai.ts` maps that to a non-2xx, which the UI shows as "Edge Function returned a non-2xx status code". Zero AI Gateway traffic for this feature confirms it never reaches Lovable AI. A wrong or unset `OPENAI_API_KEY` would be a second failure point, but the model id fails regardless.
6. **Fix**: route it through Lovable AI (`https://ai.gateway.lovable.dev/v1`, `LOVABLE_API_KEY`) using `google/gemini-3.6-flash`, matching the two working functions. Keep the JSON-schema / `json_object` response format and the existing auth + role checks. Remove the direct-OpenAI path so an invented id cannot be reintroduced.
7. **Free model?**: Yes — Lovable AI's Gemini Flash is already included; no NVIDIA NIM or OpenRouter key needed.
8. **Needs paid GPT 5.6 Terra Pro?**: No.

## 2. Worksheet Diagram Specs
2. **Location**: `supabase/functions/generate-diagram-spec/index.ts`; renderers in `src/components/teacher/worksheet/diagrams/`
3. **Provider/model**: direct OpenAI, `MODEL_DIAGRAM = "gpt-5.6-luna"`
4. **Status**: broken (same root cause)
5. **Why**: `gpt-5.6-luna` is not an OpenAI model id.
6. **Fix**: same migration to Lovable AI + `google/gemini-3.6-flash`, JSON object mode, existing teacher role check preserved.
7. **Free model?**: Yes.
8. **Paid?**: No.

## 3. AI Quiz Maker
2. **Location**: `src/components/teacher/TeacherQuizMaker.tsx` -> `supabase/functions/generate-quiz/index.ts`
3. **Provider/model**: Lovable AI Gateway, `google/gemini-2.5-flash` (multimodal, `json_object`)
4. **Status**: working (gateway 200s, ~7s, 2026-08-02)
5/6. No fix required. Optional: bump to `google/gemini-3.6-flash`, the current default.
7/8. Already on an included model; no paid model needed.

## 4. AI Notetaker
2. **Location**: `src/components/teacher/TeacherAiNotetaker.tsx` -> `supabase/functions/generate-notes/index.ts`
3. **Provider/model**: Lovable AI Gateway, `google/gemini-2.5-flash`
4. **Status**: working
5/6. No fix required. Optional model bump as above.
7/8. No paid model needed.

## Non-AI generation (for completeness)
Quiz taking and grading (`start-quiz-attempt`, `go-to-question`, `save-answer`, `submit-quiz`), PDF export (jsPDF), and PDF/image text extraction (`src/lib/extractSource.ts`, pdfjs) are deterministic — no model calls.

## Config findings
- Secrets present: `LOVABLE_API_KEY`, `OPENAI_API_KEY`, `RESEND_API_KEY`.
- Auth config is correct: all four generate functions have `verify_jwt = true` and validate teacher/admin roles.
- No feature flags or disabled AI code paths found. `supabase/functions/OPENAI_SETUP.md` documents the dead OpenAI path and goes stale after the fix.
- The two working functions already handle 429 (rate limit) and 402 (credits exhausted) explicitly; the same handling will be applied to the worksheet functions.

## Priority
Fix the **Worksheet Builder** first — it is the feature teachers are hitting errors on, and the diagram function is part of the same flow, so both are fixed in one change.

## Proposed change set
1. Rewrite `generate-worksheet/index.ts` and `generate-diagram-spec/index.ts` to call the Lovable AI Gateway with `google/gemini-3.6-flash`, preserving prompts, schemas, auth, and response shapes.
2. Replace `_shared/openai.ts` with a shared Lovable AI helper (same error mapping, plus 429/402 handling).
3. Update `OPENAI_SETUP.md` to describe the gateway setup.
4. Redeploy both functions and run one real worksheet generation to confirm a 200 in the gateway logs.
5. Frontend untouched apart from the stale OpenAI error hint in `src/lib/worksheet/edgeErrors.ts`.

No NVIDIA NIM, OpenRouter, or GPT 5.6 Terra Pro credentials are needed — Lovable AI covers every feature here.