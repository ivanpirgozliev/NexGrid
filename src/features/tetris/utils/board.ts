import type { Board, CellValue, Tetromino } from '../types';

export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;

export function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_HEIGHT }, () =>
    Array<CellValue>(BOARD_WIDTH).fill(null)
  );
}

export function isValidPosition(board: Board, tetromino: Tetromino): boolean {
  const { shape, position } = tetromino;
  for (let row = 0; row < shape.length; row++) {
    for (let col = 0; col < shape[row].length; col++) {
      if (!shape[row][col]) continue;
      const boardX = position.x + col;
      const boardY = position.y + row;
      if (boardX < 0 || boardX >= BOARD_WIDTH) return false;
      if (boardY >= BOARD_HEIGHT) return false;
      if (boardY >= 0 && board[boardY][boardX] !== null) return false;
    }
  }
  return true;
}

export function mergeTetromino(board: Board, tetromino: Tetromino): Board {
  const newBoard = board.map((row) => [...row]);
  const { shape, position } = tetromino;
  for (let row = 0; row < shape.length; row++) {
    for (let col = 0; col < shape[row].length; col++) {
      if (!shape[row][col]) continue;
      const boardY = position.y + row;
      const boardX = position.x + col;
      if (boardY >= 0) {
        newBoard[boardY][boardX] = tetromino.type;
      }
    }
  }
  return newBoard;
}

export function clearLines(board: Board): { board: Board; clearedCount: number; clearedRows: number[] } {
  const clearedRows: number[] = [];
  const remaining = board.filter((row, idx) => {
    if (row.every((cell) => cell !== null)) {
      clearedRows.push(idx);
      return false;
    }
    return true;
  });
  const clearedCount = clearedRows.length;
  const newRows: Board = Array.from({ length: clearedCount }, () =>
    Array<CellValue>(BOARD_WIDTH).fill(null)
  );
  return { board: [...newRows, ...remaining], clearedCount, clearedRows };
}

export function getBoardWithGhost(board: Board, tetromino: Tetromino): { ghostY: number } {
  let ghostY = tetromino.position.y;
  while (
    isValidPosition(board, {
      ...tetromino,
      position: { ...tetromino.position, y: ghostY + 1 },
    })
  ) {
    ghostY++;
  }
  return { ghostY };
}
