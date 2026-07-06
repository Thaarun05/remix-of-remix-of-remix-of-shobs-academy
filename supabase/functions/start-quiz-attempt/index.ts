import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  normalizeAnswers,
  computeTimeRemaining,
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

    const { quiz_assignment_id } = await req.json();
    if (!quiz_assignment_id) return json({ error: "quiz_assignment_id required" }, 400);

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: assignment } = await admin
      .from("quiz_assignments")
      .select("id, quiz_id, student_user_id, max_attempts, deleted_at")
      .eq("id", quiz_assignment_id)
      .maybeSingle();
    if (!assignment || assignment.deleted_at) return json({ error: "Assignment not found" }, 404);
    if (assignment.student_user_id !== user.id) return json({ error: "Forbidden" }, 403);

    const { data: quiz } = await admin
      .from("quizzes")
      .select("id, title, subject, grade, instructions, time_limit_minutes")
      .eq("id", assignment.quiz_id)
      .maybeSingle();
    if (!quiz) return json({ error: "Quiz not found" }, 404);

    const { data: questions } = await admin
      .from("quiz_questions")
      .select("id, number, topic, question, options")
      .eq("quiz_id", quiz.id)
      .order("number", { ascending: true });
    const qs = questions ?? [];
    if (qs.length === 0) return json({ error: "Quiz has no questions" }, 400);

    // Try to resume an in-progress attempt
    const { data: existing } = await admin
      .from("quiz_attempts")
      .select("*")
      .eq("quiz_assignment_id", assignment.id)
      .eq("student_user_id", user.id)
      .eq("status", "in_progress")
      .maybeSingle();

    let attempt = existing;

    if (!attempt) {
      // Enforce max_attempts against submitted attempts only
      const { count: submittedCount } = await admin
        .from("quiz_attempts")
        .select("id", { count: "exact", head: true })
        .eq("quiz_assignment_id", assignment.id)
        .eq("status", "submitted");
      if (assignment.max_attempts != null && (submittedCount ?? 0) >= assignment.max_attempts) {
        return json({ error: "No attempts remaining" }, 403);
      }
      const attempt_number = (submittedCount ?? 0) + 1;
      const nowIso = new Date().toISOString();
      const { data: created, error: insErr } = await admin
        .from("quiz_attempts")
        .insert({
          quiz_assignment_id: assignment.id,
          student_user_id: user.id,
          attempt_number,
          answers: {},
          status: "in_progress",
          active_question_index: 0,
          furthest_question_index: 0,
          started_at: nowIso,
          question_started_at: nowIso,
          total_time_spent_seconds: 0,
        })
        .select("*")
        .single();
      if (insErr) return json({ error: insErr.message }, 500);
      attempt = created;
    }

    const answers = normalizeAnswers(attempt!.answers);
    const timeRemaining = computeTimeRemaining(attempt!.started_at, quiz.time_limit_minutes);
    if (timeRemaining != null && timeRemaining <= 0) {
      // Signal client to submit — no auto-submit here to keep this endpoint side-effect-lite
      return json({ expired: true, attempt_id: attempt!.id });
    }

    const activeIdx = attempt!.active_question_index ?? 0;
    const activeQ = qs[Math.min(activeIdx, qs.length - 1)];
    const summary = buildAnswersSummary(answers);

    return json({
      attempt_id: attempt!.id,
      attempt_number: attempt!.attempt_number,
      quiz: {
        id: quiz.id,
        title: quiz.title,
        subject: quiz.subject,
        grade: quiz.grade,
        instructions: quiz.instructions,
        time_limit_minutes: quiz.time_limit_minutes,
      },
      questions_meta: qs.map((q: any) => ({ id: q.id, number: q.number, topic: q.topic })),
      questions_full: qs.map((q: any) => ({
        id: q.id,
        number: q.number,
        topic: q.topic,
        question: q.question,
        options: q.options,
      })),
      active_question_index: activeIdx,
      furthest_question_index: attempt!.furthest_question_index ?? 0,
      active_question: {
        id: activeQ.id,
        number: activeQ.number,
        topic: activeQ.topic,
        question: activeQ.question,
        options: activeQ.options,
      },
      selected_option: summary.selected[activeQ.id] ?? null,
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