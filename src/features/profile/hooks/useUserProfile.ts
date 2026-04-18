import { useQuery } from '@tanstack/react-query';
import { authService } from '../../../services/auth.service';
import { useAuthContext } from '../../auth/context/AuthContext';

export function useUserProfile() {
  const { user } = useAuthContext();

  return useQuery({
    queryKey: ['userProfile', user?.id],
    queryFn: () => authService.getProfile(user!.id),
    enabled: !!user,
    staleTime: 1000 * 60,
  });
}
