/*
  # Update leaderboard view to top 100

  ## Summary
  Changes the leaderboard view from showing 10 entries to 100 entries.

  ## Changes
  - Drop and recreate `leaderboard` view with LIMIT 100
  - All columns and security settings remain the same

  ## Security
  - View uses SECURITY INVOKER (inherits caller's RLS permissions)
*/

DROP VIEW IF EXISTS leaderboard;

CREATE OR REPLACE VIEW leaderboard
WITH (security_invoker = on) AS
  SELECT
    s.id AS score_id,
    s.user_id,
    p.username,
    s.score,
    s.level,
    s.lines,
    s.created_at
  FROM scores s
  JOIN profiles p ON p.id = s.user_id
  ORDER BY s.score DESC
  LIMIT 100;