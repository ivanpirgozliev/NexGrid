export type TetrominoType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

export type CellValue = TetrominoType | null;

export type Board = CellValue[][];

export interface Position {
  x: number;
  y: number;
}

export interface Tetromino {
  type: TetrominoType;
  shape: number[][];
  position: Position;
}

export type GameStatus = 'idle' | 'playing' | 'paused' | 'over';

export interface GameState {
  board: Board;
  current: Tetromino | null;
  next: TetrominoType;
  score: number;
  level: number;
  lines: number;
  status: GameStatus;
  clearedRows: number[];
}
