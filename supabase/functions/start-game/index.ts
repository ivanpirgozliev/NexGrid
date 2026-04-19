/// <reference path="./types.d.ts" />
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "https://ivanigorzilevetetris.netlify.app",
  "https://*.netlify.app",
];

type OriginMatcher = (origin: string) => boolean;

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/+$/, "");
}

function buildAllowedOriginMatchers(): OriginMatcher[] {
  const configured = Deno.env.get("ALLOWED_ORIGINS") ?? "";
  const siteUrl = Deno.env.get("SITE_URL") ?? "";
  const appUrl = Deno.env.get("APP_URL") ?? "";
  const merged = [
    ...DEFAULT_ALLOWED_ORIGINS,
    ...configured.split(","),
    siteUrl,
    appUrl,
  ];

  const origins = merged
    .map((origin) => normalizeOrigin(origin.trim()))
    .filter((origin) => origin.length > 0);

  return origins.map((allowed) => {
    if (!allowed.includes("*")) {
      return (origin: string) => origin === allowed;
    }

    const pattern = allowed
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*");
    const regex = new RegExp(`^${pattern}$`);
    return (origin: string) => regex.test(origin);
  });
}

const allowedOriginMatchers = buildAllowedOriginMatchers();

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true;
  const normalized = normalizeOrigin(origin);
  return allowedOriginMatchers.some((matchOrigin) => matchOrigin(normalized));
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

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const MAX_ACTIVE_SESSIONS = 3;

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
      return jsonResponse({ error: "Too many active sessions" }, 429, origin);
    }

    const token = generateToken();

    const { data, error } = await adminClient
      .from("game_sessions")
      .insert({ user_id: user.id, token })
      .select("id, started_at, token")
      .single();

    if (error) {
      console.error(
        `Failed to create game session for user ${user.id}:`,
        error.message
      );
      return jsonResponse({ error: "Failed to start game session" }, 500, origin);
    }

    console.info(`Game session started for user ${user.id}: ${data.id}`);
    return jsonResponse(data as Record<string, unknown>, 200, origin);
  } catch (err) {
    console.error("Unexpected error in start-game:", err);
    return jsonResponse({ error: "Internal server error" }, 500, origin);
  }
});
