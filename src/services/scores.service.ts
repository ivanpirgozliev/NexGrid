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

async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  let session = data.session;
  const expiresAt = session?.expires_at ? session.expires_at * 1000 : 0;

  // Refresh shortly before expiry to avoid edge-function 401 responses.
  if (session && expiresAt > 0 && expiresAt - Date.now() < 60_000) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) throw refreshError;
    session = refreshed.session ?? session;
  }

  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  return session.access_token;
}

async function getAuthHeaders() {
  const accessToken = await getAccessToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
    'Apikey': SUPABASE_ANON_KEY,
  };
}

async function readFunctionError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: unknown };
    if (typeof body.error === 'string' && body.error.length > 0) {
      return body.error;
    }
  } catch {
    // Ignore non-JSON response bodies.
  }

  return fallback;
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
      throw new Error(await readFunctionError(res, 'Failed to start game session'));
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
      throw new Error(await readFunctionError(res, 'Failed to save score'));
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
