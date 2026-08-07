# Worksheet Builder: reliable question editing + 50-question support

## Part 1 — Why "remove question" appears broken

Every question in the builder is identified by its **question number**, and the number is recomputed (`renumber`) after every delete, move and drag:

- `TeacherWorksheetBuilder.tsx` line 713: `key={q.number}` and `id={String(q.number)}`
- `deleteQuestion` (line 297) filters the array, then renumbers 1..N

So after deleting question 3 of 10, the remaining keys are 1..9 — exactly the keys that existed before, minus the last one. React therefore does **not** unmount the deleted row; it keeps rows 1-9 mounted and re-renders them with shifted content. Three visible symptoms follow:

1. It looks like the **last** question disappeared, not the one you clicked — so "remove isn't working".
2. `SortableQuestion` holds its edit drafts in local state seeded once from props (lines 767-771). Because the component is reused rather than remounted, those drafts now belong to the previous question — editing after a delete can write the wrong text into the wrong question.
3. `editingIdx` is an array index and is never cleared on delete (line 297), so an open editor stays open and jumps to a different question.

Drag-and-drop has the same root cause: `handleDragEnd` matches by `q.number` (line 323), which is a value it just rewrote.

## The fix

**Give every question a stable identity that never changes.**

- When a worksheet arrives (generation, refine, regenerate), attach a client-only `uid` to each question — a one-time random id, kept out of the exported PDF/JSON payloads.
- Use `uid` for the React `key`, the dnd-kit sortable `id`, and for all lookups in `handleDragEnd`.
- Keep `number` as a purely **display** value, still renumbered 1..N after each change.

**Make edit/delete target the question, not the index.**

- `deleteQuestion(uid)`, `moveQuestion(uid, dir)`, `updateQuestion(uid, patch)` and `regenerateQuestion(uid)` all resolve by `uid`.
- `editingIdx` becomes `editingUid`; it is cleared when that question is deleted, so an editor can never end up attached to a different question.
- Deleting the question currently being edited closes the editor first.

**Polish while we are in there**

- Confirm before deleting, plus an "Undo" action on the toast that restores the removed question at its original position.
- Disable delete when only one question remains.
- Add an "Add question" button (blank editable question appended at the end) so teachers can build up as well as trim down.
- Drafts in `SortableQuestion` re-sync from props whenever the question's `uid` changes, so a reused component can never show stale text.

## Part 2 — Generating 50+ questions

Today `generate-worksheet/index.ts` clamps the request to 15: `Math.min(Number(count) || 10, 15)`. Beyond that, a single AI call has to emit the entire worksheet JSON; a rich question (prompt, options, parts, marks, rubric, answer, working, diagram) runs roughly 250-450 output tokens, so 50 questions is ~15k-22k output tokens and the response truncates mid-JSON.

Raising the token cap alone will not get there reliably. Batch instead:

```text
50 questions -> batch 1 (Q1-10) -> batch 2 (Q11-20) -> ... -> batch 5 (Q41-50)
                        |
        each batch receives subject/grade/topic/types, the source text,
        its slot in the difficulty ramp, and the prompts already produced
        (so it does not repeat earlier questions)
```

- Raise the clamp to 60 and validate 1-60 in the form.
- Run batches inside the same edge function with concurrency 2, merge the results, renumber 1..N, return one worksheet — the frontend contract is unchanged.
- If a batch truncates, retry **that batch** once at half size; if it still fails, return the questions that succeeded plus a warning instead of discarding everything.
- Title, instructions and metadata come from batch 1 only.
- Progress text in the builder: "Generating 50 questions (batch 3 of 5)…".
- Chat refine on a large worksheet edits only the questions the request names and splices them back, rather than resending the whole document.

## Cost

Yes, AI generation draws credits from your existing workspace balance — no new service, key or subscription.

- A 50-question worksheet costs roughly 4-5x a 10-question one, because it produces roughly 4-5x the output tokens.
- Batching adds ~600-900 input tokens per batch (the instructions and context are resent). Input tokens are far cheaper than output tokens, so this overhead is small.
- The model stays `google/gemini-3.6-flash`, the low-cost tier — per-token pricing is unchanged.
- Failures are still billed for tokens produced, but batching wastes less: today one truncation burns a full 16k response and returns nothing; with batching only the failed 10-question batch is retried.
- The editing/delete fix is pure frontend state — zero AI cost.

## Technical details

- `src/components/teacher/TeacherWorksheetBuilder.tsx`: add `uid` on ingest (generation, refine, regenerate); switch `key`/sortable `id`/`handleDragEnd` lookups to `uid`; convert `deleteQuestion`/`moveQuestion`/`updateQuestion`/`regenerateQuestion` to uid-based; replace `editingIdx`/`regenIdx` with uid state; strip `uid` before PDF export and before sending the worksheet to `chat_refine`; delete confirm + undo toast; "Add question" button; count input `min=1 max=60`; batch progress label; surface `warnings`.
- `src/lib/worksheet/types.ts`: add optional client-only `uid?: string` to `Question`.
- `src/components/teacher/WorksheetRefineChat.tsx`: ensure refined worksheets get fresh uids on merge.
- `supabase/functions/generate-worksheet/index.ts`: clamp to 60; `generateBatch(start, end, priorPrompts, rampPosition)`; concurrency 2; merge + renumber; per-batch half-size retry; partial-success `warnings` array.
- `supabase/functions/_shared/nim.ts`: unchanged — `max_tokens` 16000 comfortably fits a 10-question batch.
- Redeploy `generate-worksheet`; verify a real 50-question run and check per-batch output tokens stay under the cap.
