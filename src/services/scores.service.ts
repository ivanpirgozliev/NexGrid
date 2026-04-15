import { supabase } from '../lib/supabase';
import type { Score, LeaderboardEntry } from '../types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
    'Apikey': SUPABASE_ANON_KEY,
  };
}

export const scoresService = {
  async startGameSession(): Promise<string> {
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
    return data.id;
  },

  async saveScore(payload: { score: number; level: number; lines: number; session_id?: string }) {
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
      .limit(10);
    if (error) throw error;
    return (data ?? []) as LeaderboardEntry[];
  },
};
