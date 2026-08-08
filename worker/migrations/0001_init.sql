/*
  # NexGrid — initial Neon schema

  Replaces the Supabase-managed `auth` schema and all RLS policies.
  Access control now lives in the Cloudflare Worker: the database is reached
  only through it, using a single owner role. What Postgres still enforces are
  the integrity rules that must hold regardless of application bugs — score
  ranges, one score per session, and score/session ownership linkage.
*/

-- ── auth ────────────────────────────────────────────────────────────────────
-- Replaces auth.users. Emails are stored lowercased by the Worker; the unique
-- constraint is therefore case-sensitive on already-normalised values.
CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Opaque refresh tokens, stored as SHA-256 hashes so a database leak cannot be
-- replayed against the API. Access tokens are stateless JWTs and are not stored.
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_expires_at_idx ON refresh_tokens(expires_at);

-- ── public profile data ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id           uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  username     text NOT NULL DEFAULT '',
  avatar_url   text,
  last_seen_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profiles_last_seen_at_idx ON profiles(last_seen_at DESC);

-- ── gameplay ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS game_sessions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token             text NOT NULL,
  started_at        timestamptz NOT NULL DEFAULT now(),
  completed         boolean NOT NULL DEFAULT false,
  heartbeat_count   integer NOT NULL DEFAULT 0,
  last_heartbeat_at timestamptz
);

CREATE INDEX IF NOT EXISTS game_sessions_user_id_idx ON game_sessions(user_id);
CREATE INDEX IF NOT EXISTS game_sessions_active_idx
  ON game_sessions(user_id, started_at) WHERE completed = false;

CREATE TABLE IF NOT EXISTS scores (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  score      integer NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 999999),
  level      integer NOT NULL DEFAULT 1 CHECK (level >= 1 AND level <= 100),
  lines      integer NOT NULL DEFAULT 0 CHECK (lines >= 0 AND lines <= 999),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One score per session: makes score replay impossible at the storage layer,
-- independently of the Worker's session-claim logic.
CREATE UNIQUE INDEX IF NOT EXISTS scores_session_id_key ON scores(session_id);
CREATE INDEX IF NOT EXISTS scores_user_id_idx ON scores(user_id);
CREATE INDEX IF NOT EXISTS scores_score_desc_idx ON scores(score DESC);

-- Carried over from the Supabase schema: a score row may only reference a
-- completed session owned by the same user.
CREATE OR REPLACE FUNCTION validate_score_session_link()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_session_user_id   uuid;
  v_session_completed boolean;
BEGIN
  SELECT user_id, completed
  INTO v_session_user_id, v_session_completed
  FROM game_sessions
  WHERE id = NEW.session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid session_id';
  END IF;

  IF v_session_user_id IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'session ownership mismatch';
  END IF;

  IF v_session_completed IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'game session must be completed before score insert';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS scores_validate_session_link ON scores;
CREATE TRIGGER scores_validate_session_link
  BEFORE INSERT ON scores
  FOR EACH ROW EXECUTE FUNCTION validate_score_session_link();

-- ── read models ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW leaderboard AS
  SELECT
    s.id AS score_id,
    s.user_id,
    p.username,
    p.avatar_url,
    s.score,
    s.level,
    s.lines,
    s.created_at
  FROM scores s
  JOIN profiles p ON p.id = s.user_id
  ORDER BY s.score DESC
  LIMIT 100;

/*
  best_streak: longest run of consecutive games (ordered by created_at) where
  each score is >= the previous one. Ported from the Supabase plpgsql loop to a
  set-based window query — a new "island" starts whenever a score drops.
*/
CREATE OR REPLACE FUNCTION get_user_stats(p_user_id uuid)
RETURNS json
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH ordered AS (
    SELECT
      row_number() OVER (ORDER BY created_at) AS rn,
      -- lag() is NULL on the first row, so `score >= NULL` yields NULL and the
      -- row correctly opens the first island.
      CASE
        WHEN score >= lag(score) OVER (ORDER BY created_at) THEN 0
        ELSE 1
      END AS is_break
    FROM scores
    WHERE user_id = p_user_id
  ), islands AS (
    SELECT sum(is_break) OVER (ORDER BY rn ROWS UNBOUNDED PRECEDING) AS grp
    FROM ordered
  )
  SELECT json_build_object(
    'games_played', (SELECT count(*)::int FROM scores WHERE user_id = p_user_id),
    'avg_score',    (SELECT coalesce(round(avg(score))::int, 0) FROM scores WHERE user_id = p_user_id),
    'best_streak',  (SELECT coalesce(max(c)::int, 0) FROM (SELECT count(*) AS c FROM islands GROUP BY grp) t)
  );
$$;

CREATE OR REPLACE FUNCTION get_public_game_stats()
RETURNS json
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT json_build_object(
    'total_users',  (SELECT count(*)::int FROM profiles),
    'online_users', (
      SELECT count(*)::int FROM profiles
      WHERE last_seen_at IS NOT NULL
        AND last_seen_at >= now() - interval '60 seconds'
    )
  );
$$;
