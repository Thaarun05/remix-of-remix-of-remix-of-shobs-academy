# Switch AI generation back to Lovable AI

## Why
Your OpenRouter invoice is still Processing, so every generation returns 402 and the app is unusable for worksheets, quizzes, diagrams and notes. Your Lovable workspace has ~182 credits spendable on AI Gateway right now, and the entire previous billing period of AI generation cost only 6.49 credits — so moving back unblocks generation today at negligible cost.

Estimated cost after the switch:
- One 50-question worksheet: roughly 0.3–0.6 credits
- One quiz or notes run: roughly 0.05–0.15 credits

## What changes
Only the shared AI helper. Every prompt, JSON schema, batching rule, auth check and response shape stays exactly as it is, so all four features behave identically.

Affected features (all share the helper):
- AI Worksheet Builder (`generate-worksheet`)
- Worksheet diagram specs (`generate-diagram-spec`)
- AI Quiz Maker (`generate-quiz`)
- AI Notetaker (`generate-notes`)

## Technical details

`supabase/functions/_shared/nim.ts`:
- Base URL -> `https://ai.gateway.lovable.dev/v1`, auth header -> `Lovable-API-Key: ${LOVABLE_API_KEY}`. Drop the OpenRouter ranking headers.
- Model -> `google/gemini-3.6-flash` (the Gateway default; fast, cheap, strong at structured JSON).
- Remove the OpenRouter-only `reasoning: { enabled: true }` field.
- Keep `response_format: { type: "json_object" }`, `max_tokens: 16000`, the JSON-extraction fallback, and truncation detection (`finish_reason === "length"`).
- Rewrite the 401 / 402 / 429 error strings for Lovable AI: 402 points to Settings -> Plans & credits instead of openrouter.ai/credits.
- Startup guard: missing `LOVABLE_API_KEY` returns a clear configuration error.

`src/lib/worksheet/edgeErrors.ts`: update the OpenRouter-specific hint text to the Lovable AI wording.

Docs: replace `supabase/functions/OPENROUTER_SETUP.md` with Lovable AI setup notes.

`OPENROUTER_API_KEY` stays in secrets, unused — nothing to delete, and switching back later is a one-line change.

## Verification
Deploy all four functions, then run one real worksheet generation and one notes generation and read the actual responses. Report the real outcome rather than assuming success.

## Frontend
No frontend changes apart from the one error-message string above.
