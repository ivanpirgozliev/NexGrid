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

function computeMinScore(lines: number): number {
  if (lines <= 0) return 0;
  let total = 0;
  let currentLines = 0;
  while (currentLines < lines) {
    const currentLevel = Math.floor(currentLines / 10) + 1;
    total += LINE_POINTS[1] * currentLevel;
    currentLines += 1;
  }
  return total;
}

const RATE_LIMIT_SECONDS = 5;
const MAX_LINES_POSSIBLE = 999;
const MAX_LEVEL_POSSIBLE = 100;
const MIN_SECONDS_PER_LINE = 1.5;
const MIN_SESSION_SECONDS = 10;

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

    if (lines > 0) {
      const minScore = computeMinScore(lines);
      if (score < minScore) {
        console.warn(
          `Score below minimum from user ${user.id}: score=${score}, min=${minScore}, lines=${lines}`
        );
        return jsonResponse({ error: "Invalid score data" }, 400);
      }
    }

    const { token } = body as Record<string, unknown>;

    if (typeof session_id !== "string" || session_id.length === 0) {
      console.warn(`Missing game session from user ${user.id}`);
      return jsonResponse({ error: "Game session required" }, 400);
    }

    if (typeof token !== "string" || token.length === 0) {
      console.warn(`Missing token from user ${user.id}`);
      return jsonResponse({ error: "Token required" }, 400);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: sessionData, error: sessionError } = await adminClient
      .from("game_sessions")
      .select("id, user_id, started_at, completed, token, heartbeat_count")
      .eq("id", session_id)
      .eq("user_id", user.id)
      .eq("completed", false)
      .maybeSingle();

    if (sessionError || !sessionData || !sessionData.token) {
      console.warn(
        `Invalid game session from user ${user.id}: session_id=${session_id}`
      );
      return jsonResponse({ error: "Invalid game session" }, 400);
    }

    if (sessionData.token !== token) {
      console.warn(
        `Token mismatch from user ${user.id}: session_id=${session_id}`
      );
      return jsonResponse({ error: "Invalid token" }, 403);
    }

    const sessionAge =
      (Date.now() - new Date(sessionData.started_at).getTime()) / 1000;

    if (sessionAge < MIN_SESSION_SECONDS) {
      console.warn(
        `Session too short from user ${user.id}: ${sessionAge}s`
      );
      return jsonResponse({ error: "Invalid game session" }, 400);
    }

    if (lines > 0) {
      const minDuration = lines * MIN_SECONDS_PER_LINE;
      if (sessionAge < minDuration) {
        console.warn(
          `Suspiciously fast game from user ${user.id}: ${sessionAge}s for ${lines} lines (min ${minDuration}s)`
        );
        return jsonResponse({ error: "Invalid game session" }, 400);
      }
    }

    const maxPossibleLines = Math.floor(sessionAge / MIN_SECONDS_PER_LINE);
    if (lines > maxPossibleLines) {
      console.warn(
        `Too many lines for session duration from user ${user.id}: ${lines} lines in ${sessionAge}s`
      );
      return jsonResponse({ error: "Invalid game session" }, 400);
    }

    const HEARTBEAT_INTERVAL = 15;
    const expectedHeartbeats = Math.max(
      0,
      Math.floor((sessionAge - HEARTBEAT_INTERVAL) / HEARTBEAT_INTERVAL)
    );
    const heartbeats = sessionData.heartbeat_count ?? 0;
    if (expectedHeartbeats > 0 && heartbeats < Math.ceil(expectedHeartbeats * 0.5)) {
      console.warn(
        `Insufficient heartbeats from user ${user.id}: got ${heartbeats}, expected ~${expectedHeartbeats} for ${sessionAge}s session`
      );
      return jsonResponse({ error: "Invalid game session" }, 400);
    }

    await adminClient
      .from("game_sessions")
      .update({ completed: true })
      .eq("id", session_id);

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
      `Score saved for user ${user.id}: score=${score}, level=${level}, lines=${lines}, duration=${sessionAge}s`
    );
    return jsonResponse(data as Record<string, unknown>, 200);
  } catch (err) {
    console.error("Unexpected error in submit-score:", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
