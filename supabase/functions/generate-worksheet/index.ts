import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  callOpenAI,
  openAIErrorResponse,
  OpenAICallError,
  type OpenAIMessage,
} from "../_shared/openai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL_WORKSHEET = "google/gemini-3.6-flash";

const QUESTION_TYPE_ENUM = [
  "mcq",
  "short_answer",
  "fill_blank",
  "numerical",
  "true_false",
  "diagram",
  "part_question",
] as const;

const partSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    label: { type: "string" },
    prompt: { type: "string" },
    marks: { type: "number" },
    answer: { type: "string" },
  },
  required: ["label", "prompt", "marks", "answer"],
};

const diagramSchema = {
  type: ["object", "null"],
  additionalProperties: false,
  properties: {
    kind: { type: "string", enum: ["geometry_2d", "coordinate_graph", "number_line"] },
    description: { type: "string" },
    caption: { type: "string" },
  },
  required: ["kind", "description", "caption"],
};

const questionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    number: { type: "number" },
    type: { type: "string", enum: [...QUESTION_TYPE_ENUM] },
    prompt: { type: "string" },
    options: {
      type: "array",
      items: { type: "string" },
    },
    answer: { type: "string" },
    parts: {
      type: "array",
      items: partSchema,
    },
    diagram: diagramSchema,
    marks: { type: "number" },
    difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
    blooms_level: {
      type: "string",
      enum: ["remember", "understand", "apply", "analyze", "evaluate", "create"],
    },
    rubric: { type: "string" },
    working: { type: "string" },
  },
  required: [
    "number",
    "type",
    "prompt",
    "options",
    "answer",
    "parts",
    "diagram",
    "marks",
    "difficulty",
    "blooms_level",
    "rubric",
    "working",
  ],
};

const worksheetSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    worksheet_title: { type: "string" },
    instructions: { type: "string" },
    metadata: {
      type: "object",
      additionalProperties: false,
      properties: {
        topic_tags: { type: "array", items: { type: "string" } },
        estimated_minutes: { type: "number" },
      },
      required: ["topic_tags", "estimated_minutes"],
    },
    questions: {
      type: "array",
      items: questionSchema,
    },
  },
  required: ["worksheet_title", "instructions", "metadata", "questions"],
};

const fullResponseSchema = {
  name: "worksheet_payload",
  description: "A complete original Shobs Academy practice worksheet",
  strict: true,
  schema: worksheetSchema,
};

const regenResponseSchema = {
  name: "regen_question_payload",
  description: "A single replacement worksheet question",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      question: questionSchema,
    },
    required: ["question"],
  },
};

const chatRefineResponseSchema = {
  name: "chat_refine_payload",
  description: "Refined worksheet plus short assistant reply for the teacher",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      assistant_reply: { type: "string" },
      worksheet: worksheetSchema,
    },
    required: ["assistant_reply", "worksheet"],
  },
};

const SYSTEM_PROMPT = `You are an expert curriculum designer and worksheet author for Shobs Academy, an international tutoring academy.
Produce original, classroom-ready practice worksheets with ChatGPT-class clarity, variety, and pedagogical quality.

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
- When a figure is needed, set diagram to { kind, description, caption } using natural language only — NO coordinates, vertices arrays, or DSL. A later step converts description → drawable spec.
- Use type "part_question" with a populated parts array for (a)(b)(c) style items.
- Follow the teacher's Question Instructions precisely for style, depth, workings, and diagrams.
- Difficulty progression (e.g. "Easy to Hard") controls ordering across the sheet; "Easy only" means all easy, etc.
- Always populate marks, difficulty, blooms_level, rubric (may be empty string), answer, and working (may be empty string).`;

const REGEN_SYSTEM_PROMPT = `You draft ONE replacement practice question for an existing Shobs Academy worksheet.
Match pedagogical quality to a professional ChatGPT worksheet author.
Do NOT duplicate any OTHER questions listed.
Match the requested type when specified.
If a figure is needed, set diagram to { kind, description, caption } — natural language only, no DSL/coordinates.
If no figure is needed, set diagram to null.
For non-MCQ, options must be []. For non-part_question, parts must be [].
Always include marks, difficulty, blooms_level, rubric, answer, working.`;

const CHAT_REFINE_SYSTEM_PROMPT = `You are a professional worksheet editor co-pilot for Shobs Academy teachers (ChatGPT-style refine).
The teacher sends a natural-language request about the CURRENT worksheet JSON.
Apply their request carefully and return the FULL updated worksheet plus a short assistant_reply (1–3 sentences) describing what you changed.
Rules:
- Preserve question numbers sequentially starting at 1 after edits.
- Keep Shobs Academy quality: original content, clear prompts, fair marks, useful answers/workings.
- Do not invent copyrighted textbook text.
- If they ask to harden/simplify, adjust difficulty, blooms_level, and wording accordingly.
- If they ask to add questions, append and renumber.
- If they ask to remove questions, drop them and renumber.
- diagram field: natural-language description only or null — never embed coordinate DSL.
- Follow the same JSON field conventions as generation (empty options/parts arrays when unused).`;

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

function normalizeQuestion(q: Record<string, unknown>, fallbackNumber?: number) {
  const out = { ...q };
  if (fallbackNumber != null) out.number = fallbackNumber;
  if (!Array.isArray(out.options)) out.options = [];
  if (!Array.isArray(out.parts)) out.parts = [];
  if (out.diagram === undefined) out.diagram = null;
  if (typeof out.answer !== "string") out.answer = String(out.answer ?? "");
  if (typeof out.working !== "string") out.working = String(out.working ?? "");
  if (typeof out.rubric !== "string") out.rubric = String(out.rubric ?? "");
  return out;
}

function normalizeWorksheet(ws: Record<string, unknown>) {
  const questions = Array.isArray(ws.questions) ? ws.questions : [];
  return {
    ...ws,
    questions: questions.map((q: Record<string, unknown>, i: number) =>
      normalizeQuestion(q, i + 1)
    ),
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

${original_source_excerpt ? `Source excerpt:\n${String(original_source_excerpt).slice(0, 6000)}` : ""}

Return a single replacement question with "number" = ${target_number}.`;

      const parsed = await callOpenAI({
        model: MODEL_WORKSHEET,
        temperature: 0.75,
        jsonSchema: regenResponseSchema,
        messages: [
          { role: "system", content: REGEN_SYSTEM_PROMPT },
          { role: "user", content: userMsg },
        ],
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
      const userMsg = `Form context:
Subject: ${fc.subject ?? ""}
Grade: ${fc.grade ?? ""}
Topic: ${fc.topic ?? ""}
Difficulty: ${fc.difficulty ?? ""}
Allowed types: ${(fc.types ?? []).join(", ")}
Teacher instructions: ${fc.objective ?? ""}

CURRENT WORKSHEET JSON:
${JSON.stringify(worksheet).slice(0, 100000)}

TEACHER REQUEST:
${String(message).trim()}

Return the full updated worksheet and a short assistant_reply.`;

      const parsed = await callOpenAI({
        model: MODEL_WORKSHEET,
        temperature: 0.55,
        jsonSchema: chatRefineResponseSchema,
        messages: [
          { role: "system", content: CHAT_REFINE_SYSTEM_PROMPT },
          { role: "user", content: userMsg },
        ],
      }) as { assistant_reply?: string; worksheet?: Record<string, unknown> };

      const ws = normalizeWorksheet(parsed.worksheet ?? {});
      if (!Array.isArray(ws.questions) || ws.questions.length === 0) {
        return new Response(JSON.stringify({ error: "Refine failed — try a clearer request." }), {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          assistant_reply: parsed.assistant_reply ?? "Updated the worksheet.",
          worksheet: ws,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Full generation
    const { subject, grade, topic, count, difficulty, types, objective, text, images } = body;
    if (!subject || !grade || !topic || !Array.isArray(types) || types.length === 0) {
      return new Response(
        JSON.stringify({ error: "Subject, grade, topic and at least one question type are required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const imgs: string[] = Array.isArray(images)
      ? images.filter((s: unknown) => typeof s === "string" && (s as string).startsWith("data:"))
      : [];

    const userText = `Create an original Shobs Academy practice worksheet.
Subject: ${subject}
Grade / Year group: ${grade}
Topic: ${topic}
Number of questions: ${count}
Difficulty progression: ${difficulty}
Allowed question types: ${types.join(", ")}
${objective ? `Question Instructions from teacher (follow precisely):\n${objective}` : ""}

Distribute questions across the allowed types. Number them sequentially starting at 1.
Always include a concise teacher "answer". Include a diagram object whenever figures are needed.
Use part_question with parts when the teacher asks for (a)(b)(c). Include "working" with step-by-step solutions when asked.
${text && String(text).trim()
      ? `\nSource text / extracted PDF text (ground the worksheet in this material, paraphrase — do not copy verbatim):\n${String(text).slice(0, 24000)}`
      : ""}
${imgs.length
      ? `\n${imgs.length} image(s) of source material are attached — read them carefully and use them as source material.`
      : ""}`;

    const userContent: OpenAIMessage["content"] = [{ type: "text", text: userText }];
    for (const url of imgs.slice(0, 8)) {
      (userContent as Array<{ type: string; text?: string; image_url?: { url: string } }>).push({
        type: "image_url",
        image_url: { url },
      });
    }

    const parsed = await callOpenAI({
      model: MODEL_WORKSHEET,
      temperature: 0.7,
      jsonSchema: fullResponseSchema,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    }) as Record<string, unknown>;

    const worksheet = normalizeWorksheet(parsed);
    if (!Array.isArray(worksheet.questions) || worksheet.questions.length === 0) {
      return new Response(
        JSON.stringify({ error: "Generation failed — try a more specific topic." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ worksheet }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (e instanceof OpenAICallError) return openAIErrorResponse(e, corsHeaders);
    console.error(e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
