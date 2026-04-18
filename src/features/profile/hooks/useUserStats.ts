import { useQuery } from '@tanstack/react-query';
import { scoresService } from '../../../services/scores.service';
import { useAuthContext } from '../../auth/context/AuthContext';

export function useUserStats() {
  const { user } = useAuthContext();
  return useQuery({
    queryKey: ['userStats', user?.id],
    queryFn: () => scoresService.getUserStats(user!.id),
    enabled: !!user,
    staleTime: 1000 * 60,
  });
}
