import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are drafting original practice worksheet questions for academy students.
Do NOT reproduce any content from textbooks, past papers, or named publishers.
Do NOT include URLs, quotations, or scraped text.
Return ONLY a valid JSON object — no markdown, no explanation, no backticks.

Schema:
{
  "worksheet_title": string,
  "instructions": string,
  "questions": [
    {
      "number": number,
      "type": "mcq" | "short_answer" | "fill_blank" | "numerical" | "true_false" | "diagram" | "part_question",
      "prompt": string,
      "parts": [{ "label": "a", "prompt": string, "marks": number, "answer": string }],
      "options": ["A)...", "B)...", "C)...", "D)..."],
      "diagram": {
        "type": "triangle" | "circle" | "graph_axes" | "right_angle_triangle" | "number_line" | "bar_chart" | "pie_chart" | "geometric_shape",
        "labels": { "key": "value" },
        "dimensions": { "key": "value" },
        "instructions": string
      },
      "marks": number,
      "answer": string,
      "working": string
    }
  ]
}

If the teacher's instructions mention diagrams, triangles, graphs, constructions, or geometric shapes,
include a "diagram" object in the relevant question with the shape type and all labels/dimensions needed to draw it.
If the teacher requests part marks or part questions (a)(b)(c) style, use type "part_question" and populate the "parts" array.
If the teacher requests workings or step-by-step solutions, populate the "working" field in each question and answer key.
Always read the teacher's Question Instructions carefully and follow them precisely for question style, format, and depth.
Difficulty progression options like "Easy to Hard" mean order questions from easy to hard across the worksheet; "Easy only" means all questions easy, etc.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { subject, grade, topic, count, difficulty, types, objective } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const userMsg = `Create an original practice worksheet.
Subject: ${subject}
Grade / Year group: ${grade}
Topic: ${topic}
Number of questions: ${count}
Difficulty progression: ${difficulty}
Allowed question types: ${types.join(", ")}
${objective ? `Question Instructions from teacher (follow precisely):\n${objective}` : ""}

Distribute questions across the allowed types. Number them sequentially starting at 1. For mcq include exactly 4 options prefixed "A) ", "B) ", "C) ", "D) ". For non-mcq, omit options or return empty array. Always include a concise "answer" for the teacher. Include a "diagram" object whenever the teacher's instructions ask for shapes/graphs/figures. Use type "part_question" with a populated "parts" array when teacher asks for (a)(b)(c) style part marks. Include "working" with step-by-step workings when teacher asks for workings.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMsg },
        ],
        response_format: { type: "json_object" },
      }),
    });

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