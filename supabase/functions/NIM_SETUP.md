# NVIDIA NIM setup for AI generation

All teacher AI generation (worksheet, diagrams, quiz, notes) uses **NVIDIA NIM** via the OpenAI-compatible API.

## Required secret

| Secret | Used by | Purpose |
|--------|---------|---------|
| `NVIDIA_API_KEY` | `generate-worksheet`, `generate-diagram-spec`, `generate-quiz`, `generate-notes` | Auth to `https://integrate.api.nvidia.com/v1` |

Set in **Supabase Dashboard → Edge Functions → Secrets** or **Lovable Cloud → Secrets**:

```bash
supabase secrets set NVIDIA_API_KEY=nvapi-...
```

Then redeploy:

```bash
supabase functions deploy generate-worksheet
supabase functions deploy generate-diagram-spec
supabase functions deploy generate-quiz
supabase functions deploy generate-notes
```

## Model (fixed)

- **All flows:** `meta/llama-3.2-1b-instruct`
- Shared helper: `supabase/functions/_shared/nim.ts`
- Client pattern: OpenAI SDK with `baseURL: https://integrate.api.nvidia.com/v1`

## Capacity risks (no silent fallback)

Llama 3.2 **1B** is small. If worksheet / quiz / notes return invalid JSON often, **explicitly** switch the model constant in `_shared/nim.ts` to:

- `meta/llama-3.1-8b-instruct` (recommended next step)

Do **not** auto-route between models in code.

## Notes

- Text-only: uploaded images are ignored; use paste/PDF text extraction.
- Never put `NVIDIA_API_KEY` in Vite/`VITE_` env or commit it to git.
- `OPENAI_API_KEY` / Lovable AI gateway are **not** used for these generate functions anymore.
