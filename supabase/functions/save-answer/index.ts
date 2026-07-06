import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { normalizeAnswers, computeTimeRemaining } from "../_shared/quiz-helpers.ts";

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

    const { attempt_id, question_id, selected_option } = await req.json();
    if (!attempt_id || !question_id) return json({ error: "Missing fields" }, 400);
    if (selected_option != null && !["A", "B", "C", "D"].includes(selected_option)) {
      return json({ error: "Bad option" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: attempt } = await admin
      .from("quiz_attempts")
      .select("id, student_user_id, status, answers, started_at, quiz_assignment_id")
      .eq("id", attempt_id)
      .maybeSingle();
    if (!attempt) return json({ error: "Attempt not found" }, 404);
    if (attempt.student_user_id !== user.id) return json({ error: "Forbidden" }, 403);
    if (attempt.status !== "in_progress") return json({ error: "Not active" }, 409);

    const answers = normalizeAnswers(attempt.answers);
    const existing = answers[question_id] || { selected_option: null, time_spent_seconds: 0 };
    answers[question_id] = {
      selected_option: selected_option ?? null,
      time_spent_seconds: existing.time_spent_seconds,
    };

    await admin
      .from("quiz_attempts")
      .update({ answers })
      .eq("id", attempt.id)
      .eq("status", "in_progress");

    // Fetch time_limit for reconciliation
    const { data: assignment } = await admin
      .from("quiz_assignments")
      .select("quiz_id")
      .eq("id", attempt.quiz_assignment_id)
      .maybeSingle();
    const { data: quiz } = assignment
      ? await admin.from("quizzes").select("time_limit_minutes").eq("id", assignment.quiz_id).maybeSingle()
      : { data: null };

    return json({
      ok: true,
      time_remaining_seconds: computeTimeRemaining(
        attempt.started_at,
        quiz?.time_limit_minutes ?? null,
      ),
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