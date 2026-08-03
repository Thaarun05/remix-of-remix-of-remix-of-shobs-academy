/**
 * Shared Lovable AI Gateway chat-completions helper for Supabase Edge Functions.
 * Uses LOVABLE_API_KEY from secrets. Never expose this key to the client.
 * The exported names keep the historical `OpenAI*` prefix so existing call sites
 * stay unchanged; all traffic goes to the Lovable AI Gateway.
 */

export type OpenAIMessageContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

export type OpenAIMessage = {
  role: "system" | "user" | "assistant";
  content: OpenAIMessageContent;
};

export type JsonSchemaFormat = {
  name: string;
  description?: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type CallOpenAIOptions = {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  jsonSchema?: JsonSchemaFormat;
  /** Fallback to loose json_object when schema is not needed */
  jsonObject?: boolean;
  maxTokens?: number;
};

export class OpenAICallError extends Error {
  status: number;
  code: "unauthorized" | "rate_limit" | "billing" | "config" | "upstream" | "parse";

  constructor(
    message: string,
    status: number,
    code: OpenAICallError["code"],
  ) {
    super(message);
    this.name = "OpenAICallError";
    this.status = status;
    this.code = code;
  }
}

export function mapOpenAIHttpError(status: number, bodyText: string): OpenAICallError {
  if (status === 401) {
    return new OpenAICallError(
      "AI gateway key is missing or invalid. Ask an admin to check LOVABLE_API_KEY.",
      401,
      "unauthorized",
    );
  }
  if (status === 429) {
    return new OpenAICallError(
      "Rate limit exceeded. Please try again in a moment.",
      429,
      "rate_limit",
    );
  }
  if (status === 402 || status === 403) {
    const lower = bodyText.toLowerCase();
    if (lower.includes("quota") || lower.includes("billing") || lower.includes("credit") || status === 402) {
      return new OpenAICallError(
        "AI credits exhausted. Please add credits in workspace settings.",
        402,
        "billing",
      );
    }
  }
  console.error("AI gateway upstream error", status, bodyText.slice(0, 800));
  return new OpenAICallError(
    "AI request failed. Please try again.",
    status >= 400 && status < 600 ? status : 500,
    "upstream",
  );
}

export async function callOpenAI(opts: CallOpenAIOptions): Promise<unknown> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    throw new OpenAICallError(
      "LOVABLE_API_KEY is not configured.",
      500,
      "config",
    );
  }

  const buildBody = (useSchema: boolean): Record<string, unknown> => {
    const body: Record<string, unknown> = {
      model: opts.model,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.7,
    };
    if (typeof opts.maxTokens === "number") body.max_tokens = opts.maxTokens;

    if (useSchema && opts.jsonSchema) {
      body.response_format = {
        type: "json_schema",
        json_schema: {
          name: opts.jsonSchema.name,
          description: opts.jsonSchema.description,
          schema: opts.jsonSchema.schema,
          strict: opts.jsonSchema.strict ?? true,
        },
      };
    } else if (opts.jsonSchema || opts.jsonObject !== false) {
      body.response_format = { type: "json_object" };
    }
    return body;
  };

  const post = (body: Record<string, unknown>) =>
    fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

  let resp = await post(buildBody(true));

  // Some models reject strict json_schema; retry once in plain JSON mode.
  if (resp.status === 400 && opts.jsonSchema) {
    const detail = await resp.text();
    console.warn("json_schema rejected, retrying with json_object", detail.slice(0, 400));
    resp = await post(buildBody(false));
  }

  if (!resp.ok) {
    const t = await resp.text();
    throw mapOpenAIHttpError(resp.status, t);
  }

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content ?? "";
  if (typeof content !== "string" || !content.trim()) {
    throw new OpenAICallError("Empty response from the AI model.", 422, "parse");
  }

  try {
    return JSON.parse(content);
  } catch {
    // Tolerate ```json fences or surrounding prose.
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch { /* fall through */ }
    }
    throw new OpenAICallError(
      "The AI returned invalid JSON. Please try again.",
      422,
      "parse",
    );
  }
}

export function openAIErrorResponse(
  e: unknown,
  corsHeaders: Record<string, string>,
): Response {
  if (e instanceof OpenAICallError) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: e.status === 401 ? 401 : e.status === 429 ? 429 : e.status === 402 ? 402 : e.status === 403 ? 403 : e.code === "parse" ? 422 : 500,
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
