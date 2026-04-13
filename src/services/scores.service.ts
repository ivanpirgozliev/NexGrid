import { supabase } from '../lib/supabase';
import type { Score, LeaderboardEntry } from '../types';

export const scoresService = {
  async saveScore(score: Omit<Score, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('scores')
      .insert(score)
      .select()
      .single();
    if (error) throw error;
    return data;
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
