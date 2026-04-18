import { memo } from 'react';
import type { TetrominoType } from '../types';
import { TETROMINO_SHAPES } from '../utils/tetrominos';
import { Cell } from './Cell';

interface NextPieceProps {
  type: TetrominoType;
  compact?: boolean;
}

export const NextPiece = memo(function NextPiece({ type, compact }: NextPieceProps) {
  const shape = TETROMINO_SHAPES[type];
  const cellSize = compact ? 18 : 30;

  return (
    <div className={`bg-gray-900/50 border border-gray-800 rounded-xl ${compact ? 'p-1.5' : 'p-4'}`}>
      <p className={`font-semibold text-gray-500 uppercase tracking-widest ${compact ? 'text-[9px] mb-1' : 'text-xs mb-3'}`}>Next</p>
      <div className={`flex items-center justify-center ${compact ? 'min-h-[36px]' : 'min-h-[100px]'}`}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${shape[0].length}, ${cellSize}px)`,
            gridTemplateRows: `repeat(${shape.length}, ${cellSize}px)`,
            gap: '2px',
          }}
        >
          {shape.map((row, rIdx) =>
            row.map((cell, cIdx) => (
              <div key={`${rIdx}-${cIdx}`} style={{ width: cellSize, height: cellSize }} className="p-px">
                <Cell value={cell ? type : null} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
});
