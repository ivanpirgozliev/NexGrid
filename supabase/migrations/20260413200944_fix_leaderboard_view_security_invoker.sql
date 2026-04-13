/*
  # Fix leaderboard view security

  ## Summary
  Recreates the `leaderboard` view with `SECURITY INVOKER` instead of
  the default `SECURITY DEFINER`, so that it respects RLS policies on
  the underlying `profiles` and `scores` tables.

  ## Changes
  - Drop and recreate `leaderboard` view with `security_invoker = on`

  ## Security
  - The view now runs with the permissions of the querying user
  - RLS on `profiles` and `scores` is enforced through the view
*/

DROP VIEW IF EXISTS leaderboard;

CREATE VIEW leaderboard
  WITH (security_invoker = on)
AS
  SELECT
    p.id AS user_id,
    p.username,
    MAX(s.score) AS best_score,
    MAX(s.level) AS best_level,
    COUNT(s.id)::int AS games_played
  FROM profiles p
  JOIN scores s ON s.user_id = p.id
  GROUP BY p.id, p.username
  ORDER BY best_score DESC
  LIMIT 100;
