import { memo } from 'react';
import type { TetrominoType } from '../types';
import { TETROMINO_SHAPES } from '../utils/tetrominos';
import { Cell } from './Cell';

interface NextPieceProps {
  type: TetrominoType;
}

export const NextPiece = memo(function NextPiece({ type }: NextPieceProps) {
  const shape = TETROMINO_SHAPES[type];

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Next</p>
      <div className="flex items-center justify-center min-h-[80px]">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${shape[0].length}, 24px)`,
            gridTemplateRows: `repeat(${shape.length}, 24px)`,
            gap: '2px',
          }}
        >
          {shape.map((row, rIdx) =>
            row.map((cell, cIdx) => (
              <div key={`${rIdx}-${cIdx}`} style={{ width: 24, height: 24 }} className="p-px">
                <Cell value={cell ? type : null} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
});
