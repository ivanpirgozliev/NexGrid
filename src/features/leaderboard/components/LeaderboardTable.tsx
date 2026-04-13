import { memo } from 'react';
import { motion } from 'framer-motion';
import { Crown, Medal } from 'lucide-react';
import type { LeaderboardEntry } from '../../../types';

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  currentUserId?: string;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return <Crown className="w-4 h-4 text-yellow-400" />;
  if (rank === 2)
    return <Medal className="w-4 h-4 text-gray-300" />;
  if (rank === 3)
    return <Medal className="w-4 h-4 text-amber-600" />;
  return <span className="text-gray-600 text-sm font-mono w-4 text-center">{rank}</span>;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export const LeaderboardTable = memo(function LeaderboardTable({
  entries,
  currentUserId,
}: LeaderboardTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-800">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-800 bg-gray-900/50">
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-12">
              #
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Player
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Score
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">
              Level
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">
              Lines
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">
              Date
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/50">
          {entries.map((entry, idx) => {
            const isCurrent = entry.user_id === currentUserId;
            return (
              <motion.tr
                key={entry.score_id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.03 }}
                className={`transition-colors ${
                  isCurrent
                    ? 'bg-cyan-950/30 border-l-2 border-cyan-500'
                    : 'bg-gray-900/20 hover:bg-gray-800/30'
                }`}
              >
                <td className="px-4 py-3.5">
                  <div className="flex items-center justify-center w-6">
                    <RankBadge rank={idx + 1} />
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <span
                    className={`text-sm font-medium ${
                      isCurrent ? 'text-cyan-300' : 'text-gray-200'
                    }`}
                  >
                    {entry.username}
                    {isCurrent && (
                      <span className="ml-2 text-xs text-cyan-500/70">(you)</span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <span className="text-sm font-bold text-white tabular-nums">
                    {entry.score.toLocaleString()}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right hidden sm:table-cell">
                  <span className="text-sm text-gray-400 tabular-nums">{entry.level}</span>
                </td>
                <td className="px-4 py-3.5 text-right hidden sm:table-cell">
                  <span className="text-sm text-gray-400 tabular-nums">{entry.lines}</span>
                </td>
                <td className="px-4 py-3.5 text-right hidden md:table-cell">
                  <span className="text-xs text-gray-500">{formatDate(entry.created_at)}</span>
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});
