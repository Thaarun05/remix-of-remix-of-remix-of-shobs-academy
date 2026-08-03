import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUser, requireRole } from "../_shared/auth.ts";
import {
  callNimChat,
  nimErrorResponse,
  NimCallError,
  NIM_MODEL,
  NIM_LARGER_MODEL_SUGGESTION,
} from "../_shared/nim.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are an academic note-taker for students at Shobs Academy.
Turn the supplied lecture material into ORIGINAL, concise, well-structured study notes.
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
      const h = new Headers(authRes.headers); Object.entries(corsHeaders).forEach(([k, v]) => h.set(k, v));
      return new Response(await authRes.text(), { status: authRes.status, headers: h });
    }
    const forbid = requireRole(authRes, ["teacher", "admin"]);
    if (forbid) {
      const h = new Headers(forbid.headers); Object.entries(corsHeaders).forEach(([k, v]) => h.set(k, v));
      return new Response(await forbid.text(), { status: forbid.status, headers: h });
    }
    const { subject, grade, topic, text, images, instructions } = await req.json();

    const imgCount = Array.isArray(images) ? images.length : 0;

    const userText = `Create original study notes from the material below.
Subject: ${subject || "(unspecified)"}
Grade / Year group: ${grade || "(unspecified)"}
Topic: ${topic || "(unspecified)"}
${instructions ? `Teacher Instructions (follow precisely):\n${instructions}\n` : ""}
${text ? `\nLecture text / extracted PDF text:\n${String(text).slice(0, 12000)}` : ""}
${imgCount ? `\nNote: ${imgCount} image(s) ignored — ${NIM_MODEL} is text-only. Prefer pasted/extracted text.` : ""}

Return ONLY the notes JSON object.
(Provider: NVIDIA NIM ${NIM_MODEL}. If JSON fails often, switch explicitly to ${NIM_LARGER_MODEL_SUGGESTION}.)`;

    const parsed = await callNimChat({
      temperature: 0.2,
      top_p: 0.7,
      max_tokens: 4096,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userText },
      ],
    });

    return new Response(JSON.stringify({ notes: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (e instanceof NimCallError) return nimErrorResponse(e, corsHeaders);
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
