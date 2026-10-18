# Minimal fix: worksheet generation HTTP 402

## What changes
Size the maximum answer length (`max_tokens`) to the number of questions instead of a fixed 60,000, and make the 402 error message accurate. The model, prompts, JSON format, reasoning setting and answer-key toggle all stay the same.

## 1. Recommended token limits

Rough output per worksheet question, as JSON with the prompt, options, marks and difficulty:
- without an answer key: about 150–300 tokens
- with an answer key (answer and working): about 300–600 tokens

Reasoning is turned on, and its "thinking" tokens use the same budget, so the limit leaves about 2x headroom.

Formula (worksheet):

```text
max_tokens = min(32000, 4000 + count x (includeAnswers ? 900 : 550))
```

| Questions | No answer key | With answer key |
|-----------|---------------|-----------------|
| 10        | 9,500         | 13,000          |
| 20        | 15,000        | 22,000          |
| 30        | 20,500        | 31,000          |
| 50        | 31,500        | 32,000 (cap)    |

Why this is enough: 30 questions with answers need about 18,000 visible tokens at most, and the budget leaves room for reasoning on top. Why it is cheaper to clear: OpenRouter's up-front cost check uses this number. A 10-question worksheet now reserves about 13,000 tokens instead of 60,000, which is roughly 4.5x less.

## 2. Code changes

**`supabase/functions/generate-worksheet/index.ts`** (main generation call, line ~323)
- Replace `max_tokens: 60000` with the formula above, using the existing `requestedCount` and `includeAnswers` values.
- If a retry with fewer questions already exists, it recalculates the limit for the smaller count.
- Edit and refine calls (16,000) are left as they are.

**`supabase/functions/generate-quiz/index.ts`** (line 87): same problem, so it gets the same treatment.

```text
max_tokens = min(32000, 3000 + count x (includeExplanations ? 550 : 350))
```

This gives 10 questions = 8,500 and 50 questions = 30,500. Its existing retry with half the questions recalculates the limit for the new count.

**`supabase/functions/_shared/nim.ts`**: nothing changes here except the error message below. `max_tokens` is passed straight through, as it is today.

Notes and diagram calls (16,000 and 1,024) are not touched.

## 3. Clearer 402 message (`_shared/nim.ts`)
- Keep the rule that 402 never claims "credits exhausted".
- New wording: "OpenRouter couldn't approve the cost of this request (HTTP 402). Usually this means the API key's spending limit, or the remaining balance, is below the maximum this request might cost. It does not necessarily mean the balance is zero."
- Add OpenRouter's own message (already captured by `getProviderErrorMessage`). That message includes the "can only afford N" figure when OpenRouter sends it.
- Log the status, model, `max_tokens` and provider message (never the key) in the backend log, so the next failure can be confirmed from evidence.
- `src/lib/worksheet/edgeErrors.ts`: no change needed. It already shows the backend's error message.

## 4. Checking the key's credit (GET /api/v1/key)
**Optional. Not part of the fix.** It only helps diagnose the problem. The logging above plus OpenRouter's own message already give the affordability figure when a 402 happens. A key check could be added later, for example as an admin "check AI key" button, if you want it.

## 5. Risks
- **Answers getting cut off:** if the model reasons for a long time, a tighter budget could stop it before the JSON is finished. Mitigation: the existing cut-off detection plus the retry with fewer questions. The 2x headroom makes this unlikely below 30 questions.
- **Still 402 if the key limit is very low:** if the key can afford fewer tokens than the new number, the error remains. The new message will then show the exact figure, and the fix is on OpenRouter (raise the key's limit or add credit).
- **JSON output, reasoning, answer key:** these don't change. Only the output budget does.
- **Large worksheets (40–50 questions with answers)** hit the 32,000 cap and may be cut off, then retried with fewer questions. That is the same behaviour as today's retry path.

## Verification
Deploy generate-worksheet and generate-quiz, then sign in as a teacher and run one real 10-question worksheet (answer key on), one 30-question worksheet and one quiz. Read the actual responses and backend logs. If OpenRouter still returns 402, report its exact message instead of working around it.
