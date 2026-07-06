// Shared helpers for the live quiz flow.
// Timing is always derived from server timestamps, never trust client durations.

export interface StoredAnswer {
  selected_option: string | null;
  time_spent_seconds: number;
}

export type AnswersMap = Record<string, StoredAnswer>;

export function normalizeAnswers(raw: unknown): AnswersMap {
  const out: AnswersMap = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v && typeof v === "object") {
      const rec = v as Record<string, unknown>;
      // Legacy shape: value was just the selected letter (string)
      out[k] = {
        selected_option:
          typeof rec.selected_option === "string" || rec.selected_option === null
            ? (rec.selected_option as string | null)
            : null,
        time_spent_seconds:
          typeof rec.time_spent_seconds === "number" && rec.time_spent_seconds >= 0
            ? Math.floor(rec.time_spent_seconds)
            : 0,
      };
    } else if (typeof v === "string") {
      out[k] = { selected_option: v, time_spent_seconds: 0 };
    }
  }
  return out;
}

export function computeTimeRemaining(
  startedAt: string | null,
  timeLimitMinutes: number | null | undefined,
): number | null {
  if (!timeLimitMinutes || !startedAt) return null;
  const startMs = new Date(startedAt).getTime();
  const limitMs = timeLimitMinutes * 60 * 1000;
  const remaining = Math.floor((startMs + limitMs - Date.now()) / 1000);
  return remaining;
}

export function accumulateActiveQuestion(
  answers: AnswersMap,
  activeQuestionId: string | null,
  questionStartedAt: string | null,
): AnswersMap {
  if (!activeQuestionId || !questionStartedAt) return answers;
  const elapsed = Math.max(
    0,
    Math.floor((Date.now() - new Date(questionStartedAt).getTime()) / 1000),
  );
  const existing = answers[activeQuestionId] || { selected_option: null, time_spent_seconds: 0 };
  return {
    ...answers,
    [activeQuestionId]: {
      selected_option: existing.selected_option,
      time_spent_seconds: existing.time_spent_seconds + elapsed,
    },
  };
}

export function buildAnswersSummary(answers: AnswersMap): {
  selected: Record<string, string | null>;
  time_spent: Record<string, number>;
} {
  const selected: Record<string, string | null> = {};
  const time_spent: Record<string, number> = {};
  for (const [qid, v] of Object.entries(answers)) {
    selected[qid] = v.selected_option ?? null;
    time_spent[qid] = v.time_spent_seconds ?? 0;
  }
  return { selected, time_spent };
}