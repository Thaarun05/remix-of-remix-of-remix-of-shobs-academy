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
      "type": "mcq" | "short_answer" | "fill_blank" | "numerical" | "true_false",
      "prompt": string,
      "options": ["A)...", "B)...", "C)...", "D)..."],
      "answer": string
    }
  ]
}`;

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
Difficulty: ${difficulty}
Allowed question types: ${types.join(", ")}
${objective ? `Learning objective: ${objective}` : ""}

Distribute questions across the allowed types. Number them sequentially starting at 1. For mcq include exactly 4 options prefixed "A) ", "B) ", "C) ", "D) ". For non-mcq, omit options or return empty array. Always include a concise "answer" for the teacher.`;

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