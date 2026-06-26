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

    const { quiz_assignment_id, answers } = await req.json();
    if (!quiz_assignment_id || typeof answers !== "object") {
      return new Response(JSON.stringify({ error: "Invalid body" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: assignment } = await admin
      .from("quiz_assignments")
      .select("id, quiz_id, student_user_id, teacher_user_id, max_attempts, deleted_at")
      .eq("id", quiz_assignment_id)
      .maybeSingle();
    if (!assignment || assignment.deleted_at) {
      return new Response(JSON.stringify({ error: "Assignment not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (assignment.student_user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { count: existing } = await admin
      .from("quiz_attempts")
      .select("id", { count: "exact", head: true })
      .eq("quiz_assignment_id", assignment.id);
    const used = existing ?? 0;
    if (assignment.max_attempts != null && used >= assignment.max_attempts) {
      return new Response(JSON.stringify({ error: "No attempts remaining" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const attempt_number = used + 1;

    const { data: quiz } = await admin
      .from("quizzes")
      .select("id, title")
      .eq("id", assignment.quiz_id)
      .maybeSingle();

    const { data: questions } = await admin
      .from("quiz_questions")
      .select("id, number, question, options, correct_option, explanation")
      .eq("quiz_id", assignment.quiz_id)
      .order("number", { ascending: true });

    const qs = questions ?? [];
    let score = 0;
    const results = qs.map((q: any) => {
      const selected = (answers as Record<string, string>)[q.id] ?? null;
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
      };
    });
    const total = qs.length;

    const { error: insErr } = await admin.from("quiz_attempts").insert({
      quiz_assignment_id: assignment.id,
      student_user_id: user.id,
      attempt_number,
      answers,
      results,
      score,
      total,
    });
    if (insErr) {
      console.error("insert attempt failed", insErr);
      return new Response(JSON.stringify({ error: insErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await admin.from("notifications").insert({
      recipient_id: assignment.teacher_user_id,
      sender_id: user.id,
      type: "quiz_completed",
      title: "Quiz completed",
      body: `A student scored ${score}/${total} on "${quiz?.title ?? "your quiz"}" (attempt ${attempt_number}).`,
      role_target: "teacher",
      entity_table: "quiz_assignments",
      entity_id: assignment.id,
    });

    return new Response(JSON.stringify({ score, total, results, attempt_number }), {
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
