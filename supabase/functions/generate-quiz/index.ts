import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are an expert MCQ quiz author for Shobs Academy.
Generate ORIGINAL multiple-choice questions. Do NOT copy verbatim from source material; paraphrase.
Return ONLY a valid JSON object — no markdown, no backticks, no commentary.

Schema:
{
  "title": string,
  "subject": string,
  "grade": string,
  "instructions": string,
  "questions": [
    {
      "number": integer,
      "topic": string,
      "difficulty": "easy" | "medium" | "hard",
      "question": string,
      "options": [string, string, string, string],
      "correct_option": "A" | "B" | "C" | "D",
      "explanation": string
    }
  ]
}

Rules:
- Exactly 4 options per question, each prefixed "A) ", "B) ", "C) ", "D) ".
- correct_option must be one of "A","B","C","D" matching one option exactly.
- explanation: 1-3 sentences explaining why the correct answer is right.
- Mix difficulty per the difficulty input (e.g. "easy to hard" = progression).
- Honour the teacher's Instructions precisely if provided.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { subject, grade, topics, count, difficulty, text, images, instructions } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const imgs: string[] = Array.isArray(images) ? images.filter((s) => typeof s === "string" && s.startsWith("data:")) : [];

    const userText = `Create an MCQ quiz from the inputs below.
Subject: ${subject || "(unspecified)"}
Grade / Year group: ${grade || "(unspecified)"}
Topics: ${topics || "(unspecified)"}
Number of questions: ${count || 10}
Difficulty: ${difficulty || "medium"}
${instructions ? `Teacher Instructions (follow precisely):\n${instructions}\n` : ""}
${text ? `\nSource text / extracted PDF text:\n${text}` : ""}
${imgs.length ? `\n${imgs.length} image(s) of source material attached — read them carefully.` : ""}`;

    const userContent: any[] = [{ type: "text", text: userText }];
    for (const url of imgs) userContent.push({ type: "image_url", image_url: { url } });

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
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway error", resp.status, t);
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
      return new Response(JSON.stringify({ error: "Generation failed — try clearer source material." }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ quiz: parsed }), {
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
