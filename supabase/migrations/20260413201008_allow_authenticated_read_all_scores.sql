/*
  # Allow authenticated users to read all scores

  ## Summary
  Updates the SELECT policy on `scores` so that all authenticated users
  can read score entries. This is necessary for the leaderboard view
  (now `security_invoker`) to aggregate scores across all players.

  ## Changes
  - Drop the old restrictive "Users can view own scores" policy
  - Create a new "Authenticated users can view all scores" policy

  ## Security
  - Only authenticated users can read scores
  - INSERT remains restricted to own user_id
  - Score data (score, level, lines) is non-sensitive game data
*/

DROP POLICY IF EXISTS "Users can view own scores" ON scores;

CREATE POLICY "Authenticated users can view all scores"
  ON scores FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);
