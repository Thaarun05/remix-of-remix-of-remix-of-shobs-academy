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

const buildSystemPrompt = (includeExplanations: boolean) => `You are an expert MCQ quiz author for Shobs Academy.
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
      "explanation": string${includeExplanations ? "" : "  // ALWAYS an empty string \"\""}
    }
  ]
}

Rules:
- Exactly 4 options per question, each prefixed "A) ", "B) ", "C) ", "D) ".
- correct_option must be one of "A","B","C","D" matching one option exactly.
${includeExplanations
  ? '- explanation: 1-3 sentences explaining why the correct answer is right.'
  : '- explanation: MUST be an empty string "". Do not explain anything.'}
- Mix difficulty per the difficulty input (e.g. "easy to hard" = progression).
- Honour the teacher's Instructions precisely if provided.`;

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
    const { subject, grade, topics, count, difficulty, text, images, instructions, include_explanations } =
      await req.json();

    const imgCount = Array.isArray(images) ? images.length : 0;
    const includeExplanations = include_explanations !== false;
    const requested = Math.max(1, Math.min(Number(count) || 10, 50));

    const buildUserText = (qCount: number) => `Create an MCQ quiz from the inputs below.
Subject: ${subject || "(unspecified)"}
Grade / Year group: ${grade || "(unspecified)"}
Topics: ${topics || "(unspecified)"}
Number of questions: ${qCount}
Difficulty: ${difficulty || "medium"}
${instructions ? `Teacher Instructions (follow precisely):\n${instructions}\n` : ""}
${text ? `\nSource text / extracted PDF text:\n${String(text).slice(0, 12000)}` : ""}
${imgCount ? `\nNote: ${imgCount} image(s) ignored — ${NIM_MODEL} is text-only.` : ""}

Return ONLY the quiz JSON object.
(Provider: OpenRouter ${NIM_MODEL}. If JSON fails often, switch explicitly to ${NIM_LARGER_MODEL_SUGGESTION}.)`;

    const systemPrompt = buildSystemPrompt(includeExplanations);
    const runOnce = (qCount: number) =>
      callNimChat({
        temperature: 0.2,
        top_p: 0.7,
        max_tokens: 60000,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: buildUserText(qCount) },
        ],
      });

    let parsed: unknown;
    try {
      parsed = await runOnce(requested);
    } catch (err) {
      // If the response was cut off, retry once with half the questions.
      const retryCount = Math.max(1, Math.floor(requested / 2));
      if (err instanceof NimCallError && err.code === "truncated" && retryCount < requested) {
        parsed = await runOnce(retryCount);
      } else {
        throw err;
      }
    }

    if (!includeExplanations && parsed && typeof parsed === "object") {
      const qs = (parsed as { questions?: Array<Record<string, unknown>> }).questions;
      if (Array.isArray(qs)) for (const q of qs) q.explanation = "";
    }

    return new Response(JSON.stringify({ quiz: parsed }), {
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
