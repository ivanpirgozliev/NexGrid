import { supabase } from '../lib/supabase';
import type { Score, LeaderboardEntry, UserStats } from '../types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

function toUserStats(value: unknown): UserStats {
  if (!value || typeof value !== 'object') {
    return { games_played: 0, avg_score: 0, best_streak: 0 };
  }

  const data = value as Record<string, unknown>;

  return {
    games_played: Number(data.games_played ?? 0),
    avg_score: Number(data.avg_score ?? 0),
    best_streak: Number(data.best_streak ?? 0),
  };
}

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
    'Apikey': SUPABASE_ANON_KEY,
  };
}

export interface GameSession {
  id: string;
  token: string;
}

export const scoresService = {
  async startGameSession(): Promise<GameSession> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${SUPABASE_URL}/functions/v1/start-game`, {
      method: 'POST',
      headers,
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to start game session');
    }

    const data = await res.json();
    return { id: data.id, token: data.token };
  },

  async sendHeartbeat(sessionId: string, token: string): Promise<void> {
    const headers = await getAuthHeaders();
    await fetch(`${SUPABASE_URL}/functions/v1/game-heartbeat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ session_id: sessionId, token }),
    });
  },

  async saveScore(payload: { score: number; level: number; lines: number; session_id: string; token: string }) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-score`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save score');
    }

    return res.json();
  },

  async getUserScores(userId: string): Promise<Score[]> {
    const { data, error } = await supabase
      .from('scores')
      .select('*')
      .eq('user_id', userId)
      .order('score', { ascending: false })
      .limit(10);
    if (error) throw error;
    return (data ?? []) as Score[];
  },

  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    const { data, error } = await supabase
      .from('leaderboard')
      .select('*')
      .order('score', { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data ?? []) as LeaderboardEntry[];
  },

  async getUserStats(userId: string): Promise<UserStats> {
    const { data, error } = await supabase.rpc('get_user_stats', {
      p_user_id: userId,
    });
    if (error) throw error;
    return toUserStats(data);
  },
};
