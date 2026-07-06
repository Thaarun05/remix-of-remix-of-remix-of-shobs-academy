import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  normalizeAnswers,
  computeTimeRemaining,
  accumulateActiveQuestion,
  buildAnswersSummary,
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

    const { attempt_id, target_index } = await req.json();
    if (!attempt_id || typeof target_index !== "number") {
      return json({ error: "attempt_id and target_index required" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: attempt } = await admin
      .from("quiz_attempts")
      .select("*")
      .eq("id", attempt_id)
      .maybeSingle();
    if (!attempt) return json({ error: "Attempt not found" }, 404);
    if (attempt.student_user_id !== user.id) return json({ error: "Forbidden" }, 403);
    if (attempt.status !== "in_progress") return json({ error: "Attempt is not active" }, 409);

    const { data: assignment } = await admin
      .from("quiz_assignments")
      .select("quiz_id")
      .eq("id", attempt.quiz_assignment_id)
      .maybeSingle();
    if (!assignment) return json({ error: "Assignment missing" }, 404);

    const { data: quiz } = await admin
      .from("quizzes")
      .select("time_limit_minutes")
      .eq("id", assignment.quiz_id)
      .maybeSingle();

    const { data: questions } = await admin
      .from("quiz_questions")
      .select("id, number, topic, question, options")
      .eq("quiz_id", assignment.quiz_id)
      .order("number", { ascending: true });
    const qs = questions ?? [];
    if (target_index < 0 || target_index >= qs.length) return json({ error: "Bad index" }, 400);

    // Server-side timing accumulation
    const answersIn = normalizeAnswers(attempt.answers);
    const activeIdx = attempt.active_question_index ?? 0;
    const activeQId = qs[Math.min(activeIdx, qs.length - 1)]?.id ?? null;
    const answersOut = accumulateActiveQuestion(answersIn, activeQId, attempt.question_started_at);

    const nowIso = new Date().toISOString();
    const nextFurthest = Math.max(attempt.furthest_question_index ?? 0, target_index);

    await admin
      .from("quiz_attempts")
      .update({
        answers: answersOut,
        active_question_index: target_index,
        furthest_question_index: nextFurthest,
        question_started_at: nowIso,
      })
      .eq("id", attempt.id)
      .eq("status", "in_progress");

    const targetQ = qs[target_index];
    const summary = buildAnswersSummary(answersOut);
    const timeRemaining = computeTimeRemaining(attempt.started_at, quiz?.time_limit_minutes ?? null);

    return json({
      active_question_index: target_index,
      furthest_question_index: nextFurthest,
      active_question: {
        id: targetQ.id,
        number: targetQ.number,
        topic: targetQ.topic,
        question: targetQ.question,
        options: targetQ.options,
      },
      selected_option: summary.selected[targetQ.id] ?? null,
      answers_summary: summary,
      time_remaining_seconds: timeRemaining,
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