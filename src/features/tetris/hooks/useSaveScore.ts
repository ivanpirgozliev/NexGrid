import { useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { scoresService } from '../../../services/scores.service';
import { useAuthContext } from '../../auth/context/AuthContext';

export function useSaveScore() {
  const { user } = useAuthContext();
  const queryClient = useQueryClient();
  const savedRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);

  const mutation = useMutation({
    mutationFn: scoresService.saveScore,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['userScores'] });
    },
  });

  const startSession = useCallback(async () => {
    if (!user) return;
    try {
      sessionIdRef.current = await scoresService.startGameSession();
    } catch {
      sessionIdRef.current = null;
    }
  }, [user]);

  const saveScore = useCallback(
    (score: number, level: number, lines: number) => {
      if (!user || savedRef.current || score === 0 || !sessionIdRef.current) return;
      savedRef.current = true;
      mutation.mutate({
        score,
        level,
        lines,
        session_id: sessionIdRef.current,
      });
    },
    [user, mutation]
  );

  const resetSaved = useCallback(() => {
    savedRef.current = false;
    sessionIdRef.current = null;
  }, []);

  return { saveScore, resetSaved, startSession, isSaving: mutation.isPending };
}
