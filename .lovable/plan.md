# Fix AI generation errors (notes, quiz, worksheet)

## 1. Operations (you, in OpenRouter)
- Raise or remove the credit limit on key 65f923a931…, or create a new key; I will then update the saved OpenRouter key.
- I redeploy generate-worksheet, generate-quiz, generate-notes and check logs for the new max_tokens value.

## 2. Show real error messages
- `TeacherAiNotetaker.tsx` (~line 176) and `TeacherQuizMaker.tsx` (~line 229): replace `if (error) throw error;` with `if (error) throw new Error(await edgeFunctionErrorMessage(error, data));` and import it from `@/lib/worksheet/edgeErrors`.

## 3. Generic fallback text
- `src/lib/worksheet/edgeErrors.ts`: non-2xx fallback becomes "The AI service returned an error. Check the OpenRouter key and limits, and that the edge functions are redeployed."

## 4. Smaller notes token budget
- `generate-notes/index.ts`: `max_tokens` 16000 -> 10000.
- `_shared/nim.ts`: both `opts.max_tokens ?? 16000` fallbacks -> 10000.

## 5. Stop sending images (notetaker and quiz maker)
- In `extractFromPdf`, delete the rasterise/`images.push` branch.
- If a PDF yields no text, show a toast: looks scanned, please paste the text.
- Remove `images.push(await fileToDataUrl(f))` for non-PDF files; drop `images` from both invoke bodies (and now-unused helpers/imports).

## Risks
- Image-only uploads (photos, scanned PDFs) will no longer work in notetaker/quiz maker; users must paste text.
- Worksheet builder is unchanged.

## Verify
- Build log clean, run existing token-budget test, deploy, check function logs.
