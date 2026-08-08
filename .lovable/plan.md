# Switch AI generation to OpenRouter (openai/gpt-5.6-terra-pro)

## What changes
All teacher AI generation currently runs on Lovable AI through one shared helper. This plan repoints that single helper at OpenRouter's chat completions endpoint with the model `openai/gpt-5.6-terra-pro` and reasoning enabled, leaving every prompt, schema, auth check and response shape untouched.

Affected features (all share the helper):
- AI Worksheet Builder (`generate-worksheet`)
- Worksheet diagram specs (`generate-diagram-spec`)
- AI Quiz Maker (`generate-quiz`)
- AI Notetaker (`generate-notes`)

## Before implementation: the API key
OpenRouter is a bring-your-own-key service, so an `OPENROUTER_API_KEY` must be saved in the project secrets first. You create the key at openrouter.ai (Keys section) and I request it through the secure secret form — I never see or store it in code. Nothing else is needed; billing for these calls goes through your OpenRouter account, not Lovable credits.

If the model id is not enabled on your OpenRouter account, the very first call returns an error naming it. That result is reported back rather than silently falling back to another model.

## Technical details

`supabase/functions/_shared/nim.ts` (the shared helper, historical name kept so call sites are unchanged):
- Base URL -> `https://openrouter.ai/api/v1`, auth header -> `Authorization: Bearer ${OPENROUTER_API_KEY}`, plus optional `HTTP-Referer` / `X-Title` ranking headers.
- Model constant -> `openai/gpt-5.6-terra-pro`.
- Add `reasoning: { enabled: true }` to the request body (passed through as a top-level field alongside `messages`, `max_tokens`, `response_format`).
- Keep `response_format: { type: "json_object" }`, the JSON-extraction fallback, truncation detection (`finish_reason === "length"`) and the existing 401 / 402 / 429 error mapping; the OpenRouter status codes map onto the same messages.
- Startup guard: missing `OPENROUTER_API_KEY` returns a clear configuration error instead of a generic 500.
- Reasoning output is not surfaced in the UI and `reasoning_details` is not round-tripped — every call here is a single-shot JSON generation, not a multi-turn conversation.

`supabase/functions/generate-worksheet/index.ts`: batching (10 questions per batch, concurrency 2) stays as is; only the underlying provider changes.

Docs: replace `supabase/functions/NIM_SETUP.md` with OpenRouter setup notes, and fix the stale NVIDIA hint in `src/lib/worksheet/edgeErrors.ts`.

## Verification
Deploy the four functions, then run one real worksheet generation and one quiz generation and read the actual responses. If OpenRouter rejects the model or the key, that error is reported to you rather than worked around.

## Frontend
No frontend changes apart from the one stale error-message string above.
