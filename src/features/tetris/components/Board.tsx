import { memo, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Board as BoardType, Tetromino, CellValue, TetrominoType } from '../types';
import { Cell } from './Cell';
import { getBoardWithGhost } from '../utils/board';
import { BOARD_WIDTH, BOARD_HEIGHT } from '../utils/board';

const CELL_SIZE = 36;

interface BoardProps {
  board: BoardType;
  current: Tetromino | null;
  clearedRows: number[];
}

function buildRenderBoard(
  board: BoardType,
  current: Tetromino | null
): { value: CellValue; isGhost: boolean }[][] {
  const render: { value: CellValue; isGhost: boolean }[][] = board.map((row) =>
    row.map((value) => ({ value, isGhost: false }))
  );

  if (!current) return render;

  const { ghostY } = getBoardWithGhost(board, current);

  for (let row = 0; row < current.shape.length; row++) {
    for (let col = 0; col < current.shape[row].length; col++) {
      if (!current.shape[row][col]) continue;
      const gy = ghostY + row;
      const gx = current.position.x + col;
      if (gy >= 0 && gy < BOARD_HEIGHT && gx >= 0 && gx < BOARD_WIDTH) {
        if (!render[gy][gx].value) {
          render[gy][gx] = { value: current.type, isGhost: true };
        }
      }
    }
  }

  for (let row = 0; row < current.shape.length; row++) {
    for (let col = 0; col < current.shape[row].length; col++) {
      if (!current.shape[row][col]) continue;
      const cy = current.position.y + row;
      const cx = current.position.x + col;
      if (cy >= 0 && cy < BOARD_HEIGHT && cx >= 0 && cx < BOARD_WIDTH) {
        render[cy][cx] = { value: current.type as TetrominoType, isGhost: false };
      }
    }
  }

  return render;
}

export const Board = memo(function Board({ board, current, clearedRows }: BoardProps) {
  const renderBoard = useMemo(
    () => buildRenderBoard(board, current),
    [board, current]
  );

  return (
    <div
      className="relative border border-gray-700/50 bg-gray-950 rounded-lg overflow-hidden"
      style={{ display: 'grid', gridTemplateRows: `repeat(${BOARD_HEIGHT}, 1fr)` }}
    >
      {renderBoard.map((row, rowIdx) => (
        <div
          key={rowIdx}
          className="flex"
          style={{ width: `${BOARD_WIDTH * CELL_SIZE}px`, height: `${CELL_SIZE}px` }}
        >
          <AnimatePresence>
            {clearedRows.includes(rowIdx) && (
              <motion.div
                key={`clear-${rowIdx}`}
                initial={{ opacity: 1 }}
                animate={{ opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-x-0 bg-white/30 pointer-events-none"
                style={{ top: `${rowIdx * CELL_SIZE}px`, height: `${CELL_SIZE}px` }}
              />
            )}
          </AnimatePresence>
          {row.map((cell, colIdx) => (
            <div key={colIdx} style={{ width: CELL_SIZE, height: CELL_SIZE }} className="p-px">
              <Cell value={cell.value} isGhost={cell.isGhost} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
});
