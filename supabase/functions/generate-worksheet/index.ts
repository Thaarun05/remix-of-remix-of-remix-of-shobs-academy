import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  callNimChat,
  nimErrorResponse,
  NimCallError,
  NIM_MODEL,
  NIM_LARGER_MODEL_SUGGESTION,
  type NimMessage,
} from "../_shared/nim.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Capacity flag: Llama 3.2 1B often struggles with large nested worksheet JSON.
// Do NOT auto-fallback. If parse/quality fails in prod, switch model explicitly to:
// NIM_LARGER_MODEL_SUGGESTION (meta/llama-3.1-8b-instruct).
const WORKSHEET_CAPACITY_NOTE =
  `Provider: OpenRouter (${NIM_MODEL}). If this fails repeatedly with invalid JSON, the model may be too small — switch to ${NIM_LARGER_MODEL_SUGGESTION} explicitly.`;

const SYSTEM_PROMPT = `You are an expert curriculum designer and worksheet author for Shobs Academy, an international tutoring academy.
Produce original, classroom-ready practice worksheets.

Hard rules:
- Do NOT reproduce textbook pages, past papers, or named publisher materials.
- Do NOT include URLs, scraped quotations, or copyrighted passages.
- If source material is supplied, GROUND the worksheet in it: paraphrase concepts, facts, examples, and terminology. Never copy verbatim.
- Write age-appropriate language for the stated grade/year group.
- Make prompts unambiguous, fair, and printable.
- Distribute marks sensibly; include concise teacher answers and useful workings when appropriate.
- For MCQ: exactly 4 options prefixed "A) ", "B) ", "C) ", "D) ". Put the correct letter or full answer in "answer".
- For types that do not need options, return an empty options array.
- For types that are not part_question, return an empty parts array.
- For questions without a figure, set diagram to null.
- When a figure is needed, set diagram to { kind, description, caption } using natural language only — NO coordinates, vertices arrays, or DSL.
- Use type "part_question" with a populated parts array for (a)(b)(c) style items.
- Follow the teacher's Question Instructions precisely.
- Always populate marks, difficulty, blooms_level, rubric (may be empty string), answer, and working (may be empty string).
- The question text MUST be under the exact key "prompt". Never use "question", "text" or "statement".
- Each question object looks exactly like:
  { "number": 1, "type": "short_answer", "prompt": "Work out -7 + 12.", "options": [], "parts": [], "diagram": null, "marks": 2, "difficulty": "easy", "blooms_level": "apply", "rubric": "", "answer": "5", "working": "" }
- Return ONLY a valid JSON object (no markdown fences) with keys: worksheet_title, instructions, metadata { topic_tags, estimated_minutes }, questions [].`;

const REGEN_SYSTEM_PROMPT = `You draft ONE replacement practice question for an existing Shobs Academy worksheet.
Do NOT duplicate any OTHER questions listed.
Match the requested type when specified.
If a figure is needed, set diagram to { kind, description, caption } — natural language only.
If no figure is needed, set diagram to null.
For non-MCQ, options must be []. For non-part_question, parts must be [].
Always include marks, difficulty, blooms_level, rubric, answer, working.
Return ONLY JSON: { "question": { ... } }.`;

const CHAT_REFINE_SYSTEM_PROMPT = `You are a professional worksheet editor co-pilot for Shobs Academy teachers.
Apply the teacher's request carefully and return the FULL updated worksheet plus a short assistant_reply (1–3 sentences).
Rules:
- Preserve question numbers sequentially starting at 1 after edits.
- Keep original content quality; do not invent copyrighted textbook text.
- diagram: natural-language description only or null.
- Return ONLY JSON: { "assistant_reply": string, "worksheet": { ... } }.`;

async function requireTeacher(req: Request): Promise<
  | { ok: true; userId: string; supabase: ReturnType<typeof createClient> }
  | { ok: false; response: Response }
> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims?.sub) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }
  const userId = claimsData.claims.sub as string;
  const { data: isTeacher, error: roleErr } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "teacher",
  });
  if (roleErr || !isTeacher) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "Only teachers can generate worksheets." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }
  return { ok: true, userId, supabase };
}

const PROMPT_ALIASES = ["prompt", "question", "question_text", "text", "statement", "body"];

function pickText(src: Record<string, unknown>): string {
  for (const key of PROMPT_ALIASES) {
    const v = src[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function normalizeQuestion(q: Record<string, unknown>, fallbackNumber?: number) {
  const out = { ...q };
  if (fallbackNumber != null) out.number = fallbackNumber;
  out.prompt = pickText(q);
  if (!Array.isArray(out.options)) out.options = [];
  if (!Array.isArray(out.parts)) out.parts = [];
  out.parts = (out.parts as unknown[]).map((p, i) => {
    const part = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
    return {
      ...part,
      label: typeof part.label === "string" && part.label.trim()
        ? part.label
        : String.fromCharCode(97 + i),
      prompt: pickText(part),
    };
  }).filter((p) => (p.prompt as string).length > 0);
  if (out.diagram === undefined) out.diagram = null;
  if (typeof out.answer !== "string") out.answer = String(out.answer ?? "");
  if (typeof out.working !== "string") out.working = String(out.working ?? "");
  if (typeof out.rubric !== "string") out.rubric = String(out.rubric ?? "");
  return out;
}

function normalizeWorksheet(ws: Record<string, unknown>) {
  const questions = Array.isArray(ws.questions) ? ws.questions : [];
  const cleaned = questions
    .map((q: Record<string, unknown>) => normalizeQuestion(q))
    .filter((q) => typeof q.prompt === "string" && (q.prompt as string).length > 0)
    .map((q, i) => ({ ...q, number: i + 1 }));
  return {
    ...ws,
    questions: cleaned,
    metadata: ws.metadata ?? { topic_tags: [], estimated_minutes: 30 },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await requireTeacher(req);
    if (!auth.ok) return auth.response;

    const body = await req.json();
    const mode = body?.mode ?? "full";

    if (mode === "regenerate_question") {
      const {
        worksheet_title,
        subject,
        grade,
        topic,
        difficulty,
        allowed_types,
        other_questions_summary,
        target_number,
        original_source_excerpt,
        instructions,
        target_type,
      } = body;

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
${(other_questions_summary ?? []).map((q: { number: number; type: string; prompt: string }) => `#${q.number} [${q.type}] ${q.prompt}`).join("\n")}

${original_source_excerpt ? `Source excerpt:\n${String(original_source_excerpt).slice(0, 4000)}` : ""}

Return a single replacement question with "number" = ${target_number}.`;

      const parsed = await callNimChat({
        temperature: 0.2,
        top_p: 0.7,
        max_tokens: 4096,
        messages: [
          { role: "system", content: REGEN_SYSTEM_PROMPT },
          { role: "user", content: userMsg },
        ] as NimMessage[],
      }) as { question?: Record<string, unknown> };

      const q = normalizeQuestion(parsed.question ?? (parsed as Record<string, unknown>), target_number);
      return new Response(JSON.stringify({ question: q }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (mode === "chat_refine") {
      const { message, worksheet, form_context } = body;
      if (!message || typeof message !== "string" || !String(message).trim()) {
        return new Response(JSON.stringify({ error: "Refine message is required." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!worksheet || typeof worksheet !== "object") {
        return new Response(JSON.stringify({ error: "Current worksheet is required." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const fc = form_context ?? {};
      // Keep payload smaller for 1B context limits
      const userMsg = `Form context:
Subject: ${fc.subject ?? ""}
Grade: ${fc.grade ?? ""}
Topic: ${fc.topic ?? ""}
Difficulty: ${fc.difficulty ?? ""}
Allowed types: ${(fc.types ?? []).join(", ")}
Teacher instructions: ${fc.objective ?? ""}

CURRENT WORKSHEET JSON:
${JSON.stringify(worksheet).slice(0, 24000)}

TEACHER REQUEST:
${String(message).trim()}

Return the full updated worksheet and a short assistant_reply.
(${WORKSHEET_CAPACITY_NOTE})`;

      const parsed = await callNimChat({
        temperature: 0.2,
        top_p: 0.7,
        max_tokens: 16000,
        messages: [
          { role: "system", content: CHAT_REFINE_SYSTEM_PROMPT },
          { role: "user", content: userMsg },
        ] as NimMessage[],
      }) as { assistant_reply?: string; worksheet?: Record<string, unknown> };

      const ws = normalizeWorksheet(parsed.worksheet ?? {});
      if (!Array.isArray(ws.questions) || ws.questions.length === 0) {
        return new Response(
          JSON.stringify({
            error: `Refine failed — try a clearer request. ${WORKSHEET_CAPACITY_NOTE}`,
          }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({
          assistant_reply: parsed.assistant_reply ?? "Updated the worksheet.",
          worksheet: ws,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Full generation (text-only — Llama 3.2 1B has no vision; ignore images)
    const { subject, grade, topic, count, difficulty, types, objective, text, images } = body;
    if (!subject || !grade || !topic || !Array.isArray(types) || types.length === 0) {
      return new Response(
        JSON.stringify({ error: "Subject, grade, topic and at least one question type are required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const imgCount = Array.isArray(images) ? images.length : 0;
    const qCount = Math.max(1, Math.min(Number(count) || 10, 60));
    const BATCH_SIZE = 10;

    const buildUserText = (
      n: number,
      batch?: { start: number; end: number; index: number; total: number; priorPrompts: string[] },
    ) => `Create an original Shobs Academy practice worksheet.
Subject: ${subject}
Grade / Year group: ${grade}
Topic: ${topic}
Number of questions: ${n}
Difficulty progression: ${difficulty}
Allowed question types: ${types.join(", ")}
${objective ? `Question Instructions from teacher (follow precisely):\n${objective}` : ""}
${batch
      ? `\nThis is BATCH ${batch.index} of ${batch.total} for a ${qCount}-question worksheet.
Produce EXACTLY ${n} questions covering worksheet positions ${batch.start}–${batch.end}.
Number them ${batch.start} through ${batch.end}.
Position them correctly within the "${difficulty}" difficulty ramp across the whole ${qCount}-question sheet.
${batch.priorPrompts.length
        ? `Do NOT repeat or paraphrase any of these questions already written:\n${batch.priorPrompts.map((p, i) => `- ${p}`).join("\n").slice(0, 6000)}`
        : ""}`
      : ""}

Distribute questions across the allowed types. Number them sequentially starting at 1.
Always include a concise teacher "answer". Include a diagram object whenever figures are needed.
Use part_question with parts when the teacher asks for (a)(b)(c). Include "working" when asked.
${text && String(text).trim()
      ? `\nSource text / extracted PDF text (paraphrase — do not copy verbatim):\n${String(text).slice(0, 12000)}`
      : ""}
${imgCount
      ? `\nNote: ${imgCount} image(s) were uploaded but are ignored — ${NIM_MODEL} is text-only. Use extracted text only.`
      : ""}

Return ONLY the worksheet JSON object.
(${WORKSHEET_CAPACITY_NOTE})`;

    const runGeneration = (n: number, batch?: Parameters<typeof buildUserText>[1]) =>
      callNimChat({
        temperature: 0.2,
        top_p: 0.7,
        max_tokens: 16000,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserText(n, batch) },
        ] as NimMessage[],
      }) as Promise<Record<string, unknown>>;

    const warnings: string[] = [];

    // --- Single-shot path (<= BATCH_SIZE) -------------------------------
    let mergedQuestions: Record<string, unknown>[] = [];
    let shell: Record<string, unknown> = {};

    if (qCount <= BATCH_SIZE) {
      let parsed: Record<string, unknown>;
      try {
        parsed = await runGeneration(qCount);
      } catch (err) {
        if (err instanceof NimCallError && err.code === "truncated" && qCount > 5) {
          const reduced = Math.max(5, Math.floor(qCount / 2));
          console.warn(`Worksheet truncated at ${qCount} questions — retrying with ${reduced}.`);
          parsed = await runGeneration(reduced);
          warnings.push(`Only ${reduced} questions could be generated — the response ran out of room.`);
        } else {
          throw err;
        }
      }
      shell = parsed;
      mergedQuestions = Array.isArray(parsed.questions) ? parsed.questions as Record<string, unknown>[] : [];
    } else {
      // --- Batched path -------------------------------------------------
      const batchCount = Math.ceil(qCount / BATCH_SIZE);
      const plans = Array.from({ length: batchCount }, (_, i) => {
        const start = i * BATCH_SIZE + 1;
        const end = Math.min(qCount, start + BATCH_SIZE - 1);
        return { index: i + 1, total: batchCount, start, end, size: end - start + 1 };
      });

      const results: (Record<string, unknown> | null)[] = new Array(batchCount).fill(null);
      const promptsSoFar: string[] = [];

      const runPlan = async (planIdx: number) => {
        const plan = plans[planIdx];
        const batchArg = {
          start: plan.start,
          end: plan.end,
          index: plan.index,
          total: plan.total,
          priorPrompts: [...promptsSoFar],
        };
        let parsed: Record<string, unknown> | null = null;
        try {
          parsed = await runGeneration(plan.size, batchArg);
        } catch (err) {
          if (err instanceof NimCallError && (err.code === "truncated" || err.code === "parse")) {
            const half = Math.max(3, Math.floor(plan.size / 2));
            console.warn(`Batch ${plan.index} failed (${err.code}) — retrying with ${half} questions.`);
            try {
              parsed = await runGeneration(half, { ...batchArg, end: plan.start + half - 1 });
              warnings.push(`Batch ${plan.index} produced ${half} of ${plan.size} questions.`);
            } catch (err2) {
              console.error(`Batch ${plan.index} retry failed`, err2);
              warnings.push(`Batch ${plan.index} could not be generated.`);
              parsed = null;
            }
          } else {
            throw err;
          }
        }
        results[planIdx] = parsed;
        const qs = Array.isArray(parsed?.questions) ? parsed!.questions as Record<string, unknown>[] : [];
        for (const q of qs) {
          const p = typeof q?.prompt === "string" ? q.prompt : "";
          if (p) promptsSoFar.push(p.slice(0, 180));
        }
      };

      // Concurrency 2
      let pointer = 0;
      const workers = Array.from({ length: Math.min(2, batchCount) }, async () => {
        while (pointer < batchCount) {
          const my = pointer++;
          await runPlan(my);
        }
      });
      await Promise.all(workers);

      shell = results.find((r) => r && (r.worksheet_title || r.instructions)) ?? results[0] ?? {};
      for (const r of results) {
        if (!r) continue;
        const qs = Array.isArray(r.questions) ? r.questions as Record<string, unknown>[] : [];
        mergedQuestions.push(...qs);
      }
      if (mergedQuestions.length && mergedQuestions.length < qCount) {
        warnings.push(`${mergedQuestions.length} of ${qCount} questions were generated.`);
      }
    }

    const worksheet = normalizeWorksheet({ ...shell, questions: mergedQuestions });
    if (!Array.isArray(worksheet.questions) || worksheet.questions.length === 0) {
      return new Response(
        JSON.stringify({
          error: `Generation failed — try a more specific topic or fewer questions. ${WORKSHEET_CAPACITY_NOTE}`,
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ worksheet, warnings }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (e instanceof NimCallError) return nimErrorResponse(e, corsHeaders);
    console.error(e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
