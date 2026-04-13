import { motion } from 'framer-motion';
import { Trophy, RefreshCw } from 'lucide-react';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { LeaderboardTable } from '../components/LeaderboardTable';
import { Button } from '../../../components/ui/Button';
import { useAuthContext } from '../../auth/context/AuthContext';

export function LeaderboardPage() {
  const { data, isLoading, isError, refetch, isFetching } = useLeaderboard();
  const { user } = useAuthContext();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="max-w-2xl mx-auto px-4 py-10"
    >
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Leaderboard</h1>
            <p className="text-gray-500 text-sm">Top players worldwide</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          isLoading={isFetching}
          className="gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
        </div>
      )}

      {isError && (
        <div className="text-center py-16 text-gray-500">
          <p className="mb-3">Failed to load leaderboard</p>
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      )}

      {data && data.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <Trophy className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No scores yet. Be the first!</p>
        </div>
      )}

      {data && data.length > 0 && (
        <LeaderboardTable entries={data} currentUserId={user?.id} />
      )}
    </motion.div>
  );
}
