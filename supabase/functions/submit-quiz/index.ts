import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  normalizeAnswers,
  accumulateActiveQuestion,
  computeTimeRemaining,
} from "../_shared/quiz-helpers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { attempt_id } = await req.json();
    if (!attempt_id) return json({ error: "attempt_id required" }, 400);

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: attempt } = await admin
      .from("quiz_attempts")
      .select("*")
      .eq("id", attempt_id)
      .maybeSingle();
    if (!attempt) return json({ error: "Attempt not found" }, 404);
    if (attempt.student_user_id !== user.id) return json({ error: "Forbidden" }, 403);

    // Idempotent: if already submitted, return stored results
    if (attempt.status === "submitted") {
      return json({
        score: attempt.score,
        total: attempt.total,
        results: attempt.results ?? [],
        attempt_number: attempt.attempt_number,
        total_time_spent_seconds: attempt.total_time_spent_seconds ?? 0,
      });
    }

    const { data: assignment } = await admin
      .from("quiz_assignments")
      .select("id, quiz_id, teacher_user_id")
      .eq("id", attempt.quiz_assignment_id)
      .maybeSingle();
    if (!assignment) return json({ error: "Assignment missing" }, 404);

    const { data: quiz } = await admin
      .from("quizzes")
      .select("id, title, time_limit_minutes")
      .eq("id", assignment.quiz_id)
      .maybeSingle();

    const { data: questions } = await admin
      .from("quiz_questions")
      .select("id, number, question, options, correct_option, explanation")
      .eq("quiz_id", assignment.quiz_id)
      .order("number", { ascending: true });
    const qs = questions ?? [];

    // Accumulate time for currently active question
    const answersIn = normalizeAnswers(attempt.answers);
    const activeIdx = attempt.active_question_index ?? 0;
    const activeQId = qs[Math.min(activeIdx, Math.max(qs.length - 1, 0))]?.id ?? null;
    const answersOut = accumulateActiveQuestion(
      answersIn,
      activeQId,
      attempt.question_started_at,
    );

    // Determine if this is a timed-expiry
    const timeRemaining = computeTimeRemaining(attempt.started_at, quiz?.time_limit_minutes ?? null);
    const expired = timeRemaining != null && timeRemaining <= 0;

    let score = 0;
    const results = qs.map((q: any) => {
      const stored = answersOut[q.id];
      const selected = stored?.selected_option ?? null;
      const is_correct = selected != null && selected === q.correct_option;
      if (is_correct) score++;
      return {
        question_id: q.id,
        number: q.number,
        question: q.question,
        options: q.options,
        selected,
        correct_option: q.correct_option,
        is_correct,
        explanation: q.explanation ?? null,
        time_spent_seconds: stored?.time_spent_seconds ?? 0,
      };
    });
    const total = qs.length;
    const total_time_spent_seconds = results.reduce(
      (s: number, r: any) => s + (r.time_spent_seconds || 0),
      0,
    );

    const { error: updErr } = await admin
      .from("quiz_attempts")
      .update({
        answers: answersOut,
        results,
        score,
        total,
        total_time_spent_seconds,
        status: expired ? "expired" : "submitted",
        submitted_at: new Date().toISOString(),
      })
      .eq("id", attempt.id)
      .eq("status", "in_progress");
    if (updErr) {
      console.error("submit update failed", updErr);
      return json({ error: updErr.message }, 500);
    }

    // Notify teacher (best-effort)
    try {
      await admin.from("notifications").insert({
        recipient_id: assignment.teacher_user_id,
        sender_id: user.id,
        type: "quiz_completed",
        title: "Quiz completed",
        body: `A student scored ${score}/${total} on "${quiz?.title ?? "your quiz"}" (attempt ${attempt.attempt_number}).`,
        role_target: "teacher",
        entity_table: "quiz_assignments",
        entity_id: assignment.id,
      });
    } catch (_) {
      // ignore
    }

    return json({
      score,
      total,
      results,
      attempt_number: attempt.attempt_number,
      total_time_spent_seconds,
    });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}