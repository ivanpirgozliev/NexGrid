/*
  # Reduce online presence window to 60 seconds

  ## Summary
  - Updates get_public_game_stats() to count users as online when last_seen_at is within 60 seconds.
*/

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

  SELECT count(*)::integer
  INTO v_online_users
  FROM public.profiles p
  WHERE p.last_seen_at IS NOT NULL
    AND p.last_seen_at >= now() - interval '60 seconds';

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
