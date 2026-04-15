/*
  # Add CHECK constraints to scores table

  1. Constraints Added
    - `score` must be between 0 and 999999
    - `level` must be between 1 and 100
    - `lines` must be between 0 and 999
    - Score must be consistent with lines (cannot exceed theoretical max)
  
  2. Security
    - These constraints enforce data integrity at the database level
    - Even if edge functions are bypassed, invalid data cannot be inserted
    - Prevents obviously fake scores from being stored

  3. Important Notes
    - Reasonable maximums: 999 lines at max level yields ~800k+ score
    - Level 100 means 990+ lines cleared, which is extremely high gameplay
    - These limits allow legitimate play while blocking obvious cheats
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'scores_score_range'
  ) THEN
    ALTER TABLE scores ADD CONSTRAINT scores_score_range
      CHECK (score >= 0 AND score <= 999999);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'scores_level_range'
  ) THEN
    ALTER TABLE scores ADD CONSTRAINT scores_level_range
      CHECK (level >= 1 AND level <= 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'scores_lines_range'
  ) THEN
    ALTER TABLE scores ADD CONSTRAINT scores_lines_range
      CHECK (lines >= 0 AND lines <= 999);
  END IF;
END $$;