/*
  # Harden RLS policies and function search_path

  ## Summary
  - Improve RLS policy performance by wrapping auth.uid() with SELECT
  - Set fixed search_path for get_user_stats to avoid mutable search_path warning
  - Add explicit deny policy on game_sessions for authenticated users

  ## Security
  - No behavior change for clients: game_sessions remains inaccessible directly
  - get_user_stats remains SECURITY DEFINER, now with deterministic search_path
*/

ALTER POLICY "Users can insert own profile"
  ON profiles
  WITH CHECK ((select auth.uid()) = id);

ALTER POLICY "Users can update own profile"
  ON profiles
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

ALTER POLICY "Authenticated users can view all scores"
  ON scores
  USING ((select auth.uid()) IS NOT NULL);

ALTER FUNCTION public.get_user_stats(uuid)
  SET search_path = public;

DROP POLICY IF EXISTS "No direct access to game sessions" ON game_sessions;

CREATE POLICY "No direct access to game sessions"
  ON game_sessions
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);
