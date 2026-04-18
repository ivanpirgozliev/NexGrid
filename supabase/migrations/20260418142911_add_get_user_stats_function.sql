/*
  # Add get_user_stats RPC function

  ## Summary
  Creates a Postgres function that computes profile statistics for a given user.

  ## Stats Returned
  - `games_played` (integer): Total number of games the user has completed
  - `avg_score` (integer): Average score across all games (rounded)
  - `best_streak` (integer): Longest consecutive run of games where each score >= previous score (ordered by created_at)

  ## Security
  - Function uses SECURITY DEFINER to bypass RLS, but only returns aggregate stats for the requested user
  - Only accessible to authenticated users via RPC
*/

CREATE OR REPLACE FUNCTION get_user_stats(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_games_played integer;
  v_avg_score integer;
  v_best_streak integer;
  v_current_streak integer;
  v_prev_score integer;
  r record;
BEGIN
  SELECT
    count(*)::integer,
    coalesce(round(avg(score))::integer, 0)
  INTO v_games_played, v_avg_score
  FROM scores
  WHERE user_id = p_user_id;

  v_best_streak := 0;
  v_current_streak := 0;
  v_prev_score := NULL;

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
    'avg_score', v_avg_score,
    'best_streak', v_best_streak
  );
END;
$$;