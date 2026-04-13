import { useQuery } from '@tanstack/react-query';
import { scoresService } from '../../../services/scores.service';
import { useAuthContext } from '../../auth/context/AuthContext';

export function useLeaderboard() {
  return useQuery({
    queryKey: ['leaderboard'],
    queryFn: scoresService.getLeaderboard,
    staleTime: 1000 * 30,
  });
}

export function useUserScores() {
  const { user } = useAuthContext();
  return useQuery({
    queryKey: ['userScores', user?.id],
    queryFn: () => scoresService.getUserScores(user!.id),
    enabled: !!user,
  });
}
