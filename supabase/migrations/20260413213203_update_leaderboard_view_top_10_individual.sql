/*
  # Update leaderboard view to show top 10 individual scores

  ## Summary
  Replaces the existing aggregate leaderboard view with one that shows
  the top 10 individual game results across all players.

  ## Changes
  - Drop and recreate `leaderboard` view
  - Each row is now a single game result (not aggregated per player)
  - Includes player username, score, level, lines, and date played
  - Limited to 10 entries ordered by score descending

  ## Security
  - View uses SECURITY INVOKER (inherits caller's RLS permissions)
  - Authenticated users already have SELECT on scores and profiles
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
  LIMIT 10;
