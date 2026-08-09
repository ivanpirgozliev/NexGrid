import { api } from '../lib/api';
import type { Score, LeaderboardEntry, UserStats, PublicGameStats } from '../types';

/*
  Token handling, refresh-on-401 and retries all live in lib/api.ts now. The
  hand-rolled getAccessToken/invokeFunction pair this file used to carry existed
  because the Supabase client and the edge functions authenticated differently;
  with one API behind one scheme, that split is gone.
*/

export interface GameSession {
  id: string;
  token: string;
}

export interface SaveScorePayload {
  score: number;
  level: number;
  lines: number;
  session_id: string;
  token: string;
}

export const scoresService = {
  async startGameSession(): Promise<GameSession> {
    const data = await api.post<{ id: string; token: string }>('/game/start');
    return { id: data.id, token: data.token };
  },

  async sendHeartbeat(sessionId: string, token: string): Promise<void> {
    await api.post('/game/heartbeat', { session_id: sessionId, token });
  },

  async saveScore(payload: SaveScorePayload): Promise<Score> {
    return api.post<Score>('/game/submit-score', payload);
  },

  async getUserScores(): Promise<Score[]> {
    return api.get<Score[]>('/scores/me');
  },

  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    return api.get<LeaderboardEntry[]>('/leaderboard');
  },

  async getUserStats(): Promise<UserStats> {
    return api.get<UserStats>('/stats/me');
  },

  async getPublicGameStats(): Promise<PublicGameStats> {
    return api.get<PublicGameStats>('/stats/public');
  },
};
