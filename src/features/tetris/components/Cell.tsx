import { memo } from 'react';
import type { TetrominoType } from '../types';

interface CellProps {
  value: TetrominoType | null;
  isGhost?: boolean;
}

const colorMap: Record<TetrominoType, string> = {
  I: 'bg-cyan-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-1px_0_rgba(0,0,0,0.3)] shadow-cyan-300/30',
  O: 'bg-yellow-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-1px_0_rgba(0,0,0,0.3)] shadow-yellow-300/30',
  T: 'bg-fuchsia-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-1px_0_rgba(0,0,0,0.3)] shadow-fuchsia-400/30',
  S: 'bg-green-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-1px_0_rgba(0,0,0,0.3)] shadow-green-400/30',
  Z: 'bg-red-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-1px_0_rgba(0,0,0,0.3)] shadow-red-400/30',
  J: 'bg-blue-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-1px_0_rgba(0,0,0,0.3)] shadow-blue-400/30',
  L: 'bg-orange-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-1px_0_rgba(0,0,0,0.3)] shadow-orange-400/30',
};

const ghostMap: Record<TetrominoType, string> = {
  I: 'border border-cyan-400/50 bg-cyan-400/10',
  O: 'border border-yellow-400/50 bg-yellow-400/10',
  T: 'border border-fuchsia-500/50 bg-fuchsia-500/10',
  S: 'border border-green-500/50 bg-green-500/10',
  Z: 'border border-red-500/50 bg-red-500/10',
  J: 'border border-blue-500/50 bg-blue-500/10',
  L: 'border border-orange-500/50 bg-orange-500/10',
};

export const Cell = memo(function Cell({ value, isGhost }: CellProps) {
  if (!value) {
    return <div className="w-full h-full border border-gray-800/50 rounded-[2px]" />;
  }
  if (isGhost) {
    return <div className={`w-full h-full rounded-[2px] ${ghostMap[value]}`} />;
  }
  return <div className={`w-full h-full rounded-[2px] ${colorMap[value]}`} />;
});
