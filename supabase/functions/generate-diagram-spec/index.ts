import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claimsData.claims.sub as string;
    const { data: isTeacher } = await supabase.rpc("has_role", { _user_id: userId, _role: "teacher" });
    if (!isTeacher) {
      return new Response(JSON.stringify({ error: "Only teachers can generate diagrams." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { kind, description, question_prompt } = await req.json();
    if (!kind || !PROMPTS[kind]) {
      return new Response(JSON.stringify({ error: "Unsupported diagram kind" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const userMsg = `Question prompt: ${question_prompt ?? ""}
Diagram description: ${description ?? ""}

Return the strict JSON spec now.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: PROMPTS[kind] },
          { role: "user", content: userMsg },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway error (diagram)", resp.status, t);
      if (resp.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (resp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    let parsed;
    try { parsed = JSON.parse(content); } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON from model" }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ spec: parsed }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});