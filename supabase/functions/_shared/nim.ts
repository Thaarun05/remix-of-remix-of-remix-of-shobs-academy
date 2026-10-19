/**
 * Shared AI chat helper for Supabase Edge Functions.
 * Routes through OpenRouter (OpenAI-compatible) using OPENROUTER_API_KEY.
 * Model: openai/gpt-5.6-terra-pro
 *
 * Exported names keep their historical "Nim" prefix so existing call sites
 * (generate-worksheet / -quiz / -notes / -diagram-spec) work unchanged.
 */

import OpenAI from "https://esm.sh/openai@4.73.0";

export const NIM_MODEL = "openai/gpt-5.6-terra-pro";
export const NIM_LARGER_MODEL_SUGGESTION = "openai/gpt-5.6-terra-pro";

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
  code:
    | "unauthorized"
    | "rate_limit"
    | "billing"
    | "config"
    | "upstream"
    | "parse"
    | "truncated";

  constructor(message: string, status: number, code: NimCallError["code"]) {
    super(message);
    this.name = "NimCallError";
    this.status = status;
    this.code = code;
  }
}

function getProviderErrorMessage(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;

  const providerError = (error as { error?: unknown }).error;
  if (typeof providerError === "string" && providerError.trim()) {
    return providerError.trim().slice(0, 500);
  }
  if (providerError && typeof providerError === "object") {
    const message = (providerError as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message.trim().slice(0, 500);
    }
  }

  const message = (error as { message?: unknown }).message;
  if (typeof message === "string" && message.trim()) {
    const embeddedJson = message.match(/\{[\s\S]*\}/)?.[0];
    if (embeddedJson) {
      try {
        const parsed = JSON.parse(embeddedJson) as {
          error?: { message?: unknown } | string;
        };
        const detail = typeof parsed.error === "string"
          ? parsed.error
          : parsed.error?.message;
        if (typeof detail === "string" && detail.trim()) {
          return detail.trim().slice(0, 500);
        }
      } catch {
        // The SDK message may not contain a standalone JSON error envelope.
      }
    }
    return message.trim().slice(0, 500);
  }

  return undefined;
}

function getClient(): OpenAI {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!apiKey) {
    throw new NimCallError(
      "OPENROUTER_API_KEY is not configured. Add it in the backend secrets.",
      500,
      "config",
    );
  }
  return new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey,
    defaultHeaders: {
      "HTTP-Referer": "https://learn-together-hub-16.lovable.app",
      "X-Title": "Shobs Academy",
    },
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

export const TRUNCATION_MESSAGE =
  "The worksheet was too long to finish generating. Reduce the number of questions (or shorten the source text) and try again.";

export async function callNimChat(opts: CallNimChatOptions): Promise<unknown> {
  const client = getClient();
  const parseJson = opts.parseJson !== false;
  const maxTokens = opts.max_tokens ?? 16000;
  console.log(`OpenRouter request: model=${NIM_MODEL} max_tokens=${maxTokens}`);

  let completion;
  try {
    completion = await client.chat.completions.create({
      model: NIM_MODEL,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.2,
      top_p: opts.top_p ?? 0.7,
      max_tokens: opts.max_tokens ?? 16000,
      stream: false,
      // OpenRouter-specific: enable the model's thinking tokens.
      reasoning: { enabled: true },
      ...(opts.jsonObject !== false
        ? { response_format: { type: "json_object" as const } }
        : {}),
    } as never);
  } catch (e: unknown) {
    const status = (e as { status?: number })?.status
      ?? (e as { statusCode?: number })?.statusCode
      ?? 500;
    const providerMessage = getProviderErrorMessage(e);
    console.error("OpenRouter error", {
      status,
      model: NIM_MODEL,
      max_tokens: maxTokens,
      providerMessage: providerMessage ?? "No provider detail returned",
    });
    if (status === 401 || status === 403) {
      throw new NimCallError(
        "OpenRouter rejected the API key (401). Check OPENROUTER_API_KEY in the backend secrets.",
        401,
        "unauthorized",
      );
    }
    if (status === 429) {
      throw new NimCallError(
        "OpenRouter rate limit exceeded. Please try again in a moment.",
        429,
        "rate_limit",
      );
    }
    if (status === 402) {
      const detail = providerMessage ? ` Provider detail: ${providerMessage}` : "";
      throw new NimCallError(
        `OpenRouter couldn't approve the cost of this request (HTTP 402). Usually this means the API key's spending limit, or the remaining balance, is below the maximum this request might cost. It does not necessarily mean the balance is zero.${detail}`,
        402,
        "billing",
      );
    }
    throw new NimCallError(
      `OpenRouter request failed (${status}). Please try again.`,
      status >= 400 && status < 600 ? status : 500,
      "upstream",
    );
  }

  const content = completion.choices?.[0]?.message?.content ?? "";
  const finishReason = completion.choices?.[0]?.finish_reason;
  if (typeof content !== "string" || !content.trim()) {
    if (finishReason === "length") {
      throw new NimCallError(TRUNCATION_MESSAGE, 422, "truncated");
    }
    throw new NimCallError(`Empty AI response. ${PARSE_HINT}`, 422, "parse");
  }

  if (!parseJson) return content;

  try {
    return extractJson(content);
  } catch {
    if (finishReason === "length") {
      console.error(
        "AI response truncated (finish_reason=length). Tail:",
        content.slice(-500),
      );
      throw new NimCallError(TRUNCATION_MESSAGE, 422, "truncated");
    }
    console.error(
      "AI response failed JSON parse. finish_reason:",
      finishReason,
      "head:",
      content.slice(0, 300),
      "tail:",
      content.slice(-300),
    );
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
        : e.code === "parse" || e.code === "truncated"
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
