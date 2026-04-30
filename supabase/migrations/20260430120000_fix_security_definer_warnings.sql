/*
  # Fix SECURITY DEFINER warnings

  ## Summary
  - Revoke direct EXECUTE on handle_new_user() — it is a trigger function and must
    never be called by roles directly; the trigger system invokes it internally.
  - Convert get_user_stats() and get_public_game_stats() from SECURITY DEFINER to
    SECURITY INVOKER. Authenticated users already have the required SELECT grants
    and permissive RLS policies, so SECURITY DEFINER is unnecessary and adds
    unnecessary privilege-escalation surface.

  ## Why SECURITY INVOKER is safe here
  - scores: authenticated has SELECT via "Authenticated users can view all scores"
    policy (USING: auth.uid() IS NOT NULL).
  - profiles: authenticated has SELECT via "Authenticated users can view all
    profiles" policy (USING: true) and GRANT SELECT on the table.
*/

-- Trigger functions are invoked by the trigger engine, never by roles directly.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM authenticated;

-- get_user_stats: switch to SECURITY INVOKER (caller already has SELECT on scores)
CREATE OR REPLACE FUNCTION public.get_user_stats(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_games_played   integer;
  v_avg_score      integer;
  v_best_streak    integer;
  v_current_streak integer;
  v_prev_score     integer;
  r                record;
BEGIN
  SELECT
    count(*)::integer,
    coalesce(round(avg(score))::integer, 0)
  INTO v_games_played, v_avg_score
  FROM scores
  WHERE user_id = p_user_id;

  v_best_streak    := 0;
  v_current_streak := 0;
  v_prev_score     := NULL;

  FOR r IN
    SELECT score FROM scores
    WHERE user_id = p_user_id
    ORDER BY created_at ASC
  LOOP
    IF v_prev_score IS NULL OR r.score >= v_prev_score THEN
      v_current_streak := v_current_streak + 1;
    ELSE
      v_current_streak := 1;
    END IF;

    IF v_current_streak > v_best_streak THEN
      v_best_streak := v_current_streak;
    END IF;

    v_prev_score := r.score;
  END LOOP;

  RETURN json_build_object(
    'games_played', v_games_played,
    'avg_score',    v_avg_score,
    'best_streak',  v_best_streak
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_stats(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_stats(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_user_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_stats(uuid) TO service_role;

-- get_public_game_stats: switch to SECURITY INVOKER (caller has SELECT on profiles
-- with USING true, counting all rows works correctly under RLS)
CREATE OR REPLACE FUNCTION public.get_public_game_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_total_users  integer;
  v_online_users integer;
BEGIN
  SELECT count(*)::integer
  INTO v_total_users
  FROM public.profiles;

  SELECT count(*)::integer
  INTO v_online_users
  FROM public.profiles p
  WHERE p.last_seen_at IS NOT NULL
    AND p.last_seen_at >= now() - interval '60 seconds';

  RETURN json_build_object(
    'total_users',  coalesce(v_total_users,  0),
    'online_users', coalesce(v_online_users, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_game_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_game_stats() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_public_game_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_game_stats() TO service_role;
