/*
  # Enforce score-session integrity

  ## Summary
  - Enforces session_id on new score rows
  - Validates session ownership and completion via trigger
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'scores_session_id_required'
      AND conrelid = 'public.scores'::regclass
  ) THEN
    ALTER TABLE public.scores
      ADD CONSTRAINT scores_session_id_required
      CHECK (session_id IS NOT NULL)
      NOT VALID;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.validate_score_session_link()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_session_user_id uuid;
  v_session_completed boolean;
BEGIN
  IF NEW.session_id IS NULL THEN
    RAISE EXCEPTION 'session_id is required for score inserts';
  END IF;

  SELECT user_id, completed
  INTO v_session_user_id, v_session_completed
  FROM public.game_sessions
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

DROP TRIGGER IF EXISTS scores_validate_session_link ON public.scores;

CREATE TRIGGER scores_validate_session_link
BEFORE INSERT ON public.scores
FOR EACH ROW
EXECUTE FUNCTION public.validate_score_session_link();
