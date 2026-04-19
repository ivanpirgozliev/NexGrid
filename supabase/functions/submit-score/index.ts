import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/+$/, "");
}

function buildAllowedOrigins(): Set<string> {
  const configured = Deno.env.get("ALLOWED_ORIGINS") ?? "";
  const siteUrl = Deno.env.get("SITE_URL") ?? "";
  const appUrl = Deno.env.get("APP_URL") ?? "";
  const merged = [
    ...DEFAULT_ALLOWED_ORIGINS,
    ...configured.split(","),
    siteUrl,
    appUrl,
  ];

  return new Set(
    merged
      .map((origin) => normalizeOrigin(origin.trim()))
      .filter((origin) => origin.length > 0)
  );
}

const allowedOrigins = buildAllowedOrigins();

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true;
  return allowedOrigins.has(normalizeOrigin(origin));
}

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Client-Info, Apikey",
    "Vary": "Origin",
  };

  if (origin && isAllowedOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  origin: string | null
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

const LINE_POINTS = [0, 100, 300, 500, 800];

function computeScoreBounds(lines: number): { min: number; max: number } {
  if (lines <= 0) {
    return { min: 0, max: 0 };
  }

  const minScores = Array<number>(lines + 1).fill(Number.POSITIVE_INFINITY);
  const maxScores = Array<number>(lines + 1).fill(Number.NEGATIVE_INFINITY);
  minScores[0] = 0;
  maxScores[0] = 0;

  for (let clearedTotal = 0; clearedTotal < lines; clearedTotal += 1) {
    for (let clearCount = 1; clearCount <= 4; clearCount += 1) {
      const nextTotal = clearedTotal + clearCount;
      if (nextTotal > lines) continue;

      // Game scoring uses the level after lines are added.
      const nextLevel = Math.floor(nextTotal / 10) + 1;
      const gainedScore = (LINE_POINTS[clearCount] ?? 0) * nextLevel;

      minScores[nextTotal] = Math.min(
        minScores[nextTotal],
        minScores[clearedTotal] + gainedScore
      );
      maxScores[nextTotal] = Math.max(
        maxScores[nextTotal],
        maxScores[clearedTotal] + gainedScore
      );
    }
  }

  return {
    min: minScores[lines],
    max: maxScores[lines],
  };
}

const RATE_LIMIT_SECONDS = 5;
const MAX_LINES_POSSIBLE = 999;
const MAX_LEVEL_POSSIBLE = 100;
const MIN_SECONDS_PER_LINE = 1.5;
const MIN_SESSION_SECONDS = 10;
const MAX_SESSION_SECONDS = 2 * 60 * 60;
const HEARTBEAT_INTERVAL_SECONDS = 15;
const HEARTBEAT_GRACE_SECONDS = 5;
const MAX_HEARTBEAT_STALENESS_SECONDS = 45;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SESSION_TOKEN_REGEX = /^[a-f0-9]{64}$/i;

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");

  if (req.method === "OPTIONS") {
    if (!isAllowedOrigin(origin)) {
      return jsonResponse({ error: "Origin not allowed" }, 403, origin);
    }

    return new Response(null, { status: 200, headers: corsHeaders(origin) });
  }

  if (!isAllowedOrigin(origin)) {
    return jsonResponse({ error: "Origin not allowed" }, 403, origin);
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, origin);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      console.error("Missing required environment variables");
      return jsonResponse({ error: "Server configuration error" }, 500, origin);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing authorization" }, 401, origin);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: "Authentication failed" }, 401, origin);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid request body" }, 400, origin);
    }

    if (!body || typeof body !== "object") {
      return jsonResponse({ error: "Invalid request body" }, 400, origin);
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
      return jsonResponse({ error: "Invalid score data" }, 400, origin);
    }

    const expectedLevel = Math.floor(lines / 10) + 1;
    if (level > expectedLevel) {
      console.warn(
        `Level mismatch from user ${user.id}: level=${level}, expected=${expectedLevel}, lines=${lines}`
      );
      return jsonResponse({ error: "Invalid score data" }, 400, origin);
    }

    const { min: minScore, max: maxScore } = computeScoreBounds(lines);
    if (score > maxScore) {
      console.warn(
        `Score exceeds max from user ${user.id}: score=${score}, max=${maxScore}, lines=${lines}`
      );
      return jsonResponse({ error: "Invalid score data" }, 400, origin);
    }

    if (lines > 0 && score < minScore) {
      console.warn(
        `Score below minimum from user ${user.id}: score=${score}, min=${minScore}, lines=${lines}`
      );
      return jsonResponse({ error: "Invalid score data" }, 400, origin);
    }

    const { token } = body as Record<string, unknown>;

    if (typeof session_id !== "string" || !UUID_REGEX.test(session_id)) {
      console.warn(`Missing game session from user ${user.id}`);
      return jsonResponse({ error: "Game session required" }, 400, origin);
    }

    if (typeof token !== "string" || !SESSION_TOKEN_REGEX.test(token)) {
      console.warn(`Missing token from user ${user.id}`);
      return jsonResponse({ error: "Token required" }, 400, origin);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: sessionData, error: sessionError } = await adminClient
      .from("game_sessions")
      .select(
        "id, user_id, started_at, completed, token, heartbeat_count, last_heartbeat_at"
      )
      .eq("id", session_id)
      .eq("user_id", user.id)
      .eq("completed", false)
      .maybeSingle();

    if (sessionError || !sessionData || !sessionData.token) {
      console.warn(
        `Invalid game session from user ${user.id}: session_id=${session_id}`
      );
      return jsonResponse({ error: "Invalid game session" }, 400, origin);
    }

    if (sessionData.token !== token) {
      console.warn(
        `Token mismatch from user ${user.id}: session_id=${session_id}`
      );
      return jsonResponse({ error: "Invalid token" }, 403, origin);
    }

    const sessionAge =
      (Date.now() - new Date(sessionData.started_at).getTime()) / 1000;

    if (sessionAge < MIN_SESSION_SECONDS) {
      console.warn(
        `Session too short from user ${user.id}: ${sessionAge}s`
      );
      return jsonResponse({ error: "Invalid game session" }, 400, origin);
    }

    if (sessionAge > MAX_SESSION_SECONDS) {
      console.warn(
        `Session too long from user ${user.id}: ${sessionAge}s`
      );
      return jsonResponse({ error: "Invalid game session" }, 400, origin);
    }

    if (lines > 0) {
      const minDuration = lines * MIN_SECONDS_PER_LINE;
      if (sessionAge < minDuration) {
        console.warn(
          `Suspiciously fast game from user ${user.id}: ${sessionAge}s for ${lines} lines (min ${minDuration}s)`
        );
        return jsonResponse({ error: "Invalid game session" }, 400, origin);
      }
    }

    const maxPossibleLines = Math.floor(sessionAge / MIN_SECONDS_PER_LINE);
    if (lines > maxPossibleLines) {
      console.warn(
        `Too many lines for session duration from user ${user.id}: ${lines} lines in ${sessionAge}s`
      );
      return jsonResponse({ error: "Invalid game session" }, 400, origin);
    }

    const expectedHeartbeats = Math.max(
      0,
      Math.floor((sessionAge - HEARTBEAT_GRACE_SECONDS) / HEARTBEAT_INTERVAL_SECONDS)
    );
    const heartbeats = sessionData.heartbeat_count ?? 0;
    if (expectedHeartbeats > 0 && heartbeats < Math.ceil(expectedHeartbeats * 0.5)) {
      console.warn(
        `Insufficient heartbeats from user ${user.id}: got ${heartbeats}, expected ~${expectedHeartbeats} for ${sessionAge}s session`
      );
      return jsonResponse({ error: "Invalid game session" }, 400, origin);
    }

    if (sessionData.last_heartbeat_at) {
      const heartbeatStalenessSeconds =
        (Date.now() - new Date(sessionData.last_heartbeat_at).getTime()) / 1000;
      if (heartbeatStalenessSeconds > MAX_HEARTBEAT_STALENESS_SECONDS) {
        console.warn(
          `Stale heartbeat from user ${user.id}: ${heartbeatStalenessSeconds}s`
        );
        return jsonResponse({ error: "Invalid game session" }, 400, origin);
      }
    } else if (expectedHeartbeats > 0) {
      console.warn(
        `Missing heartbeat timestamp from user ${user.id} for ${sessionAge}s session`
      );
      return jsonResponse({ error: "Invalid game session" }, 400, origin);
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
        return jsonResponse({ error: "Too many requests" }, 429, origin);
      }
    }

    const { data: claimedSession, error: claimError } = await adminClient
      .from("game_sessions")
      .update({ completed: true })
      .eq("id", session_id)
      .eq("user_id", user.id)
      .eq("token", token)
      .eq("completed", false)
      .select("id")
      .maybeSingle();

    if (claimError) {
      console.error(
        `Failed to claim game session for user ${user.id}:`,
        claimError.message
      );
      return jsonResponse({ error: "Failed to save score" }, 500, origin);
    }

    if (!claimedSession) {
      console.warn(
        `Replay or already completed session for user ${user.id}: session_id=${session_id}`
      );
      return jsonResponse({ error: "Invalid game session" }, 400, origin);
    }

    const { data, error } = await adminClient
      .from("scores")
      .insert({ user_id: user.id, score, level, lines, session_id })
      .select()
      .single();

    if (error) {
      console.error(
        `Failed to insert score for user ${user.id}:`,
        error.message
      );
      return jsonResponse({ error: "Failed to save score" }, 500, origin);
    }

    console.info(
      `Score saved for user ${user.id}: score=${score}, level=${level}, lines=${lines}, duration=${sessionAge}s`
    );
    return jsonResponse(data as Record<string, unknown>, 200, origin);
  } catch (err) {
    console.error("Unexpected error in submit-score:", err);
    return jsonResponse({ error: "Internal server error" }, 500, origin);
  }
});
