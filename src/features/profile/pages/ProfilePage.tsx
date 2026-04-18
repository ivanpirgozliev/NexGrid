import { motion } from 'framer-motion';
import { User, Gamepad2, Target, Flame, RefreshCw } from 'lucide-react';
import { useAuthContext } from '../../auth/context/AuthContext';
import { useUserStats } from '../hooks/useUserStats';
import { StatCard } from '../components/StatCard';
import { Button } from '../../../components/ui/Button';

export function ProfilePage() {
  const { user, username } = useAuthContext();
  const { data: stats, isLoading, isError, refetch, isFetching } = useUserStats();

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })
    : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="max-w-[840px] mx-auto px-4 py-10"
    >
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/20 flex items-center justify-center">
            <User className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              {username ?? 'Player'}
            </h1>
            {memberSince && (
              <p className="text-gray-500 text-sm">Member since {memberSince}</p>
            )}
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
          <p className="mb-3">Failed to load stats</p>
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      )}

      {stats && (
        <>
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              Stats Dashboard
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              icon={<Gamepad2 className="w-5 h-5 text-cyan-400" />}
              label="Games Played"
              value={stats.games_played}
              sublabel="Total completed games"
              accentColor="#22d3ee"
              delay={0}
            />
            <StatCard
              icon={<Target className="w-5 h-5 text-emerald-400" />}
              label="Average Score"
              value={stats.avg_score}
              sublabel="Across all games"
              accentColor="#34d399"
              delay={0.08}
            />
            <StatCard
              icon={<Flame className="w-5 h-5 text-amber-400" />}
              label="Best Streak"
              value={stats.best_streak}
              sublabel="Consecutive improving games"
              accentColor="#fbbf24"
              delay={0.16}
            />
          </div>
        </>
      )}

      {stats && stats.games_played === 0 && (
        <div className="mt-8 text-center py-10 rounded-2xl border border-gray-800 bg-gray-900/30">
          <Gamepad2 className="w-10 h-10 mx-auto mb-3 text-gray-700" />
          <p className="text-gray-500">No games played yet. Start playing to see your stats!</p>
        </div>
      )}
    </motion.div>
  );
}
