/*
  # Create Scores and Leaderboard Tables

  ## Summary
  Sets up the data layer for the Tetris game's scoring and leaderboard system.

  ## New Tables

  ### `scores`
  Stores every game session result for a user.
  - `id` (uuid, primary key) - unique score entry identifier
  - `user_id` (uuid, FK to auth.users) - owner of the score
  - `score` (integer) - final score achieved
  - `level` (integer) - level reached
  - `lines` (integer) - total lines cleared
  - `created_at` (timestamptz) - when the game was played

  ### `profiles`
  Public-facing user profile data (display name).
  - `id` (uuid, PK, FK to auth.users) - mirrors auth.users.id
  - `username` (text) - display name
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled on both tables
  - Users can only insert/read their own scores
  - Leaderboard SELECT is open to authenticated users (read-only, aggregate view)
  - Profiles are readable by all authenticated users but only writable by the owner

  ## Notes
  1. A `best_scores` view is created for the leaderboard, joining profiles + max scores
  2. Indexes on user_id and score for fast leaderboard queries
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE TABLE IF NOT EXISTS scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 0,
  level integer NOT NULL DEFAULT 1,
  lines integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS scores_user_id_idx ON scores(user_id);
CREATE INDEX IF NOT EXISTS scores_score_desc_idx ON scores(score DESC);

CREATE POLICY "Users can view own scores"
  ON scores FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scores"
  ON scores FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE VIEW leaderboard AS
  SELECT
    p.id AS user_id,
    p.username,
    MAX(s.score) AS best_score,
    MAX(s.level) AS best_level,
    COUNT(s.id) AS games_played
  FROM profiles p
  JOIN scores s ON s.user_id = p.id
  GROUP BY p.id, p.username
  ORDER BY best_score DESC
  LIMIT 100;
