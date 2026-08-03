# AI setup for the Worksheet Builder

All AI features now run through the **Lovable AI Gateway** — no third-party API key is required.

## Required secret

| Secret | Used by | Purpose |
|--------|---------|---------|
| `LOVABLE_API_KEY` | `generate-worksheet`, `generate-diagram-spec`, `generate-quiz`, `generate-notes` | All chat-completion calls |

This key is auto-provisioned by Lovable; nobody needs to set it manually.

## Models

- Worksheet generate / regenerate / chat refine → `google/gemini-3.6-flash`
- Diagram JSON specs → `google/gemini-3.6-flash`
- Quiz Maker / AI Notetaker → `google/gemini-2.5-flash`

## Notes

- Never expose `LOVABLE_API_KEY` to the Vite frontend.
- Rate limits surface as HTTP 429 and exhausted credits as HTTP 402; both are shown to the teacher as readable errors.
- The legacy `OPENAI_API_KEY` secret is no longer used by any edge function.
