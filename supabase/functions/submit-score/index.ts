import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const LINE_POINTS = [0, 100, 300, 500, 800];

function computeMaxScore(level: number, lines: number): number {
  if (lines <= 0 || level <= 0) return 0;

  let total = 0;
  let currentLines = 0;

  while (currentLines < lines) {
    const currentLevel = Math.floor(currentLines / 10) + 1;
    const remaining = lines - currentLines;
    const batch = Math.min(4, remaining);
    total += (LINE_POINTS[batch] ?? 0) * currentLevel;
    currentLines += batch;
  }

  const bonus = total * 0.5;
  return Math.ceil(total + bonus);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { score, level, lines } = body;

    if (
      typeof score !== "number" || typeof level !== "number" || typeof lines !== "number" ||
      score < 0 || level < 1 || lines < 0 ||
      !Number.isInteger(score) || !Number.isInteger(level) || !Number.isInteger(lines)
    ) {
      return new Response(
        JSON.stringify({ error: "Invalid score data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const expectedLevel = Math.floor(lines / 10) + 1;
    if (level > expectedLevel + 1) {
      return new Response(
        JSON.stringify({ error: "Level inconsistent with lines cleared" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const maxScore = computeMaxScore(level, lines);
    if (score > maxScore) {
      return new Response(
        JSON.stringify({ error: "Score exceeds maximum possible for given lines/level" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await adminClient
      .from("scores")
      .insert({ user_id: user.id, score, level, lines })
      .select()
      .single();

    if (error) {
      return new Response(
        JSON.stringify({ error: "Failed to save score" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify(data),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
