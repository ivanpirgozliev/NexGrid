import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface StatCardProps {
  label: string;
  value: number;
}

const StatCard = memo(function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">{label}</p>
      <AnimatePresence mode="wait">
        <motion.p
          key={value}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-bold text-white tabular-nums"
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
}

export const GameStats = memo(function GameStats({ score, level, lines }: GameStatsProps) {
  return (
    <div className="flex flex-col gap-3">
      <StatCard label="Score" value={score} />
      <StatCard label="Level" value={level} />
      <StatCard label="Lines" value={lines} />
    </div>
  );
});
