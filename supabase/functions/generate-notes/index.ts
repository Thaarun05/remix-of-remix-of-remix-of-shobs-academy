import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUser, requireRole } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are an academic note-taker for students at Shobs Academy.
Turn the supplied lecture material (text and/or images of slides, handwriting, textbook pages) into ORIGINAL, concise, well-structured study notes.
Do NOT copy verbatim from any source. Paraphrase, organise, and clarify.
Return ONLY a valid JSON object — no markdown, no backticks, no commentary.

Schema:
{
  "title": string,
  "subject": string,
  "grade": string,
  "summary": string,
  "sections": [
    {
      "heading": string,
      "bullets": string[],
      "key_terms": [{ "term": string, "definition": string }],
      "formulas": string[]
    }
  ],
  "quick_revision": string[]
}

Rules:
- Produce 3-8 sections depending on material depth.
- Each section: 3-8 bullets, plain student-friendly language.
- key_terms: 0-6 per section; only include genuinely important vocabulary.
- formulas: include only if the topic is quantitative; otherwise return an empty array.
- quick_revision: 5-10 punchy one-line takeaways for last-minute review.
- summary: 2-4 sentences capturing the whole topic.
- Follow the teacher's Instructions precisely if provided (tone, depth, focus areas).`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authRes = await requireUser(req);
    if (authRes instanceof Response) {
      const h = new Headers(authRes.headers); Object.entries(corsHeaders).forEach(([k,v])=>h.set(k,v));
      return new Response(await authRes.text(), { status: authRes.status, headers: h });
    }
    const forbid = requireRole(authRes, ["teacher", "admin"]);
    if (forbid) {
      const h = new Headers(forbid.headers); Object.entries(corsHeaders).forEach(([k,v])=>h.set(k,v));
      return new Response(await forbid.text(), { status: forbid.status, headers: h });
    }
    const { subject, grade, topic, text, images, instructions } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const imgs: string[] = Array.isArray(images) ? images.filter((s) => typeof s === "string" && s.startsWith("data:")) : [];

    const userText = `Create original study notes from the material below.
Subject: ${subject || "(unspecified)"}
Grade / Year group: ${grade || "(unspecified)"}
Topic: ${topic || "(unspecified)"}
${instructions ? `Teacher Instructions (follow precisely):\n${instructions}\n` : ""}
${text ? `\nLecture text / extracted PDF text:\n${text}` : ""}
${imgs.length ? `\n${imgs.length} image(s) of source material are attached — read them carefully (slides, handwritten notes, textbook pages, diagrams).` : ""}`;

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

    return new Response(JSON.stringify({ notes: parsed }), {
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