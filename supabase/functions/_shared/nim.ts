/**
 * Shared AI chat helper for Supabase Edge Functions.
 * Routes through the Lovable AI Gateway (OpenAI-compatible) using LOVABLE_API_KEY.
 * Model: google/gemini-3.6-flash
 *
 * Exported names keep their historical "Nim" prefix so existing call sites
 * (generate-worksheet / -quiz / -notes / -diagram-spec) work unchanged.
 */

import OpenAI from "https://esm.sh/openai@4.73.0";

export const NIM_MODEL = "google/gemini-3.6-flash";
export const NIM_LARGER_MODEL_SUGGESTION = "google/gemini-3-pro-preview";

export type NimMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type CallNimChatOptions = {
  messages: NimMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  /** When true (default), ask for JSON object output */
  jsonObject?: boolean;
  /** Parse response as JSON (default true) */
  parseJson?: boolean;
};

export class NimCallError extends Error {
  status: number;
  code: "unauthorized" | "rate_limit" | "billing" | "config" | "upstream" | "parse";

  constructor(message: string, status: number, code: NimCallError["code"]) {
    super(message);
    this.name = "NimCallError";
    this.status = status;
    this.code = code;
  }
}

function getClient(): OpenAI {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    throw new NimCallError(
      "LOVABLE_API_KEY is not configured. Add it in the backend secrets.",
      500,
      "config",
    );
  }
  return new OpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    defaultHeaders: { "Lovable-API-Key": apiKey },
  });
}

function extractJson(content: string): unknown {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence?.[1]) return JSON.parse(fence[1].trim());
    const obj = trimmed.match(/\{[\s\S]*\}/);
    if (obj) return JSON.parse(obj[0]);
    throw new Error("no json");
  }
}

const PARSE_HINT =
  "Generation returned invalid JSON. Try fewer questions or simpler inputs, then generate again.";

export async function callNimChat(opts: CallNimChatOptions): Promise<unknown> {
  const client = getClient();
  const parseJson = opts.parseJson !== false;

  let completion;
  try {
    completion = await client.chat.completions.create({
      model: NIM_MODEL,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.2,
      top_p: opts.top_p ?? 0.7,
      max_tokens: opts.max_tokens ?? 4096,
      stream: false,
      ...(opts.jsonObject !== false
        ? { response_format: { type: "json_object" as const } }
        : {}),
    });
  } catch (e: unknown) {
    const status = (e as { status?: number })?.status
      ?? (e as { statusCode?: number })?.statusCode
      ?? 500;
    const msg = e instanceof Error ? e.message : String(e);
    if (status === 401 || status === 403) {
      throw new NimCallError(
        "AI request was not authorized. Please contact an admin.",
        401,
        "unauthorized",
      );
    }
    if (status === 429) {
      throw new NimCallError(
        "AI rate limit exceeded. Please try again in a moment.",
        429,
        "rate_limit",
      );
    }
    if (status === 402) {
      throw new NimCallError(
        "AI credits exhausted. Please top up credits in workspace settings.",
        402,
        "billing",
      );
    }
    console.error("AI gateway error", status, msg.slice(0, 800));
    throw new NimCallError(
      "AI request failed. Please try again.",
      status >= 400 && status < 600 ? status : 500,
      "upstream",
    );
  }

  const content = completion.choices?.[0]?.message?.content ?? "";
  if (typeof content !== "string" || !content.trim()) {
    throw new NimCallError(`Empty AI response. ${PARSE_HINT}`, 422, "parse");
  }

  if (!parseJson) return content;

  try {
    return extractJson(content);
  } catch {
    throw new NimCallError(PARSE_HINT, 422, "parse");
  }
}

export function nimErrorResponse(
  e: unknown,
  corsHeaders: Record<string, string>,
): Response {
  if (e instanceof NimCallError) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: [401, 429, 402, 403].includes(e.status)
        ? e.status
        : e.code === "parse"
        ? 422
        : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const msg = e instanceof Error ? e.message : "Unknown error";
  console.error(e);
  return new Response(JSON.stringify({ error: msg }), {
    status: 500,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
