/**
 * Shared NVIDIA NIM chat helper for Supabase Edge Functions.
 * OpenAI-compatible SDK pointed at integrate.api.nvidia.com.
 * Model: meta/llama-3.2-1b-instruct (fixed — no silent fallback to larger models).
 *
 * Capacity note: Llama 3.2 1B Instruct is small. Complex worksheet/quiz/notes JSON
 * may fail or truncate. If so, explicitly switch to meta/llama-3.1-8b-instruct
 * (do not auto-route).
 */

import OpenAI from "https://esm.sh/openai@4.73.0";

export const NIM_MODEL = "meta/llama-3.2-1b-instruct";
export const NIM_LARGER_MODEL_SUGGESTION = "meta/llama-3.1-8b-instruct";

export type NimMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type CallNimChatOptions = {
  messages: NimMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  /** When true (default), ask for JSON object output when the API supports it */
  jsonObject?: boolean;
  /** Parse response as JSON (default true) */
  parseJson?: boolean;
};

export class NimCallError extends Error {
  status: number;
  code: "unauthorized" | "rate_limit" | "billing" | "config" | "upstream" | "parse";

  constructor(
    message: string,
    status: number,
    code: NimCallError["code"],
  ) {
    super(message);
    this.name = "NimCallError";
    this.status = status;
    this.code = code;
  }
}

function getNimClient(): OpenAI {
  const apiKey = Deno.env.get("NVIDIA_API_KEY");
  if (!apiKey) {
    throw new NimCallError(
      "NVIDIA_API_KEY is not configured. Add it in Supabase Edge Function secrets (or Lovable Cloud Secrets).",
      500,
      "config",
    );
  }
  return new OpenAI({
    baseURL: "https://integrate.api.nvidia.com/v1",
    apiKey,
  });
}

function extractJson(content: string): unknown {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Strip markdown fences if present
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence?.[1]) {
      return JSON.parse(fence[1].trim());
    }
    // Best-effort: first { ... } or [ ... ] block
    const obj = trimmed.match(/\{[\s\S]*\}/);
    if (obj) return JSON.parse(obj[0]);
    throw new Error("no json");
  }
}

const PARSE_HINT =
  `Generation returned invalid JSON. Llama 3.2 1B Instruct may be too small for this task — try fewer questions or switch the model to ${NIM_LARGER_MODEL_SUGGESTION} (explicit config change only; no auto-fallback).`;

export async function callNimChat(opts: CallNimChatOptions): Promise<unknown> {
  const client = getNimClient();
  const parseJson = opts.parseJson !== false;

  let completion;
  try {
    completion = await client.chat.completions.create({
      model: NIM_MODEL,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.2,
      top_p: opts.top_p ?? 0.7,
      max_tokens: opts.max_tokens ?? 1024,
      stream: false,
      ...(opts.jsonObject !== false
        ? { response_format: { type: "json_object" as const } }
        : {}),
    });
  } catch (e: unknown) {
    // OpenAI SDK errors often have status
    const status = (e as { status?: number })?.status
      ?? (e as { statusCode?: number })?.statusCode
      ?? 500;
    const msg = e instanceof Error ? e.message : String(e);
    if (status === 401 || /invalid.?api.?key|unauthorized|authentication/i.test(msg)) {
      throw new NimCallError(
        "NVIDIA API key is missing or invalid. Ask an admin to set NVIDIA_API_KEY in secrets.",
        401,
        "unauthorized",
      );
    }
    if (status === 429 || /rate.?limit/i.test(msg)) {
      throw new NimCallError(
        "NVIDIA NIM rate limit exceeded. Please try again in a moment.",
        429,
        "rate_limit",
      );
    }
    if (status === 402 || /quota|billing|credit/i.test(msg)) {
      throw new NimCallError(
        "NVIDIA NIM billing or quota issue. Please check the NVIDIA account.",
        402,
        "billing",
      );
    }
    console.error("NIM upstream error", status, msg.slice(0, 800));
    throw new NimCallError(
      "NVIDIA NIM request failed. Please try again.",
      status >= 400 && status < 600 ? status : 500,
      "upstream",
    );
  }

  const content = completion.choices?.[0]?.message?.content ?? "";
  if (typeof content !== "string" || !content.trim()) {
    throw new NimCallError(
      `Empty response from NVIDIA NIM (${NIM_MODEL}). ${PARSE_HINT}`,
      422,
      "parse",
    );
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
      status: e.status === 401
        ? 401
        : e.status === 429
        ? 429
        : e.status === 402
        ? 402
        : e.status === 403
        ? 403
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
