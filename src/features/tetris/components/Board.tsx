import { memo, useMemo } from 'react';
import type { Board as BoardType, Tetromino, CellValue, TetrominoType } from '../types';
import { Cell } from './Cell';
import { LineClearEffect } from './LineClearEffect';
import { getBoardWithGhost } from '../utils/board';
import { BOARD_WIDTH, BOARD_HEIGHT } from '../utils/board';

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

  const clearedSet = useMemo(() => new Set(clearedRows), [clearedRows]);

  return (
    <div
      className="relative border border-gray-700/50 bg-gray-950 rounded-lg overflow-hidden w-full h-full"
      style={{ aspectRatio: `${BOARD_WIDTH} / ${BOARD_HEIGHT}` }}
    >
      <div
        className="absolute inset-0 grid"
        style={{
          gridTemplateColumns: `repeat(${BOARD_WIDTH}, 1fr)`,
          gridTemplateRows: `repeat(${BOARD_HEIGHT}, 1fr)`,
          gap: '1px',
          padding: '1px',
        }}
      >
        {renderBoard.map((row, rowIdx) =>
          row.map((cell, colIdx) => {
            const isClearing = clearedSet.has(rowIdx);
            return (
              <div
                key={`${rowIdx}-${colIdx}`}
                style={isClearing ? {
                  animation: `lineClearCellPop 400ms ${colIdx * 20}ms ease-out forwards`,
                } : undefined}
              >
                <Cell value={cell.value} isGhost={cell.isGhost} />
              </div>
            );
          })
        )}
      </div>
      <LineClearEffect clearedRows={clearedRows} />
    </div>
  );
});
