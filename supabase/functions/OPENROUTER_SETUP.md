# OpenRouter setup for AI generation

All teacher AI generation (worksheet, diagrams, quiz, notes) uses **OpenRouter**
via its OpenAI-compatible API.

## Required secret

| Secret | Used by | Purpose |
|--------|---------|---------|
| `OPENROUTER_API_KEY` | `generate-worksheet`, `generate-diagram-spec`, `generate-quiz`, `generate-notes` | Auth to `https://openrouter.ai/api/v1` |

Create the key at https://openrouter.ai/keys and save it in the project's
backend secrets. Billing for these calls goes through the OpenRouter account,
not Lovable credits.

## Model (fixed)

- **All flows:** `openai/gpt-5.6-terra-pro`
- Shared helper: `supabase/functions/_shared/nim.ts` (historical filename)
- Request shape: OpenAI chat completions + `reasoning: { enabled: true }` and
  `response_format: { type: "json_object" }`.

## Notes

- Text-only in this app: uploaded images are ignored; use paste/PDF text extraction.
- Reasoning output is not surfaced in the UI and `reasoning_details` is not
  round-tripped — each call is a single-shot JSON generation.
- Never put `OPENROUTER_API_KEY` in Vite/`VITE_` env or commit it to git.
- Redeploy the four functions after changing the secret.
