/*
  # Add presence heartbeat for online stats

  ## Summary
  - Adds `last_seen_at` to `profiles`
  - Updates `get_public_game_stats()` to count online users by recent presence heartbeat

  ## Notes
  - A user is considered online when `last_seen_at` is within the last 90 seconds.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'last_seen_at'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN last_seen_at timestamptz;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS profiles_last_seen_at_idx
  ON public.profiles (last_seen_at DESC);

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
    AND p.last_seen_at >= now() - interval '90 seconds';

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
