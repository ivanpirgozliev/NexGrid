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

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const MAX_ACTIVE_SESSIONS = 3;

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

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    await adminClient
      .from("game_sessions")
      .delete()
      .eq("user_id", user.id)
      .eq("completed", false)
      .lt(
        "started_at",
        new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      );

    const { count } = await adminClient
      .from("game_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("completed", false);

    if (count !== null && count >= MAX_ACTIVE_SESSIONS) {
      console.warn(`Too many active sessions for user ${user.id}: ${count}`);
      return jsonResponse({ error: "Too many active sessions" }, 429);
    }

    const token = generateToken();

    const { data, error } = await adminClient
      .from("game_sessions")
      .insert({ user_id: user.id, token })
      .select("id, started_at")
      .single();

    if (error) {
      console.error(
        `Failed to create game session for user ${user.id}:`,
        error.message
      );
      return jsonResponse({ error: "Failed to start game session" }, 500);
    }

    console.info(`Game session started for user ${user.id}: ${data.id}`);
    return jsonResponse(data as Record<string, unknown>, 200);
  } catch (err) {
    console.error("Unexpected error in start-game:", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
