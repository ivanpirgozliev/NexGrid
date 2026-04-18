// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
];

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/+$/, "");
}

function buildAllowedOrigins(): Set<string> {
  const configured = Deno.env.get("ALLOWED_ORIGINS") ?? "";
  const merged = [...DEFAULT_ALLOWED_ORIGINS, ...configured.split(",")];

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

const MIN_HEARTBEAT_INTERVAL_SECONDS = 8;
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
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
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

    const { session_id, token } = body as Record<string, unknown>;

    if (
      typeof session_id !== "string" ||
      !UUID_REGEX.test(session_id) ||
      typeof token !== "string" ||
      !SESSION_TOKEN_REGEX.test(token)
    ) {
      return jsonResponse({ error: "Missing session_id or token" }, 400, origin);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: session, error: sessionError } = await adminClient
      .from("game_sessions")
      .select(
        "id, user_id, token, completed, last_heartbeat_at, started_at, heartbeat_count"
      )
      .eq("id", session_id)
      .eq("user_id", user.id)
      .eq("completed", false)
      .maybeSingle();

    if (sessionError || !session) {
      return jsonResponse({ error: "Invalid game session" }, 400, origin);
    }

    if (session.token !== token) {
      console.warn(
        `Token mismatch for session ${session_id} from user ${user.id}`
      );
      return jsonResponse({ error: "Invalid token" }, 403, origin);
    }

    const refTime = session.last_heartbeat_at
      ? new Date(session.last_heartbeat_at).getTime()
      : new Date(session.started_at).getTime();
    const elapsed = (Date.now() - refTime) / 1000;

    if (elapsed < MIN_HEARTBEAT_INTERVAL_SECONDS) {
      return jsonResponse({ ok: true }, 200, origin);
    }

    await adminClient
      .from("game_sessions")
      .update({
        heartbeat_count: (session.heartbeat_count ?? 0) + 1,
        last_heartbeat_at: new Date().toISOString(),
      })
      .eq("id", session_id);

    return jsonResponse({ ok: true }, 200, origin);
  } catch (err) {
    console.error("Unexpected error in game-heartbeat:", err);
    return jsonResponse({ error: "Internal server error" }, 500, origin);
  }
});
