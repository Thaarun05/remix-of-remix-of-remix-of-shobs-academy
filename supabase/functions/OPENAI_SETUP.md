# OpenAI secrets for AI Worksheet Builder

The teacher **Worksheet Builder** and diagram-spec pass use OpenAI (not the Lovable AI gateway).

## Required secret

| Secret | Used by | Purpose |
|--------|---------|---------|
| `OPENAI_API_KEY` | `generate-worksheet`, `generate-diagram-spec` | GPT-4.1 worksheet generation / chat refine; GPT-4o-mini diagram specs |

Set it in the **Supabase Dashboard → Project Settings → Edge Functions → Secrets**, or via CLI:

```bash
supabase secrets set OPENAI_API_KEY=sk-...
```

Then redeploy:

```bash
supabase functions deploy generate-worksheet
supabase functions deploy generate-diagram-spec
```

## Models

- Worksheet generate / regenerate / chat refine → `gpt-4.1`
- Diagram JSON specs → `gpt-4o-mini`

## Notes

- Never put the API key in the Vite frontend or commit it to git.
- Quiz Maker and AI Notetaker still use `LOVABLE_API_KEY` until migrated separately.
- Teachers without a configured key will see a clear configuration error from the edge function.
