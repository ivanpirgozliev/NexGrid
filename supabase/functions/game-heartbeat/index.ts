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

const MIN_HEARTBEAT_INTERVAL_SECONDS = 8;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
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

    const { session_id, token } = body as Record<string, unknown>;

    if (
      typeof session_id !== "string" ||
      session_id.length === 0 ||
      typeof token !== "string" ||
      token.length === 0
    ) {
      return jsonResponse({ error: "Missing session_id or token" }, 400);
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
      return jsonResponse({ error: "Invalid game session" }, 400);
    }

    if (session.token !== token) {
      console.warn(
        `Token mismatch for session ${session_id} from user ${user.id}`
      );
      return jsonResponse({ error: "Invalid token" }, 403);
    }

    const refTime = session.last_heartbeat_at
      ? new Date(session.last_heartbeat_at).getTime()
      : new Date(session.started_at).getTime();
    const elapsed = (Date.now() - refTime) / 1000;

    if (elapsed < MIN_HEARTBEAT_INTERVAL_SECONDS) {
      return jsonResponse({ ok: true }, 200);
    }

    await adminClient
      .from("game_sessions")
      .update({
        heartbeat_count: (session.heartbeat_count ?? 0) + 1,
        last_heartbeat_at: new Date().toISOString(),
      })
      .eq("id", session_id);

    return jsonResponse({ ok: true }, 200);
  } catch (err) {
    console.error("Unexpected error in game-heartbeat:", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
