/*
  # Add leaderboard avatars and public game stats

  ## Summary
  - Extends `leaderboard` view with `avatar_url`
  - Adds `get_public_game_stats()` RPC for total users and online users

  ## Security
  - `leaderboard` remains `security_invoker = on`
  - RPC is `SECURITY DEFINER` but returns only aggregate counters
  - RPC execution is restricted to authenticated and service_role
*/

DROP VIEW IF EXISTS public.leaderboard;

CREATE VIEW public.leaderboard
WITH (security_invoker = on) AS
  SELECT
    s.id AS score_id,
    s.user_id,
    p.username,
    p.avatar_url,
    s.score,
    s.level,
    s.lines,
    s.created_at
  FROM public.scores s
  JOIN public.profiles p ON p.id = s.user_id
  ORDER BY s.score DESC
  LIMIT 100;

REVOKE ALL ON TABLE public.leaderboard FROM anon, authenticated;
GRANT SELECT ON TABLE public.leaderboard TO authenticated;

CREATE OR REPLACE FUNCTION public.get_public_game_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_users integer;
  v_online_users integer;
BEGIN
  SELECT count(*)::integer
  INTO v_total_users
  FROM public.profiles;

  SELECT count(DISTINCT gs.user_id)::integer
  INTO v_online_users
  FROM public.game_sessions gs
  WHERE gs.completed = false
    AND coalesce(gs.last_heartbeat_at, gs.started_at) >= now() - interval '90 seconds';

  RETURN json_build_object(
    'total_users', coalesce(v_total_users, 0),
    'online_users', coalesce(v_online_users, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_game_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_game_stats() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_public_game_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_game_stats() TO service_role;
