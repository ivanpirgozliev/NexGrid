export type { Database } from './database';

export interface User {
  id: string;
  email: string;
  username: string;
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
  user_id: string;
  username: string;
  best_score: number;
  best_level: number;
  games_played: number;
}
