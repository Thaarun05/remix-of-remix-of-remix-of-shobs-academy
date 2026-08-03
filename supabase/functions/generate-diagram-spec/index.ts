import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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

const PROMPTS: Record<string, string> = {
  geometry_2d: `You convert a natural-language geometry description into a strict JSON spec.
Return ONLY: { "vertices":[{"id":string,"x":number,"y":number,"label":string?}], "edges":[{"from":string,"to":string,"length_label":string?}], "angles":[{"at_vertex":string,"from":string,"to":string,"label":string?,"mark":"arc"|"right"?}], "circles":[{"center":{"x":number,"y":number},"radius":number,"label":string?}]?, "units":string? }
Choose sensible coordinates so the figure is well-proportioned and fits in a roughly 10x10 unit box centered near origin. Label vertices A, B, C, ... . Include only the elements needed. Do NOT include any other keys.`,
  coordinate_graph: `You convert a natural-language graph description into a strict JSON spec.
Return ONLY: { "x_range":[number,number], "y_range":[number,number], "x_step":number, "y_step":number, "grid":boolean, "functions":[{"expr":string,"domain":[number,number]?,"label":string?}]?, "points":[{"x":number,"y":number,"label":string?}]?, "segments":[{"from":{"x":number,"y":number},"to":{"x":number,"y":number},"label":string?}]? }
"expr" is a math expression in x using +, -, *, /, ^, and functions sin, cos, tan, sqrt, abs, log, ln, exp. NEVER use ; = or assignments. Pick ranges that show key features clearly.`,
  number_line: `You convert a natural-language number line description into a strict JSON spec.
Return ONLY: { "range":[number,number], "step":number, "ticks":[number]?, "points":[{"value":number,"label":string?,"filled":boolean?}]?, "intervals":[{"from":number,"to":number,"open_from":boolean?,"open_to":boolean?,"label":string?}]? }
Use step to control gridlines. Use open_from/open_to for strict inequalities.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;
    const { data: isTeacher } = await supabase.rpc("has_role", { _user_id: userId, _role: "teacher" });
    if (!isTeacher) {
      return new Response(JSON.stringify({ error: "Only teachers can generate diagrams." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { kind, description, question_prompt } = await req.json();
    if (!kind || !PROMPTS[kind]) {
      return new Response(JSON.stringify({ error: "Unsupported diagram kind" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userMsg = `Question prompt: ${question_prompt ?? ""}
Diagram description: ${description ?? ""}

Return the strict JSON spec now.
(Provider: NVIDIA NIM ${NIM_MODEL}. If specs are often invalid, switch explicitly to ${NIM_LARGER_MODEL_SUGGESTION}.)`;

    const parsed = await callNimChat({
      temperature: 0.2,
      top_p: 0.7,
      max_tokens: 1024,
      messages: [
        { role: "system", content: PROMPTS[kind] },
        { role: "user", content: userMsg },
      ],
    });

    return new Response(JSON.stringify({ spec: parsed }), {
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
