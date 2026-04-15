import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const LINE_POINTS = [0, 100, 300, 500, 800];

function computeMaxScore(lines: number): number {
  if (lines <= 0) return 0;

  let total = 0;
  let currentLines = 0;

  while (currentLines < lines) {
    const currentLevel = Math.floor(currentLines / 10) + 1;
    const remaining = lines - currentLines;
    const batch = Math.min(4, remaining);
    total += (LINE_POINTS[batch] ?? 0) * currentLevel;
    currentLines += batch;
  }

  return total;
}

const RATE_LIMIT_SECONDS = 5;
const MAX_LINES_POSSIBLE = 9999;
const MAX_LEVEL_POSSIBLE = 1000;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      console.error("Missing required environment variables");
      return jsonResponse({ error: "Server configuration error" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.warn("Score submission attempt without authorization header");
      return jsonResponse({ error: "Missing authorization" }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) {
      console.warn("Score submission with invalid token");
      return jsonResponse({ error: "Authentication failed" }, 401);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid request body" }, 400);
    }

    if (!body || typeof body !== "object") {
      return jsonResponse({ error: "Invalid request body" }, 400);
    }

    const { score, level, lines, session_id } = body as Record<
      string,
      unknown
    >;

    if (
      typeof score !== "number" ||
      typeof level !== "number" ||
      typeof lines !== "number" ||
      !Number.isInteger(score) ||
      !Number.isInteger(level) ||
      !Number.isInteger(lines) ||
      score < 0 ||
      level < 1 ||
      lines < 0 ||
      level > MAX_LEVEL_POSSIBLE ||
      lines > MAX_LINES_POSSIBLE
    ) {
      console.warn(
        `Invalid score data from user ${user.id}: score=${score}, level=${level}, lines=${lines}`
      );
      return jsonResponse({ error: "Invalid score data" }, 400);
    }

    const expectedLevel = Math.floor(lines / 10) + 1;
    if (level > expectedLevel) {
      console.warn(
        `Level mismatch from user ${user.id}: level=${level}, expected=${expectedLevel}, lines=${lines}`
      );
      return jsonResponse({ error: "Invalid score data" }, 400);
    }

    const maxScore = computeMaxScore(lines);
    if (score > maxScore) {
      console.warn(
        `Score exceeds max from user ${user.id}: score=${score}, max=${maxScore}, lines=${lines}`
      );
      return jsonResponse({ error: "Invalid score data" }, 400);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    if (typeof session_id === "string" && session_id.length > 0) {
      const { data: sessionData, error: sessionError } = await adminClient
        .from("game_sessions")
        .select("id, user_id, started_at, completed")
        .eq("id", session_id)
        .eq("user_id", user.id)
        .eq("completed", false)
        .maybeSingle();

      if (sessionError || !sessionData) {
        console.warn(
          `Invalid game session from user ${user.id}: session_id=${session_id}`
        );
        return jsonResponse({ error: "Invalid game session" }, 400);
      }

      const sessionAge =
        (Date.now() - new Date(sessionData.started_at).getTime()) / 1000;
      const minGameDuration = Math.max(3, lines * 0.4);
      if (sessionAge < minGameDuration) {
        console.warn(
          `Suspiciously fast game from user ${user.id}: ${sessionAge}s for ${lines} lines`
        );
        return jsonResponse({ error: "Invalid game session" }, 400);
      }

      await adminClient
        .from("game_sessions")
        .update({ completed: true })
        .eq("id", session_id);
    }

    const { data: recent } = await adminClient
      .from("scores")
      .select("created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recent) {
      const elapsed =
        (Date.now() - new Date(recent.created_at).getTime()) / 1000;
      if (elapsed < RATE_LIMIT_SECONDS) {
        console.warn(
          `Rate limited user ${user.id}: ${elapsed}s since last score`
        );
        return jsonResponse({ error: "Too many requests" }, 429);
      }
    }

    const { data, error } = await adminClient
      .from("scores")
      .insert({ user_id: user.id, score, level, lines })
      .select()
      .single();

    if (error) {
      console.error(
        `Failed to insert score for user ${user.id}:`,
        error.message
      );
      return jsonResponse({ error: "Failed to save score" }, 500);
    }

    console.info(
      `Score saved for user ${user.id}: score=${score}, level=${level}, lines=${lines}`
    );
    return jsonResponse(data as Record<string, unknown>, 200);
  } catch (err) {
    console.error("Unexpected error in submit-score:", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
