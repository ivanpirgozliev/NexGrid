export type { AuthUser, AuthSession } from '../lib/authStore';

export interface User {
  id: string;
  email: string;
  username: string;
  avatar_url?: string | null;
}

export interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
  created_at: string;
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
  avatar_url?: string | null;
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

export interface PublicGameStats {
  total_users: number;
  online_users: number;
}
