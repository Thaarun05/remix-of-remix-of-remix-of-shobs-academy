import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SCHEMA_ADDENDUM = `
Every question object MUST also include:
  "marks": number (positive integer),
  "difficulty": "easy" | "medium" | "hard",
  "blooms_level": "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create",
  "rubric": string (short marking guidance; may be empty string).
The top-level object MUST include:
  "metadata": { "topic_tags": string[], "estimated_minutes": number }.

For any question that needs a figure, set "diagram" to { "kind": "geometry_2d" | "coordinate_graph" | "number_line", "description": string, "caption": string }.
DO NOT include coordinates, spec, points, vertices, or DSL — only natural-language description of the intended figure. A separate step will convert this description into a strict spec.`;

const SYSTEM_PROMPT = `You are drafting original practice worksheet questions for academy students.
Do NOT reproduce any content from textbooks, past papers, or named publishers.
Do NOT include URLs, quotations, or scraped text.
If source material (pasted text or uploaded images/PDF pages) is supplied, GROUND the worksheet in it — paraphrase and adapt concepts, facts, examples and terminology from the source. Do not copy verbatim.
Return ONLY a valid JSON object — no markdown, no explanation, no backticks.

Schema:
{
  "worksheet_title": string,
  "instructions": string,
  "metadata": { "topic_tags": string[], "estimated_minutes": number },
  "questions": [
    {
      "number": number,
      "type": "mcq" | "short_answer" | "fill_blank" | "numerical" | "true_false" | "diagram" | "part_question",
      "prompt": string,
      "parts": [{ "label": "a", "prompt": string, "marks": number, "answer": string }],
      "options": ["A)...", "B)...", "C)...", "D)..."],
      "diagram": {
        "kind": "geometry_2d" | "coordinate_graph" | "number_line",
        "description": string,
        "caption": string
      },
      "marks": number,
      "difficulty": "easy" | "medium" | "hard",
      "blooms_level": "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create",
      "rubric": string,
      "answer": string,
      "working": string
    }
  ]
}
${SCHEMA_ADDENDUM}
If the teacher requests part marks or part questions (a)(b)(c) style, use type "part_question" and populate the "parts" array.
If the teacher requests workings or step-by-step solutions, populate the "working" field in each question and answer key.
Always read the teacher's Question Instructions carefully and follow them precisely for question style, format, and depth.
Difficulty progression options like "Easy to Hard" mean order questions from easy to hard across the worksheet; "Easy only" means all questions easy, etc.`;

const REGEN_SYSTEM_PROMPT = `You are drafting ONE replacement practice question for an existing worksheet.
Return ONLY a valid JSON object with a single field "question" whose value follows the same per-question schema used elsewhere.
The question object MUST include: number, type, prompt, marks, difficulty, blooms_level, rubric, and (when relevant) options, parts, diagram, answer, working.
Do NOT reference or duplicate any of the OTHER questions listed. Match the requested type when specified.
If a figure is needed, output diagram as { kind, description, caption } — natural language only, no DSL/coordinates.`;

async function callGateway(messages: any[], apiKey: string) {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai/gpt-5-mini",
      messages,
      response_format: { type: "json_object" },
    }),
  });
  return resp;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth: verify caller is a teacher.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claimsData.claims.sub as string;
    const { data: isTeacher, error: roleErr } = await supabase.rpc("has_role", { _user_id: userId, _role: "teacher" });
    if (roleErr || !isTeacher) {
      return new Response(JSON.stringify({ error: "Only teachers can generate worksheets." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const mode = body?.mode ?? "full";
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    if (mode === "regenerate_question") {
      const { worksheet_title, subject, grade, topic, difficulty, allowed_types, other_questions_summary, target_number, original_source_excerpt, instructions, target_type } = body;
      const userMsg = `Worksheet context:
Title: ${worksheet_title ?? ""}
Subject: ${subject ?? ""}
Grade: ${grade ?? ""}
Topic: ${topic ?? ""}
Difficulty progression: ${difficulty ?? ""}
Allowed question types: ${(allowed_types ?? []).join(", ")}
Target question number: ${target_number}
${target_type ? `Requested type: ${target_type}` : ""}
${instructions ? `Teacher instructions: ${instructions}` : ""}

OTHER existing questions (do NOT duplicate any of these prompts):
${(other_questions_summary ?? []).map((q: any) => `#${q.number} [${q.type}] ${q.prompt}`).join("\n")}

${original_source_excerpt ? `Source excerpt:\n${original_source_excerpt.slice(0, 6000)}` : ""}

Return JSON: { "question": { ...single question object per schema... } } with "number" = ${target_number}.`;
      const resp = await callGateway([
        { role: "system", content: REGEN_SYSTEM_PROMPT },
        { role: "user", content: userMsg },
      ], LOVABLE_API_KEY);
      if (!resp.ok) {
        const t = await resp.text();
        console.error("AI gateway error (regen)", resp.status, t);
        if (resp.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (resp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in workspace settings." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const data = await resp.json();
      const content = data.choices?.[0]?.message?.content ?? "";
      let parsed;
      try { parsed = JSON.parse(content); } catch {
        return new Response(JSON.stringify({ error: "Regeneration failed — try again." }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const q = parsed.question ?? parsed;
      if (q && typeof q === "object") q.number = target_number;
      return new Response(JSON.stringify({ question: q }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Full generation
    const { subject, grade, topic, count, difficulty, types, objective, text, images } = body;
    const imgs: string[] = Array.isArray(images) ? images.filter((s: unknown) => typeof s === "string" && (s as string).startsWith("data:")) : [];

    const userMsg = `Create an original practice worksheet.
Subject: ${subject}
Grade / Year group: ${grade}
Topic: ${topic}
Number of questions: ${count}
Difficulty progression: ${difficulty}
Allowed question types: ${types.join(", ")}
${objective ? `Question Instructions from teacher (follow precisely):\n${objective}` : ""}

Distribute questions across the allowed types. Number them sequentially starting at 1. For mcq include exactly 4 options prefixed "A) ", "B) ", "C) ", "D) ". For non-mcq, omit options or return empty array. Always include a concise "answer" for the teacher. Include a "diagram" object whenever the teacher's instructions ask for shapes/graphs/figures. Use type "part_question" with a populated "parts" array when teacher asks for (a)(b)(c) style part marks. Include "working" with step-by-step workings when teacher asks for workings.
${text && String(text).trim() ? `\nSource text / extracted PDF text (ground the worksheet in this material, paraphrase — do not copy verbatim):\n${text}` : ""}
${imgs.length ? `\n${imgs.length} image(s) of source material are attached — read them carefully (slides, handwritten notes, textbook pages, diagrams) and use them as source material.` : ""}`;

    const userContent: any[] = [{ type: "text", text: userMsg }];
    for (const url of imgs) userContent.push({ type: "image_url", image_url: { url } });

    const resp = await callGateway([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ], LOVABLE_API_KEY);

    if (!resp.ok) {
      const text = await resp.text();
      console.error("AI gateway error", resp.status, text);
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in workspace settings." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      return new Response(JSON.stringify({ error: "Generation failed — try a more specific topic." }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ worksheet: parsed }), {
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