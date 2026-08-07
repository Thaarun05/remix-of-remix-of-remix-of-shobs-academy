# Fix: "Generation returned invalid JSON" in the Worksheet Builder

## What is actually happening

This is not a broken model or a bad API key. The AI call succeeds (HTTP 200) — the response is simply cut off mid-JSON, so parsing fails and the app shows "Generation returned invalid JSON".

Evidence from the AI usage logs for the two most recent worksheet generations:

```text
2026-08-07 01:38  status: success  tokens: 530 in / 4092 out
2026-08-06 14:41  status: success  tokens: 560 in / 4092 out
```

The output cap in the code is 4096 tokens. Both runs stopped at 4092 — i.e. they ran straight into the ceiling. A worksheet JSON with 10-15 questions, each carrying options, parts, marks, difficulty, blooms level, rubric, answer, working and a diagram description, does not fit in that budget. The JSON ends halfway through a question, `JSON.parse` fails, and the generic parse message is shown.

Earlier successful runs finished at 1300-3500 output tokens — under the cap — which is why the feature works sometimes and fails on bigger requests.

## The fix

1. Raise the output token limit for worksheet generation and chat-refine well above the current 4096 so a full worksheet fits.
2. Detect truncation explicitly: when the model stops because it hit the length limit, show a clear message ("The worksheet was too long to finish — reduce the number of questions") instead of the misleading "invalid JSON".
3. Auto-recover on truncation: retry once with a reduced question count / trimmed source text rather than failing outright.
4. Log the raw tail of the response on parse failure so any future occurrence is diagnosable from logs instead of guesswork.

## Technical details

- `supabase/functions/_shared/nim.ts`: raise the default `max_tokens`, read `choices[0].finish_reason` and throw a distinct `truncated` error code when it is `length`, and log a truncated snippet of the response on parse failure.
- `supabase/functions/generate-worksheet/index.ts`: raise `max_tokens` on the full-generation and `chat_refine` calls, and add a single retry with a smaller question count when the truncation error is raised.
- `src/lib/worksheet/edgeErrors.ts` / `TeacherWorksheetBuilder`: surface the truncation message as its own toast text.
- Redeploy `generate-worksheet` and verify with a real 12-15 question generation, checking the usage log shows output tokens below the new cap.

No frontend behaviour or worksheet layout changes beyond the error message.
