import { useCallback, useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { scoresService } from '../../../services/scores.service';
import { useAuthContext } from '../../auth/context/AuthContext';

const HEARTBEAT_INTERVAL_MS = 15_000;

export function useSaveScore(isPlaying: boolean) {
  const { user } = useAuthContext();
  const queryClient = useQueryClient();
  const savedRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const tokenRef = useRef<string | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const mutation = useMutation({
    mutationFn: scoresService.saveScore,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['userScores'] });
    },
  });

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    stopHeartbeat();
    heartbeatRef.current = setInterval(() => {
      if (sessionIdRef.current && tokenRef.current) {
        scoresService.sendHeartbeat(sessionIdRef.current, tokenRef.current).catch(() => {});
      }
    }, HEARTBEAT_INTERVAL_MS);
  }, [stopHeartbeat]);

  useEffect(() => {
    if (isPlaying) {
      if (sessionIdRef.current && tokenRef.current) {
        startHeartbeat();
      }
    } else {
      stopHeartbeat();
    }
    return stopHeartbeat;
  }, [isPlaying, startHeartbeat, stopHeartbeat]);

  const startSession = useCallback(async () => {
    if (!user) return;
    try {
      const session = await scoresService.startGameSession();
      sessionIdRef.current = session.id;
      tokenRef.current = session.token;
    } catch {
      sessionIdRef.current = null;
      tokenRef.current = null;
    }
  }, [user]);

  const saveScore = useCallback(
    (score: number, level: number, lines: number) => {
      if (!user || savedRef.current || score === 0 || !sessionIdRef.current || !tokenRef.current) return;
      stopHeartbeat();
      savedRef.current = true;
      mutation.mutate({
        score,
        level,
        lines,
        session_id: sessionIdRef.current,
        token: tokenRef.current,
      });
    },
    [user, mutation, stopHeartbeat]
  );

  const resetSaved = useCallback(() => {
    stopHeartbeat();
    savedRef.current = false;
    sessionIdRef.current = null;
    tokenRef.current = null;
  }, [stopHeartbeat]);

  return { saveScore, resetSaved, startSession, isSaving: mutation.isPending };
}
