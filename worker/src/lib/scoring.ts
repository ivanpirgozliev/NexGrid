/*
  Ported verbatim from supabase/functions/submit-score/index.ts.

  Given a total number of cleared lines, works out the lowest and highest score
  reachable by any sequence of single/double/triple/tetris clears that sums to
  that total. A submitted score outside those bounds cannot have come from real
  play, whatever the client claims.

  Must stay in step with src/features/tetris/utils/scoring.ts.
*/

const LINE_POINTS = [0, 100, 300, 500, 800];

export const MAX_LINES_POSSIBLE = 999;
export const MAX_LEVEL_POSSIBLE = 100;

export function computeScoreBounds(lines: number): { min: number; max: number } {
  if (lines <= 0) {
    return { min: 0, max: 0 };
  }

  const minScores = Array<number>(lines + 1).fill(Number.POSITIVE_INFINITY);
  const maxScores = Array<number>(lines + 1).fill(Number.NEGATIVE_INFINITY);
  minScores[0] = 0;
  maxScores[0] = 0;

  for (let clearedTotal = 0; clearedTotal < lines; clearedTotal += 1) {
    for (let clearCount = 1; clearCount <= 4; clearCount += 1) {
      const nextTotal = clearedTotal + clearCount;
      if (nextTotal > lines) continue;

      // Game scoring uses the level after lines are added.
      const nextLevel = Math.floor(nextTotal / 10) + 1;
      const gainedScore = (LINE_POINTS[clearCount] ?? 0) * nextLevel;

      minScores[nextTotal] = Math.min(
        minScores[nextTotal],
        minScores[clearedTotal] + gainedScore
      );
      maxScores[nextTotal] = Math.max(
        maxScores[nextTotal],
        maxScores[clearedTotal] + gainedScore
      );
    }
  }

  return { min: minScores[lines], max: maxScores[lines] };
}
