const LINE_POINTS = [0, 100, 300, 500, 800];

export function calculateScore(linesCleared: number, level: number): number {
  return (LINE_POINTS[linesCleared] ?? 0) * level;
}

export function calculateLevel(totalLines: number): number {
  return Math.floor(totalLines / 10) + 1;
}

export function calculateDropInterval(level: number): number {
  return Math.max(80, 1000 - (level - 1) * 90);
}
