import type { TetrominoType, Tetromino } from '../types';

export const TETROMINO_SHAPES: Record<TetrominoType, number[][]> = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
};

export const TETROMINO_COLORS: Record<TetrominoType, string> = {
  I: 'cyan',
  O: 'yellow',
  T: 'purple',
  S: 'green',
  Z: 'red',
  J: 'blue',
  L: 'orange',
};

const TYPES: TetrominoType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

export function randomTetrominoType(): TetrominoType {
  return TYPES[Math.floor(Math.random() * TYPES.length)];
}

export function createTetromino(type: TetrominoType): Tetromino {
  const shape = TETROMINO_SHAPES[type];
  const x = Math.floor((10 - shape[0].length) / 2);
  return { type, shape, position: { x, y: 0 } };
}

export function rotateTetromino(tetromino: Tetromino): Tetromino {
  const { shape } = tetromino;
  const size = shape.length;
  const rotated: number[][] = Array.from({ length: size }, () => Array(size).fill(0));
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      rotated[col][size - 1 - row] = shape[row][col];
    }
  }
  return { ...tetromino, shape: rotated };
}
