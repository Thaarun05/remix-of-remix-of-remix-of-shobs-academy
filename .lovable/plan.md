# Align all AI generators with the worksheet builder

Bring the Quiz Maker, AI Notetaker and diagram generation in line with the worksheet builder: same AI model and limits, a free-entry question count, and an optional answer/explanation key.

## 1. Same AI model and provider everywhere
All four generators already route through one shared helper on OpenRouter (`openai/gpt-5.6-terra-pro`). Finish the alignment by giving every generator the same generous output limit and the same error handling (credits, rate limit, invalid key, truncation), so no feature silently uses a smaller budget than the worksheet builder.

## 2. Manual question count
- Quiz Maker: the form already accepts a typed number, but the backend silently caps it at 12. Raise the cap so the number the teacher types (1-50) is what gets generated, with the same "reduce and retry" fallback the worksheet uses if the response is too long.
- AI Notetaker has no question count, so nothing changes there.

## 3. Answer key on/off toggle
- Quiz Maker: add an "Include explanations" switch. When on, each question gets its explanation as today. When off, explanations are skipped in generation and hidden in the student review screen. Correct answers themselves stay, since auto-grading depends on them.
- AI Notetaker: add an "Include worked answers" switch for solved examples in the generated notes; when off, only the notes content is produced.

## Technical notes
- `supabase/functions/_shared/nim.ts`: provider/model unchanged; shared by all generators.
- `supabase/functions/generate-quiz/index.ts`: remove the hard 12-question cap, honour `include_explanations`, raise `max_tokens`, add truncation retry at half count.
- `supabase/functions/generate-notes/index.ts`: honour `include_answers`, raise `max_tokens`.
- `src/components/teacher/TeacherQuizMaker.tsx` and `src/components/teacher/TeacherAiNotetaker.tsx`: add the toggles and pass the flags in the request body.
- `src/components/student/StudentQuizzes.tsx`: hide the explanation block when a quiz has none.
- Redeploy `generate-quiz` and `generate-notes`.