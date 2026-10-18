# Generate Worksheet: why OpenRouter returns HTTP 402

Diagnosis only. Nothing changes until you approve the next steps.

## 1. Files and functions involved

```text
Generate button
 -> src/components/teacher/TeacherWorksheetBuilder.tsx
    - extractSourceFiles() (src/lib/extractSource.ts): PDF text, up to 30 pages; pages with little text become PNG images
    - supabase.functions.invoke("generate-worksheet", ...)   (line ~238)
    - on error: edgeFunctionErrorMessage() (src/lib/worksheet/edgeErrors.ts)
 -> supabase/functions/generate-worksheet/index.ts
    - reads subject, grade, topic, count, difficulty, types, objective, text, images, include_answers
    - source text cut to 12,000 characters (line 310); images are ignored (text-only)
    - callNimChat({ max_tokens: 60000, ... })   (line 323)
    - edit/refine paths use max_tokens 16000 (lines 202, 252)
 -> supabase/functions/_shared/nim.ts  callNimChat()
    - OpenRouter https://openrouter.ai/api/v1, key from the OPENROUTER_API_KEY backend secret
    - model openai/gpt-5.6-terra-pro, reasoning enabled, JSON output mode
    - status 402 is turned into the "declined (HTTP 402)" message plus the provider's own text
```

Quiz generation uses the same helper, also with 60,000 (generate-quiz line 87).

## 2. Most likely root cause
OpenRouter checks the cost of a request **before** it runs. It multiplies the requested `max_tokens` (60,000) by the model's output price and adds the input cost. If that worst case is more than the key is allowed to spend, it returns 402 with the message "requires more credits, or fewer max_tokens. You requested up to 60000 tokens, but can only afford N." Your second error says exactly this.

That means the limit comes from **the 60,000 reservation, not the length of the worksheet**. It happens even when no file is uploaded, and that matches what you saw.

The money check can be stricter than your account balance for two reasons:
- **A spending limit on the key.** OpenRouter keys can have their own credit limit, separate from the account balance. If that limit is low or mostly used up, the key can't cover a 60,000-token reservation, even with $10.65 in the account.
- **The model's price.** For an expensive "pro" reasoning model, 60,000 output tokens can cost more than the remaining limit. The price I noted earlier (about $0.72) is not confirmed against OpenRouter's current pricing page.

## 3. One issue or several
One main issue: the 60,000-token reservation is larger than the key can afford. Two smaller issues:
- The first error message ("credits exhausted") came from the old code. The current code no longer claims that. The new message does say "may be insufficient balance", which can still mislead.
- Your balance dropped from $11.35 to $10.65, so some calls are succeeding (or smaller ones like edit and diagram calls that use 16,000 or 1,024 tokens). Big generations fail at the pre-check.

## 4. What the 402 and the "60000" mean here
- 402 = OpenRouter refused the cost pre-check. It does not mean the account is at zero.
- 60000 = the **maximum answer length** (`max_tokens`) set in generate-worksheet and generate-quiz. It is not the model's context window and not your input size. The model is never asked to produce that much, but OpenRouter reserves credit for it.

## 5. Confirmed vs needs your OpenRouter account
Confirmed from the code: the files and flow above, the 60,000 reservation, the 12,000-character limit on source text, that images are ignored, the key name, the model name, and how errors are mapped.

Needs checking on openrouter.ai:
- Keys page: the **credit limit** on this key, and how much of it is used.
- Model page for `openai/gpt-5.6-terra-pro`: output price per token and maximum output length.
- Activity page: which calls succeeded (to explain the $0.70 spent).

The app could ask OpenRouter for the key's limit and remaining credit (`GET /api/v1/key`) to confirm this without the dashboard. It does not do that today.

PDFs are not the cause. Source text is capped at 12,000 characters (about 3,000 tokens) and images are dropped. The error also happens without any file.

## 6. Recommended next steps (in order, after your approval)
1. **You check** the key's credit limit and the model's price on OpenRouter. Raising or removing the key limit may fix this with no code change.
2. **Size the reservation to the request** in generate-worksheet and generate-quiz. Scale `max_tokens` with the question count (for example about 1,200 per question plus overhead, with a cap) instead of a fixed 60,000. Keep the existing retry that halves the count if the answer gets cut off.
3. **Add a one-time check** that reads the key's remaining limit (`/api/v1/key`) and shows it in the error, so a 402 tells you which limit was hit.
4. **Make the error message clearer:** "the key's spending limit can't cover this request size", using the actual figures from OpenRouter.
5. Deploy the affected functions and run one real worksheet generation and one quiz generation as a teacher to confirm.
