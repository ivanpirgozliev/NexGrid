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

export function findFullRows(board: Board): number[] {
  const rows: number[] = [];
  for (let i = 0; i < board.length; i++) {
    if (board[i].every((cell) => cell !== null)) {
      rows.push(i);
    }
  }
  return rows;
}

export function removeRows(board: Board, rows: number[]): { board: Board; clearedCount: number } {
  const rowSet = new Set(rows);
  const remaining = board.filter((_, idx) => !rowSet.has(idx));
  const clearedCount = rows.length;
  const newRows: Board = Array.from({ length: clearedCount }, () =>
    Array<CellValue>(BOARD_WIDTH).fill(null)
  );
  return { board: [...newRows, ...remaining], clearedCount };
}

export function clearLines(board: Board): { board: Board; clearedCount: number; clearedRows: number[] } {
  const clearedRows = findFullRows(board);
  const { board: newBoard, clearedCount } = removeRows(board, clearedRows);
  return { board: newBoard, clearedCount, clearedRows };
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
