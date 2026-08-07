# Support 50+ question worksheets

## Why it fails today

Two hard ceilings:

1. `supabase/functions/generate-worksheet/index.ts` clamps the request: `Math.min(Number(count) || 10, 15)`. Anything above 15 is silently cut to 15.
2. One single AI call must emit the whole worksheet JSON. A rich question (prompt, options, parts, marks, difficulty, blooms level, rubric, answer, working, diagram) costs roughly 250-450 output tokens. 50 questions is therefore ~15k-22k output tokens — at or beyond the practical single-response output limit, so the JSON gets truncated mid-object and the parse fails.

Raising `max_tokens` alone will not reliably get to 50+. The fix is batching.

## The plan

### 1. Remove the cap
Allow up to 60 questions end to end: raise the clamp in the edge function, and validate the input in the builder form (1-60) so the UI matches what the backend accepts.

### 2. Generate in batches (the core change)
Split the request into chunks of 10 questions and run them as sequential AI calls inside the same edge function:

```text
50 questions -> batch 1 (Q1-10) -> batch 2 (Q11-20) -> ... -> batch 5 (Q41-50)
                          |
              each batch gets: subject/grade/topic/types/difficulty,
              the source text, the target number range, and a short list
              of prompts already generated (so it does not repeat itself)
```

Each batch returns a small JSON array that comfortably fits in the output budget. The function then merges the batches, renumbers questions 1..N sequentially, and returns one worksheet object. The frontend contract does not change.

Difficulty progression is preserved by telling each batch where it sits in the ramp (batch 1 = easiest, last batch = hardest).

### 3. Resilience
- If one batch fails or truncates, retry that batch once with 5 questions instead of 10 — only that batch, not the whole worksheet.
- If a batch still fails, return the worksheet with the questions that succeeded plus a warning, rather than throwing everything away.
- Title, instructions and metadata are produced once (with batch 1) and reused.

### 4. Timeout safety
5 sequential calls take longer than one. Batches run with limited concurrency (2 at a time) to keep total wall time inside the edge function limit, and the builder shows "Generating 50 questions (batch 3 of 5)..." so a longer wait is expected rather than alarming.

### 5. Chat refine
Refining a 50-question worksheet by resending the whole JSON will hit the same ceiling. Refine on large worksheets will target only the questions the request mentions and splice them back in, instead of regenerating the full document.

## Cost

Yes — AI generation consumes credits, and cost scales with tokens.

- Every worksheet generation already costs credits from your workspace balance; this is the Lovable AI Gateway usage you can see in the AI usage logs.
- A 50-question worksheet costs roughly 4-5x a 10-question one, because it produces roughly 4-5x the output tokens. Batching adds a small extra overhead: each batch resends the instructions and topic context (~600-900 input tokens per batch). Input tokens are much cheaper than output tokens, so the overhead is minor relative to the total.
- The model stays `google/gemini-3.6-flash`, which is the low-cost tier — no model upgrade is proposed, so per-token cost is unchanged.
- Failed/truncated generations are still billed for the tokens produced. Batching actually reduces waste: today a truncation burns a full 16k-token response and returns nothing; with batching only the failed 10-question batch is retried.

No new paid service, no new API key, no subscription — it draws on the same workspace credit balance already in use.

## Technical details

- `supabase/functions/generate-worksheet/index.ts`: raise the clamp to 60; add a `generateBatch(start, end, priorPrompts, rampPosition)` helper; run batches with concurrency 2; merge + renumber; per-batch retry at half size; partial-success response with a `warnings` array.
- `supabase/functions/_shared/nim.ts`: no model change; keep `max_tokens` at 16000 (a 10-question batch fits well inside it).
- `src/components/teacher/TeacherWorksheetBuilder.tsx`: input `min=1 max=60`, clamp on submit, batch progress text during generation, surface `warnings` as a non-blocking toast.
- Redeploy `generate-worksheet` and verify a real 50-question run, checking the usage log for per-batch output tokens staying under the cap.
