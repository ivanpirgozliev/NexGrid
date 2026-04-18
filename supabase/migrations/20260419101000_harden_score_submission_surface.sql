/*
  # Harden score submission surface

  ## Summary
  - Adds score-to-session linkage for replay resistance
  - Enforces one score per game session at DB level
  - Reduces direct table privileges for anon/authenticated roles
  - Restricts get_user_stats execution to authenticated role only
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'scores'
      AND column_name = 'session_id'
  ) THEN
    ALTER TABLE public.scores ADD COLUMN session_id uuid;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'scores_session_id_fkey'
      AND conrelid = 'public.scores'::regclass
  ) THEN
    ALTER TABLE public.scores
      ADD CONSTRAINT scores_session_id_fkey
      FOREIGN KEY (session_id)
      REFERENCES public.game_sessions(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS scores_session_id_unique
  ON public.scores (session_id)
  WHERE session_id IS NOT NULL;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.scores
  FROM anon, authenticated;

REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.game_sessions
  FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.get_user_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_stats(uuid) TO authenticated;
