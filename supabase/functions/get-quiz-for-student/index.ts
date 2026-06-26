import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { quiz_assignment_id } = await req.json();
    if (!quiz_assignment_id) {
      return new Response(JSON.stringify({ error: "quiz_assignment_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: assignment, error: aErr } = await admin
      .from("quiz_assignments")
      .select("id, quiz_id, student_user_id, max_attempts, deleted_at")
      .eq("id", quiz_assignment_id)
      .maybeSingle();
    if (aErr || !assignment || assignment.deleted_at) {
      return new Response(JSON.stringify({ error: "Assignment not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (assignment.student_user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { count: attemptsUsed } = await admin
      .from("quiz_attempts")
      .select("id", { count: "exact", head: true })
      .eq("quiz_assignment_id", assignment.id);
    if (assignment.max_attempts != null && (attemptsUsed ?? 0) >= assignment.max_attempts) {
      return new Response(JSON.stringify({ error: "No attempts remaining" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: quiz } = await admin
      .from("quizzes")
      .select("id, title, subject, grade, instructions, time_limit_minutes")
      .eq("id", assignment.quiz_id)
      .maybeSingle();
    if (!quiz) {
      return new Response(JSON.stringify({ error: "Quiz not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: questions } = await admin
      .from("quiz_questions")
      .select("id, number, topic, question, options")
      .eq("quiz_id", quiz.id)
      .order("number", { ascending: true });

    return new Response(JSON.stringify({
      quiz: {
        ...quiz,
        questions: questions ?? [],
        attempts_used: attemptsUsed ?? 0,
        max_attempts: assignment.max_attempts,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
