import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface StatCardProps {
  label: string;
  value: number;
}

const StatCard = memo(function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="flex-1 bg-gray-900/50 border border-gray-800 rounded-xl p-1.5 sm:p-4 min-w-0">
      <p className="text-[9px] sm:text-xs font-semibold text-gray-500 uppercase tracking-widest mb-0 sm:mb-1 truncate">{label}</p>
      <AnimatePresence mode="wait">
        <motion.p
          key={value}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm sm:text-2xl font-bold text-white tabular-nums truncate leading-tight"
        >
          {value.toLocaleString()}
        </motion.p>
      </AnimatePresence>
    </div>
  );
});

interface GameStatsProps {
  score: number;
  level: number;
  lines: number;
  orientation?: 'vertical' | 'horizontal';
}

export const GameStats = memo(function GameStats({ score, level, lines, orientation = 'vertical' }: GameStatsProps) {
  return (
    <div className={orientation === 'horizontal' ? 'flex gap-2 w-full' : 'flex flex-col gap-3'}>
      <StatCard label="Score" value={score} />
      <StatCard label="Level" value={level} />
      <StatCard label="Lines" value={lines} />
    </div>
  );
});
