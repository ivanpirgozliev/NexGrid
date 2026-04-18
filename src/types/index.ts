export type { Database } from './database';

export interface User {
  id: string;
  email: string;
  username: string;
  avatar_url?: string | null;
}

export interface Score {
  id: string;
  user_id: string;
  score: number;
  level: number;
  lines: number;
  created_at: string;
}

export interface LeaderboardEntry {
  score_id: string;
  user_id: string;
  username: string;
  score: number;
  level: number;
  lines: number;
  created_at: string;
}

export interface UserStats {
  games_played: number;
  avg_score: number;
  best_streak: number;
}
