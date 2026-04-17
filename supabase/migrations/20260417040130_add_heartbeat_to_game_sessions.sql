/*
  # Add heartbeat tracking to game sessions

  1. Modified Tables
    - `game_sessions`
      - `heartbeat_count` (integer, default 0) - tracks how many heartbeats received during gameplay
      - `last_heartbeat_at` (timestamptz, nullable) - timestamp of last heartbeat

  2. Security
    - No new policies needed; existing service-role-only access applies

  3. Notes
    - Heartbeats are used to verify that a game is actively being played
    - The submit-score function will check heartbeat count against session duration
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'game_sessions' AND column_name = 'heartbeat_count'
  ) THEN
    ALTER TABLE game_sessions ADD COLUMN heartbeat_count integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'game_sessions' AND column_name = 'last_heartbeat_at'
  ) THEN
    ALTER TABLE game_sessions ADD COLUMN last_heartbeat_at timestamptz;
  END IF;
END $$;
