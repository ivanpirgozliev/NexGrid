import { memo } from 'react';
import { motion } from 'framer-motion';
import { Crown, Medal } from 'lucide-react';
import type { LeaderboardEntry } from '../../../types';

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  currentUserId?: string;
}

function PlayerAvatar({ avatarUrl, username }: { avatarUrl?: string | null; username: string }) {
  const initial = username.trim().charAt(0).toUpperCase() || '?';

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={`${username} avatar`}
        loading="lazy"
        className="w-8 h-8 rounded-lg object-cover border border-gray-700/80 shrink-0"
      />
    );
  }

  return (
    <div className="w-8 h-8 rounded-lg border border-gray-700/80 bg-gray-800/80 text-cyan-300 text-xs font-semibold flex items-center justify-center shrink-0">
      {initial}
    </div>
  );
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
    <div className="rounded-xl border border-gray-800 overflow-hidden">
      <div className="h-[443px] overflow-y-auto scrollbar-hide">
        <table className="w-full table-fixed">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-gray-800 bg-gray-900/95 backdrop-blur">
              <th className="px-4 h-8 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-12">
                #
              </th>
              <th className="px-4 h-8 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Player
              </th>
              <th className="px-4 h-8 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">
                Score
              </th>
              <th className="px-4 h-8 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell w-16">
                Level
              </th>
              <th className="px-4 h-8 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell w-16">
                Lines
              </th>
              <th className="px-4 h-8 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell w-28">
                Date
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {entries.map((entry, idx) => {
              const isCurrent = entry.user_id === currentUserId;
              const displayName = entry.username || 'Player';

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
                  <td className="px-4 h-10 w-12 align-middle">
                    <div className="flex items-center justify-center w-6">
                      <RankBadge rank={idx + 1} />
                    </div>
                  </td>
                  <td className="px-4 h-10 min-w-0 align-middle">
                    <div className="flex items-center gap-3 min-w-0">
                      <PlayerAvatar avatarUrl={entry.avatar_url} username={displayName} />
                      <span
                        className={`text-sm font-medium truncate ${
                          isCurrent ? 'text-cyan-300' : 'text-gray-200'
                        }`}
                      >
                        {displayName}
                        {isCurrent && (
                          <span className="ml-2 text-xs text-cyan-500/70">(you)</span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 h-10 text-right w-24 align-middle">
                    <span className="text-sm font-bold text-white tabular-nums">
                      {entry.score.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 h-10 text-right hidden sm:table-cell w-16 align-middle">
                    <span className="text-sm text-gray-400 tabular-nums">{entry.level}</span>
                  </td>
                  <td className="px-4 h-10 text-right hidden sm:table-cell w-16 align-middle">
                    <span className="text-sm text-gray-400 tabular-nums">{entry.lines}</span>
                  </td>
                  <td className="px-4 h-10 text-right hidden md:table-cell w-28 align-middle">
                    <span className="text-xs text-gray-500">{formatDate(entry.created_at)}</span>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
});
