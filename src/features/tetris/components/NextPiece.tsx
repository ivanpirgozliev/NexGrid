import { memo } from 'react';
import type { TetrominoType } from '../types';
import { TETROMINO_SHAPES } from '../utils/tetrominos';
import { Cell } from './Cell';

interface NextPieceProps {
  type: TetrominoType;
}

const CELL_SIZE = 30;

export const NextPiece = memo(function NextPiece({ type }: NextPieceProps) {
  const shape = TETROMINO_SHAPES[type];

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
      <p className="font-semibold text-gray-500 uppercase tracking-widest text-xs mb-3">Next</p>
      <div className="flex items-center justify-center min-h-[100px]">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${shape[0].length}, ${CELL_SIZE}px)`,
            gridTemplateRows: `repeat(${shape.length}, ${CELL_SIZE}px)`,
            gap: '2px',
          }}
        >
          {shape.map((row, rIdx) =>
            row.map((cell, cIdx) => (
              <div key={`${rIdx}-${cIdx}`} style={{ width: CELL_SIZE, height: CELL_SIZE }} className="p-px">
                <Cell value={cell ? type : null} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
});
